import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";

import { migrate } from "../../../../packages/database/scripts/migrate";
import { seed } from "../../../../packages/database/scripts/seed";
import { sql } from "../../../../packages/database/src/client";
import { expireLabSessions } from "../../../../packages/database/src/lab";
import { buildServer } from "../server";
import type { ScenarioClock } from "./lab";

process.env.LAB_TOKEN_PEPPER = "test-lab-token-pepper";

const createdScopeIds: string[] = [];
let nextSessionAddress = 1;

function sessionHeaders(): Record<string, string> {
  const address = `198.51.102.${nextSessionAddress}`;
  nextSessionAddress += 1;
  return { "x-forwarded-for": `${address}, 10.0.0.1` };
}

class TestScenarioClock implements ScenarioClock {
  elapsedMs = 0;
  waits: number[] = [];

  async sleep(milliseconds: number): Promise<void> {
    this.elapsedMs += milliseconds;
    this.waits.push(milliseconds);
  }
}

async function createSession(
  server: ReturnType<typeof buildServer>,
  organizationSlug = "northstar-presents",
  headers: Record<string, string> = sessionHeaders(),
  url = "/api/lab/sessions",
): Promise<{ scopeId: string; token: string }> {
  const response = await server.inject({
    headers,
    method: "POST",
    url,
    payload: { organizationSlug },
  });

  expect(response.statusCode).toBe(201);
  const session = response.json() as { token: string };
  const scopes = await sql<{ scopeId: string }[]>`
    SELECT scope_id AS "scopeId"
    FROM demo_sessions
    WHERE token_hash = ${createHmac("sha256", process.env.LAB_TOKEN_PEPPER!)
      .update(session.token)
      .digest("hex")}
  `;
  const scope = scopes[0];

  if (!scope) {
    throw new Error("Expected the lab session scope");
  }

  createdScopeIds.push(scope.scopeId);
  return { ...session, scopeId: scope.scopeId };
}

describe("integration lab", () => {
  beforeAll(async () => {
    await migrate();
    await seed();
  });

  afterAll(async () => {
    await sql`
      UPDATE demo_sessions
      SET expires_at = now() - interval '1 second'
      WHERE scope_id = ANY(${createdScopeIds})
    `;
    await expireLabSessions();
  });

  test("creates a random lab token and stores no plaintext token", async () => {
    const server = buildServer();
    const { token } = await createSession(server);

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(
      Array.from(
        await sql<{ tokenHash: string }[]>`
          SELECT token_hash AS "tokenHash"
          FROM demo_sessions
          WHERE token_hash = ${createHmac(
            "sha256",
            process.env.LAB_TOKEN_PEPPER!,
          )
            .update(token)
            .digest("hex")}
        `,
      ),
    ).toEqual([
      {
        tokenHash: createHmac("sha256", process.env.LAB_TOKEN_PEPPER!)
          .update(token)
          .digest("hex"),
      },
    ]);
    const overview = await server.inject({
      method: "GET",
      url: "/api/overview",
      headers: { authorization: `Lab ${token}` },
    });

    expect(overview.statusCode).toBe(200);
    await server.close();
  });

  test("limits repeated lab sessions from one resolved address", async () => {
    const server = buildServer();
    const headers = { "x-forwarded-for": "198.51.100.31, 10.0.0.1" };

    for (let count = 0; count < 20; count += 1) {
      await createSession(server, "northstar-presents", headers);
    }

    const limited = await server.inject({
      headers,
      method: "POST",
      payload: { organizationSlug: "northstar-presents" },
      url: "/api/lab/sessions",
    });

    expect(limited.statusCode).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();
    await server.close();
  });

  test("limits all session query variants in one address bucket", async () => {
    const server = buildServer();
    const headers = { "x-forwarded-for": "198.51.100.32, 10.0.0.1" };
    const sessionPaths = [
      "/api/lab/sessions?retry=1",
      "/api/lab/sessions?retry=1&retry=2",
      "/api/lab/sessions?note=first%20session%20%F0%9F%8E%9F",
    ];

    for (let count = 0; count < 20; count += 1) {
      await createSession(
        server,
        "northstar-presents",
        headers,
        sessionPaths[count % sessionPaths.length]!,
      );
    }

    const limited = await server.inject({
      headers,
      method: "POST",
      payload: { organizationSlug: "northstar-presents" },
      url: "/api/lab/sessions?retry=1&retry=2&note=%F0%9F%8E%9F",
    });
    const otherPathHeaders = {
      "x-forwarded-for": "198.51.100.33, 10.0.0.1",
    };

    for (let count = 0; count < 20; count += 1) {
      const response = await server.inject({
        headers: otherPathHeaders,
        method: "POST",
        payload: { organizationSlug: "northstar-presents" },
        url: "/api/lab/session-history?retry=1",
      });

      expect(response.statusCode).toBe(404);
    }

    const untouchedSessionBucket = await server.inject({
      headers: otherPathHeaders,
      method: "POST",
      payload: { organizationSlug: "northstar-presents" },
      url: "/api/lab/sessions?retry=1",
    });

    expect(limited.statusCode).toBe(429);
    expect(untouchedSessionBucket.statusCode).toBe(201);
    await server.close();
  });

  test("keeps a scenario limit when each request has a new lab token", async () => {
    const server = buildServer();
    const scenarioHeaders = { "x-forwarded-for": "198.51.100.42, 10.0.0.1" };
    const tokens: string[] = [];

    for (let count = 0; count < 20; count += 1) {
      const session = await createSession(server, "northstar-presents", {
        "x-forwarded-for": `198.51.101.${count + 1}, 10.0.0.1`,
      });
      tokens.push(session.token);
      const response = await server.inject({
        headers: { ...scenarioHeaders, authorization: `Lab ${session.token}` },
        method: "POST",
        url: "/api/lab/scenarios/not-a-scenario/run",
      });

      expect(response.statusCode).toBe(404);
    }

    const replacement = await createSession(server, "northstar-presents", {
      "x-forwarded-for": "198.51.101.250, 10.0.0.1",
    });
    const limited = await server.inject({
      headers: {
        ...scenarioHeaders,
        authorization: `Lab ${replacement.token}`,
      },
      method: "POST",
      url: "/api/lab/scenarios/not-a-scenario/run",
    });
    const independent = await server.inject({
      headers: {
        authorization: `Lab ${tokens[0]!}`,
        "x-forwarded-for": "198.51.100.43, 10.0.0.1",
      },
      method: "POST",
      url: "/api/lab/scenarios/not-a-scenario/run",
    });

    expect(limited.statusCode).toBe(429);
    expect(independent.statusCode).toBe(404);
    await server.close();
  });

  test("runs every scenario with a scoped five-part trace", async () => {
    const server = buildServer();
    const { token } = await createSession(server);
    const scenarios = [
      "duplicate_webhook",
      "late_update",
      "provider_outage",
      "rate_limit",
      "uncertain_event_match",
      "incomplete_snapshot",
      "provider_change",
    ];

    for (const scenario of scenarios) {
      const response = await server.inject({
        method: "POST",
        url: `/api/lab/scenarios/${scenario}/run`,
        headers: { authorization: `Lab ${token}` },
      });
      const body = response.json();

      expect(response.statusCode).toBe(201);
      expect(body.scenario).toBe(scenario);
      expect(body.trace).toHaveLength(5);
      expect(body.trace.map((step: { title: string }) => step.title)).toEqual([
        "Original input",
        "Processing state",
        "Normalized output",
        "Database effect",
        "Audit result",
      ]);
    }

    const providerChange = await server.inject({
      method: "GET",
      url: "/api/shows",
      headers: { authorization: `Lab ${token}` },
    });
    const show = providerChange.json()[0];

    expect(show.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "encoretix", soldTickets: 400 }),
        expect.objectContaining({ provider: "boxgrid", soldTickets: 600 }),
      ]),
    );
    await server.close();
  });

  test("keeps raw payloads out of summaries and loads them from scoped evidence", async () => {
    const server = buildServer();
    const { token } = await createSession(server);
    await server.inject({
      method: "POST",
      url: "/api/lab/scenarios/duplicate_webhook/run",
      headers: { authorization: `Lab ${token}` },
    });
    const messages = await server.inject({
      method: "GET",
      url: "/api/messages",
      headers: { authorization: `Lab ${token}` },
    });
    const messageId = messages.json()[0].id as string;
    const evidence = await server.inject({
      method: "GET",
      url: `/api/messages/${messageId}`,
      headers: { authorization: `Lab ${token}` },
    });

    expect(messages.statusCode).toBe(200);
    expect(messages.body).not.toContain("effects");
    expect(evidence.statusCode).toBe(200);
    expect(evidence.json().payload).toEqual({
      effects: [{ amountDeltaCents: 5000, kind: "sale", ticketDelta: 2 }],
    });
    await server.close();
  });

  test("records observed outage and rate-limit poll evidence", async () => {
    const clock = new TestScenarioClock();
    const server = buildServer({
      lab: { createScenarioClock: () => clock },
    });
    const outage = await createSession(server);
    const outageResponse = await server.inject({
      method: "POST",
      url: "/api/lab/scenarios/provider_outage/run",
      headers: { authorization: `Lab ${outage.token}` },
    });
    const rate = await createSession(server);
    const rateResponse = await server.inject({
      method: "POST",
      url: "/api/lab/scenarios/rate_limit/run",
      headers: { authorization: `Lab ${rate.token}` },
    });

    expect(outageResponse.statusCode).toBe(201);
    expect(rateResponse.statusCode).toBe(201);
    expect(outageResponse.json().trace[1].explanation).toContain(
      "Attempt 1 failed",
    );
    expect(outageResponse.json().trace[3].databaseEffect).toContain(
      "after 2 attempts",
    );
    expect(rateResponse.json().trace[3].databaseEffect).toContain("unchanged");
    expect(outageResponse.json().trace[1].explanation).toContain(
      "virtual demo clock advanced 1000 ms",
    );
    expect(rateResponse.json().trace[1].explanation).toContain(
      "virtual demo clock advanced 60000 ms",
    );
    expect(clock.waits).toEqual([1000, 60000]);
    expect(clock.elapsedMs).toBe(61000);
    const auditRows = Array.from(
      await sql<
        {
          action: string;
          attempts: string | null;
          backoffMs: string | null;
          cursorAfter: string | null;
          cursorBefore: string | null;
          cursorInputs: string | null;
          error: string | null;
          retryAfterSeconds: string | null;
        }[]
      >`
          SELECT
            action,
            details->>'attempts' AS attempts,
            details->>'backoffMs' AS "backoffMs",
            details->>'cursorAfter' AS "cursorAfter",
            details->>'cursorBefore' AS "cursorBefore",
            details->>'cursorInputs' AS "cursorInputs",
            details->>'error' AS error,
            details->>'retryAfterSeconds' AS "retryAfterSeconds"
          FROM audit_entries
          WHERE scope_id IN (${outage.scopeId}, ${rate.scopeId})
            AND action IN ('venuewave_retrying', 'venuewave_recovered', 'venuewave_rate_limited')
          ORDER BY action
        `,
    );
    const rateLimit = auditRows.find(
      (row) => row.action === "venuewave_rate_limited",
    );
    const recovered = auditRows.find(
      (row) => row.action === "venuewave_recovered",
    );
    const retrying = auditRows.find(
      (row) => row.action === "venuewave_retrying",
    );

    expect(rateLimit).toEqual(
      expect.objectContaining({ retryAfterSeconds: "60" }),
    );
    expect(rateLimit?.cursorAfter).toBe(rateLimit?.cursorBefore);
    expect(rateLimit?.cursorInputs).toBe(
      `${rateLimit?.cursorBefore},${rateLimit?.cursorBefore}`,
    );
    expect(recovered).toEqual(
      expect.objectContaining({
        attempts: "2",
        cursorAfter: "cursor-outage-recovered",
      }),
    );
    expect(retrying).toEqual(
      expect.objectContaining({
        attempts: "1",
        backoffMs: "1000",
        error: "temporary provider failure",
      }),
    );
    await server.close();
  });

  test("closes a failed scenario lease before expiry can remove its scope", async () => {
    const server = buildServer({
      lab: {
        runScenarioWork: async () => {
          throw new Error("injected scenario failure");
        },
      },
    });
    const session = await createSession(server);
    const response = await server.inject({
      method: "POST",
      url: "/api/lab/scenarios/duplicate_webhook/run",
      headers: { authorization: `Lab ${session.token}` },
    });

    expect(response.statusCode).toBe(500);
    expect(
      Array.from(
        await sql<{ state: string }[]>`
          SELECT state FROM scenario_runs WHERE scope_id = ${session.scopeId}
        `,
      ),
    ).toEqual([{ state: "failed" }]);
    expect(
      Array.from(
        await sql<{ action: string }[]>`
          SELECT action FROM audit_entries
          WHERE scope_id = ${session.scopeId}
            AND action = 'scenario_failed'
        `,
      ),
    ).toEqual([{ action: "scenario_failed" }]);
    expect(
      Array.from(
        await sql<{ state: string; title: string }[]>`
          SELECT state, title FROM trace_steps
          WHERE scope_id = ${session.scopeId}
            AND state = 'failed'
        `,
      ),
    ).toEqual([{ state: "failed", title: "Scenario failure" }]);
    await sql`
      UPDATE demo_sessions
      SET expires_at = now() - interval '1 second'
      WHERE scope_id = ${session.scopeId}
    `;

    expect(await expireLabSessions()).toBe(1);
    await server.close();
  });

  test("does not expose or reset another lab scope", async () => {
    const server = buildServer();
    const first = await createSession(server);
    const second = await createSession(server);
    const firstRun = await server.inject({
      method: "POST",
      url: "/api/lab/scenarios/duplicate_webhook/run",
      headers: { authorization: `Lab ${first.token}` },
    });
    const runId = firstRun.json().id as string;
    await server.inject({
      method: "POST",
      url: "/api/lab/scenarios/uncertain_event_match/run",
      headers: { authorization: `Lab ${first.token}` },
    });
    const firstMessages = await server.inject({
      method: "GET",
      url: "/api/messages",
      headers: { authorization: `Lab ${first.token}` },
    });
    const firstReviews = await server.inject({
      method: "GET",
      url: "/api/reviews",
      headers: { authorization: `Lab ${first.token}` },
    });
    const messageId = firstMessages.json()[0].id as string;
    const reviewId = firstReviews.json()[0].id as string;

    const hiddenRead = await server.inject({
      method: "GET",
      url: `/api/lab/runs/${runId}`,
      headers: { authorization: `Lab ${second.token}` },
    });
    const hiddenReset = await server.inject({
      method: "POST",
      url: `/api/lab/runs/${runId}/reset`,
      headers: { authorization: `Lab ${second.token}` },
    });
    const hiddenReplay = await server.inject({
      method: "POST",
      url: `/api/messages/${messageId}/replay`,
      headers: { authorization: `Lab ${second.token}` },
    });
    const hiddenApprove = await server.inject({
      method: "POST",
      url: `/api/reviews/${reviewId}/approve`,
      headers: { authorization: `Lab ${second.token}` },
    });
    const hiddenReject = await server.inject({
      method: "POST",
      url: `/api/reviews/${reviewId}/reject`,
      headers: { authorization: `Lab ${second.token}` },
    });
    const ownedReset = await server.inject({
      method: "POST",
      url: `/api/lab/runs/${runId}/reset`,
      headers: { authorization: `Lab ${first.token}` },
    });

    expect(hiddenRead.statusCode).toBe(404);
    expect(hiddenReset.statusCode).toBe(404);
    expect(hiddenReplay.statusCode).toBe(404);
    expect(hiddenApprove.statusCode).toBe(404);
    expect(hiddenReject.statusCode).toBe(404);
    expect(ownedReset.statusCode).toBe(200);
    await server.close();
  });
});
