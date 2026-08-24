import { beforeAll, describe, expect, test } from "bun:test";

import type { ProviderEnvelope } from "../../../../packages/contracts/src/provider-envelope";
import { acceptMessage } from "../../../../packages/database/src/ingestion";
import { sql } from "../../../../packages/database/src/client";
import type { Scope } from "../../../../packages/database/src/scope";
import { migrate } from "../../../../packages/database/scripts/migrate";
import { seed } from "../../../../packages/database/scripts/seed";

import { processMessage, processQueueJob } from "./process-message";

const scope: Scope = {
  organizationId: "organization-northstar",
  scopeId: "scope-northstar-baseline",
};

function encoreEnvelopeFor(deliveryId: string): ProviderEnvelope {
  return {
    checksum: `sha256:${deliveryId}`,
    connectionId: "connection-northstar-encoretix",
    deliveryId,
    externalEventId: "event-fictional-summer-hall",
    kind: "sale_delta",
    organizationId: scope.organizationId,
    payload: {
      effects: [{ amountDeltaCents: 700, kind: "sale", ticketDelta: 3 }],
    },
    provider: "encoretix",
    receivedAt: "2026-08-24T12:35:01.000Z",
    scopeId: scope.scopeId,
    sourceOccurredAt: "2026-08-24T12:34:56.000Z",
    sourceVersion: "2026-08-24T12:34:56.000Z",
  };
}

function boxGridEnvelopeFor(
  deliveryId: string,
  rank: string,
  sold: number,
): ProviderEnvelope {
  return {
    checksum: `sha256:${deliveryId}`,
    connectionId: "connection-northstar-boxgrid",
    deliveryId,
    externalEventId: "event-fictional-summer-hall",
    kind: "snapshot",
    organizationId: scope.organizationId,
    payload: {
      complete: true,
      facts: {
        grossSalesCents: sold * 1000,
        inventory: 100 - sold,
        sold,
      },
      sequence: rank,
    },
    provider: "boxgrid",
    receivedAt: "2026-08-24T12:35:01.000Z",
    scopeId: scope.scopeId,
    sourceOccurredAt: "2026-08-24T12:34:56.000Z",
    sourceVersion: rank,
  };
}

async function ensureBoxGridMapping(): Promise<void> {
  await sql`
    INSERT INTO event_mappings (
      id,
      scope_id,
      organization_id,
      connection_id,
      provider,
      external_event_id,
      show_id
    )
    VALUES (
      'mapping-northstar-boxgrid',
      ${scope.scopeId},
      ${scope.organizationId},
      'connection-northstar-boxgrid',
      'boxgrid',
      'event-fictional-summer-hall',
      'show-northstar-summer-hall'
    )
    ON CONFLICT (scope_id, provider, external_event_id) DO UPDATE
    SET connection_id = EXCLUDED.connection_id,
        show_id = EXCLUDED.show_id,
        state = 'confirmed'
  `;
}

beforeAll(async () => {
  await migrate();
  await seed();
  await ensureBoxGridMapping();
  await sql`
    DELETE FROM ticket_facts
    WHERE scope_id = ${scope.scopeId}
      AND provider = 'boxgrid'
  `;
});

describe("message processing", () => {
  test("records an incomplete snapshot without changing provider facts", async () => {
    const deliveryId = `incomplete-snapshot-${crypto.randomUUID()}`;
    const accepted = await acceptMessage(scope, {
      checksum: "sha256:incomplete-snapshot",
      connectionId: "connection-northstar-boxgrid",
      deliveryId,
      externalEventId: "event-fictional-summer-hall",
      kind: "snapshot",
      organizationId: scope.organizationId,
      payload: {
        complete: false,
        facts: { grossSalesCents: 10000, inventory: 50, sold: 10 },
        sequence: "4",
      },
      provider: "boxgrid",
      receivedAt: "2026-08-24T12:35:01.000Z",
      scopeId: scope.scopeId,
      sourceOccurredAt: "2026-08-24T12:34:56.000Z",
      sourceVersion: "4",
    });

    await expect(processMessage(accepted.messageId)).resolves.toBe(
      "needs_review",
    );
    expect(
      Array.from(
        await sql<{ facts: string; staged: string; action: string }[]>`
          SELECT
            (SELECT count(*)::text FROM ticket_facts WHERE provider = 'boxgrid') AS facts,
            (SELECT count(*)::text FROM snapshot_staging WHERE message_id = ${accepted.messageId}) AS staged,
            (SELECT action FROM audit_entries WHERE message_id = ${accepted.messageId} ORDER BY created_at DESC LIMIT 1) AS action
        `,
      ),
    ).toEqual([{ facts: "0", staged: "1", action: "snapshot_incomplete" }]);
  });

  test("stages a complete snapshot before one provider-scoped fact replacement", async () => {
    const deliveryId = `complete-snapshot-${crypto.randomUUID()}`;
    const accepted = await acceptMessage(scope, {
      checksum: "sha256:complete-snapshot",
      connectionId: "connection-northstar-boxgrid",
      deliveryId,
      externalEventId: "event-fictional-summer-hall",
      kind: "snapshot",
      organizationId: scope.organizationId,
      payload: {
        complete: true,
        facts: { grossSalesCents: 10000, inventory: 50, sold: 10 },
        sequence: "5",
      },
      provider: "boxgrid",
      receivedAt: "2026-08-24T12:35:01.000Z",
      scopeId: scope.scopeId,
      sourceOccurredAt: "2026-08-24T12:34:56.000Z",
      sourceVersion: "5",
    });

    await expect(processMessage(accepted.messageId)).resolves.toBe("applied");
    expect(
      Array.from(
        await sql<{ complete: boolean; sold: number; versionRank: string }[]>`
          SELECT
            snapshot_staging.complete,
            ticket_facts.sold_tickets AS sold,
            ticket_facts.version_rank::text AS "versionRank"
          FROM snapshot_staging
          JOIN ticket_facts
            ON ticket_facts.provider = snapshot_staging.provider
            AND ticket_facts.scope_id = snapshot_staging.scope_id
          WHERE snapshot_staging.message_id = ${accepted.messageId}
        `,
      ),
    ).toEqual([{ complete: true, sold: 10, versionRank: "5" }]);
  });

  test("allows a transient job failure to succeed on a later attempt", async () => {
    let calls = 0;
    const processor = async () => {
      calls += 1;

      if (calls === 1) {
        throw new Error("temporary database error");
      }

      return "applied" as const;
    };

    await expect(
      processQueueJob(
        { attemptsMade: 0, data: { messageId: "transient-message" } },
        processor,
      ),
    ).rejects.toThrow("temporary database error");
    await expect(
      processQueueJob(
        { attemptsMade: 1, data: { messageId: "transient-message" } },
        processor,
      ),
    ).resolves.toBe("applied");

    expect(calls).toBe(2);
  });

  test("records a failed message and audit evidence after the fifth failure", async () => {
    const accepted = await acceptMessage(
      scope,
      encoreEnvelopeFor(`exhausted-retry-${crypto.randomUUID()}`),
    );

    await expect(
      processQueueJob(
        { attemptsMade: 4, data: { messageId: accepted.messageId } },
        async () => {
          throw new Error("database unavailable");
        },
      ),
    ).rejects.toThrow("database unavailable");

    const messages = await sql<[{ state: string }]>`
      SELECT state
      FROM ingestion_messages
      WHERE id = ${accepted.messageId}
    `;
    const audits = await sql<
      [{ action: string; error: string; attempts: string }]
    >`
      SELECT
        action,
        details->>'error' AS error,
        details->>'attempts' AS attempts
      FROM audit_entries
      WHERE message_id = ${accepted.messageId}
    `;

    expect(messages[0]).toEqual({ state: "failed" });
    expect(audits[0]).toEqual({
      action: "failed",
      attempts: "5",
      error: "database unavailable",
    });
  });

  test("concurrent redelivery inserts one effect and changes the fact once", async () => {
    const accepted = await acceptMessage(
      scope,
      encoreEnvelopeFor(`concurrent-redelivery-${crypto.randomUUID()}`),
    );
    const before = await sql<
      [{ soldTickets: number; grossSalesCents: string }]
    >`
      SELECT
        sold_tickets AS "soldTickets",
        gross_sales_cents AS "grossSalesCents"
      FROM ticket_facts
      WHERE scope_id = ${scope.scopeId}
        AND show_id = 'show-northstar-summer-hall'
        AND provider = 'encoretix'
        AND currency = 'USD'
    `;

    await Promise.all([
      processMessage(accepted.messageId),
      processMessage(accepted.messageId),
    ]);

    const effects = await sql<[{ count: string }]>`
      SELECT count(*)::text AS count
      FROM normalized_effects
      WHERE message_id = ${accepted.messageId}
    `;
    const after = await sql<[{ soldTickets: number; grossSalesCents: string }]>`
      SELECT
        sold_tickets AS "soldTickets",
        gross_sales_cents AS "grossSalesCents"
      FROM ticket_facts
      WHERE scope_id = ${scope.scopeId}
        AND show_id = 'show-northstar-summer-hall'
        AND provider = 'encoretix'
        AND currency = 'USD'
    `;

    expect(Number(effects[0]!.count)).toBe(1);
    expect(after[0]).toEqual({
      grossSalesCents: String(Number(before[0]!.grossSalesCents) + 700),
      soldTickets: before[0]!.soldTickets + 3,
    });
  });

  test("keeps the highest concurrent snapshot rank in either arrival order", async () => {
    for (const order of [
      ["5", "7"],
      ["7", "5"],
    ]) {
      await sql`
        DELETE FROM ticket_facts
        WHERE scope_id = ${scope.scopeId}
          AND show_id = 'show-northstar-summer-hall'
          AND provider = 'boxgrid'
          AND currency = 'USD'
      `;
      const prefix = `snapshot-${order.join("-")}-${crypto.randomUUID()}`;
      const first = await acceptMessage(
        scope,
        boxGridEnvelopeFor(`${prefix}-first`, order[0]!, Number(order[0]!)),
      );
      const second = await acceptMessage(
        scope,
        boxGridEnvelopeFor(`${prefix}-second`, order[1]!, Number(order[1]!)),
      );

      await Promise.all([
        processMessage(first.messageId),
        processMessage(second.messageId),
      ]);

      const facts = await sql<[{ versionRank: string; soldTickets: number }]>`
        SELECT
          version_rank::text AS "versionRank",
          sold_tickets AS "soldTickets"
        FROM ticket_facts
        WHERE scope_id = ${scope.scopeId}
          AND show_id = 'show-northstar-summer-hall'
          AND provider = 'boxgrid'
          AND currency = 'USD'
      `;

      expect(facts[0]).toEqual({ soldTickets: 7, versionRank: "7" });
    }
  });
});
