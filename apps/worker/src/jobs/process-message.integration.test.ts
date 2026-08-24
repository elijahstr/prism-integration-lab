import { beforeAll, describe, expect, test } from "bun:test";

import type { ProviderEnvelope } from "../../../../packages/contracts/src/provider-envelope";
import { acceptMessage } from "../../../../packages/database/src/ingestion";
import { sql } from "../../../../packages/database/src/client";
import type { Scope } from "../../../../packages/database/src/scope";
import { migrate } from "../../../../packages/database/scripts/migrate";
import { seed } from "../../../../packages/database/scripts/seed";

import { processMessage } from "./process-message";

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
});

describe("message processing", () => {
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
