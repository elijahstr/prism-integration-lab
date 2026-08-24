import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";

import { migrate } from "../../../../packages/database/scripts/migrate";
import { seed } from "../../../../packages/database/scripts/seed";
import { sql } from "../../../../packages/database/src/client";
import { expireLabSessions } from "../../../../packages/database/src/lab";
import { buildServer } from "../server";

process.env.LAB_TOKEN_PEPPER = "test-lab-token-pepper";

const createdScopeIds: string[] = [];

async function createSession(
  server: ReturnType<typeof buildServer>,
  organizationSlug = "northstar-presents",
): Promise<{ scopeId: string; token: string }> {
  const response = await server.inject({
    method: "POST",
    url: "/api/lab/sessions",
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

    expect(hiddenRead.statusCode).toBe(404);
    expect(hiddenReset.statusCode).toBe(404);
    expect(hiddenReplay.statusCode).toBe(404);
    expect(hiddenApprove.statusCode).toBe(404);
    expect(hiddenReject.statusCode).toBe(404);
    await server.close();
  });
});
