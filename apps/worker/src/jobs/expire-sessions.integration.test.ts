import { beforeAll, describe, expect, test } from "bun:test";

import { migrate } from "../../../../packages/database/scripts/migrate";
import { seed } from "../../../../packages/database/scripts/seed";
import { createLabSession } from "../../../../packages/database/src/lab";
import { sql } from "../../../../packages/database/src/client";
import { acceptMessage } from "../../../../packages/database/src/ingestion";

import { expireSessions } from "./expire-sessions";

process.env.LAB_TOKEN_PEPPER = "test-lab-token-pepper";

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
});
