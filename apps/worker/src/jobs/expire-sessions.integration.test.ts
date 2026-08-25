import { beforeAll, describe, expect, test } from "bun:test";

import { migrate } from "@prism/database/migrate";
import { seed } from "@prism/database/seed";
import { createLabSession, startScenarioRun } from "@prism/database/lab";
import { sql } from "@prism/database";
import { acceptMessage } from "@prism/database/ingestion";

import { expireSessions } from "./expire-sessions";

process.env.LAB_TOKEN_PEPPER = "test-lab-token-pepper";

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

async function waitForAdvisoryWaiter(lockKey: number): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const waiters = await sql`
      SELECT 1
      FROM pg_locks
      WHERE locktype = 'advisory'
        AND objid = ${lockKey}
        AND granted = false
      LIMIT 1
    `;

    if (waiters.length === 1) return;

    await Bun.sleep(5);
  }

  throw new Error("The database operation did not reach the advisory barrier");
}

describe("lab session expiry", () => {
  beforeAll(async () => {
    await migrate();
    await seed();
  });

  test("marks an expired session before it deletes an idle scope", async () => {
    const session = await createLabSession("northstar-presents");

    if (!session) {
      throw new Error("Expected a seeded lab session");
    }

    await sql`
      UPDATE demo_sessions
      SET expires_at = now() - interval '1 second'
      WHERE scope_id = ${session.scopeId}
    `;

    const connections = await sql<{ id: string; eventId: string }[]>`
      SELECT provider_connections.id, event_mappings.external_event_id AS "eventId"
      FROM provider_connections
      JOIN event_mappings
        ON event_mappings.scope_id = provider_connections.scope_id
        AND event_mappings.connection_id = provider_connections.id
      WHERE provider_connections.scope_id = ${session.scopeId}
        AND provider_connections.provider = 'encoretix'
      LIMIT 1
    `;
    const connection = connections[0]!;
    const accepted = await acceptMessage(session, {
      checksum: "sha256:expiry-active-job",
      connectionId: connection.id,
      deliveryId: `expiry-active-job-${crypto.randomUUID()}`,
      externalEventId: connection.eventId,
      kind: "sale_delta",
      organizationId: session.organizationId,
      payload: {
        effects: [{ amountDeltaCents: 5000, kind: "sale", ticketDelta: 2 }],
      },
      provider: "encoretix",
      receivedAt: "2026-08-24T12:00:00.000Z",
      scopeId: session.scopeId,
      sourceOccurredAt: "2026-08-24T12:00:00.000Z",
      sourceVersion: "2026-08-24T12:00:00.000Z",
    });

    expect(await expireSessions()).toBe(0);
    expect(
      Array.from(
        await sql<{ state: string }[]>`
          SELECT state FROM demo_sessions WHERE scope_id = ${session.scopeId}
        `,
      ),
    ).toEqual([{ state: "expired" }]);
    await sql`
      UPDATE ingestion_messages
      SET state = 'applied'
      WHERE id = ${accepted.messageId}
    `;

    expect(await expireSessions()).toBe(1);
    expect(
      Array.from(
        await sql`
        SELECT scope_id
        FROM data_scopes
        WHERE scope_id = ${session.scopeId}
      `,
      ),
    ).toEqual([]);
  });

  test("refuses a scenario lease when expiry wins the session lock race", async () => {
    const session = await createLabSession("northstar-presents");

    if (!session) {
      throw new Error("Expected a seeded lab session");
    }

    await sql`
      UPDATE demo_sessions
      SET expires_at = now() - interval '1 second'
      WHERE scope_id = ${session.scopeId}
    `;
    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION delay_lab_expiry() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.scope_id = '${session.scopeId}' AND NEW.state = 'expired' THEN
          PERFORM pg_advisory_xact_lock(812346);
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await sql.unsafe(`
      CREATE TRIGGER delay_lab_expiry_trigger
      BEFORE UPDATE ON demo_sessions
      FOR EACH ROW EXECUTE FUNCTION delay_lab_expiry()
    `);
    const barrierLocked = deferred();
    const releaseBarrier = deferred();
    const barrier = sql.begin(async (transaction) => {
      await transaction`SELECT pg_advisory_xact_lock(812346)`;
      barrierLocked.resolve();
      await releaseBarrier.promise;
    });

    await barrierLocked.promise;
    const expiry = expireSessions();
    await waitForAdvisoryWaiter(812346);
    const start = startScenarioRun(session, "duplicate_webhook");
    releaseBarrier.resolve();

    let deleted: number;
    let runId: string | null;

    try {
      [deleted, runId] = await Promise.all([expiry, start]);
    } finally {
      await barrier;
      await sql.unsafe(
        "DROP TRIGGER delay_lab_expiry_trigger ON demo_sessions",
      );
      await sql.unsafe("DROP FUNCTION delay_lab_expiry()");
    }

    expect(deleted).toBe(1);
    expect(runId).toBeNull();
    expect(
      Array.from(
        await sql`
          SELECT id FROM scenario_runs WHERE scope_id = ${session.scopeId}
        `,
      ),
    ).toEqual([]);
  });

  test("retains an expired scope when a scenario lease wins before expiry", async () => {
    const session = await createLabSession("northstar-presents");

    if (!session) {
      throw new Error("Expected a seeded lab session");
    }

    const runId = await startScenarioRun(session, "duplicate_webhook");

    expect(runId).toMatch(/^run-lab-/);
    await sql`
      UPDATE demo_sessions
      SET expires_at = now() - interval '1 second'
      WHERE scope_id = ${session.scopeId}
    `;

    expect(await expireSessions()).toBe(0);
    expect(
      Array.from(
        await sql<{ state: string }[]>`
          SELECT state
          FROM demo_sessions
          WHERE scope_id = ${session.scopeId}
        `,
      ),
    ).toEqual([{ state: "expired" }]);
    expect(
      Array.from(
        await sql<{ state: string }[]>`
          SELECT state
          FROM scenario_runs
          WHERE id = ${runId}
        `,
      ),
    ).toEqual([{ state: "running" }]);
    await sql`
      UPDATE scenario_runs
      SET state = 'completed'
      WHERE id = ${runId}
    `;
    expect(await expireSessions()).toBe(1);
  });

  test("keeps a started scope when the scenario lease wins the expiry lock race", async () => {
    const session = await createLabSession("northstar-presents");

    if (!session) {
      throw new Error("Expected a seeded lab session");
    }

    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION delay_lab_scenario_start() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.scope_id = '${session.scopeId}' THEN
          PERFORM pg_advisory_xact_lock(812345);
          UPDATE demo_sessions
          SET state = 'expired', expires_at = now() - interval '1 second'
          WHERE scope_id = NEW.scope_id;
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await sql.unsafe(`
      CREATE TRIGGER delay_lab_scenario_start_trigger
      BEFORE INSERT ON scenario_runs
      FOR EACH ROW EXECUTE FUNCTION delay_lab_scenario_start()
    `);
    const barrierLocked = deferred();
    const releaseBarrier = deferred();
    const barrier = sql.begin(async (transaction) => {
      await transaction`SELECT pg_advisory_xact_lock(812345)`;
      barrierLocked.resolve();
      await releaseBarrier.promise;
    });

    await barrierLocked.promise;
    const start = startScenarioRun(session, "duplicate_webhook");
    await waitForAdvisoryWaiter(812345);
    const expiry = expireSessions();
    releaseBarrier.resolve();

    try {
      const [runId, deleted] = await Promise.all([start, expiry]);

      expect(runId).toMatch(/^run-lab-/);
      expect(deleted).toBe(0);
      expect(
        Array.from(
          await sql<{ state: string }[]>`
            SELECT state FROM scenario_runs WHERE id = ${runId}
          `,
        ),
      ).toEqual([{ state: "running" }]);
      expect(
        Array.from(
          await sql<{ state: string }[]>`
            SELECT state FROM demo_sessions WHERE scope_id = ${session.scopeId}
          `,
        ),
      ).toEqual([{ state: "expired" }]);
    } finally {
      await barrier;
      await sql.unsafe(
        "DROP TRIGGER delay_lab_scenario_start_trigger ON scenario_runs",
      );
      await sql.unsafe("DROP FUNCTION delay_lab_scenario_start()");
    }

    await sql`
      UPDATE scenario_runs
      SET state = 'completed'
      WHERE scope_id = ${session.scopeId}
    `;
    expect(await expireSessions()).toBe(1);
  });
});
