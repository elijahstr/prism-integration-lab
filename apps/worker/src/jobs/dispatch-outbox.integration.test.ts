import { beforeAll, describe, expect, test } from "bun:test";

import type { ProviderEnvelope } from "../../../../packages/contracts/src/provider-envelope";
import { acceptMessage } from "../../../../packages/database/src/ingestion";
import { sql } from "../../../../packages/database/src/client";
import type { Scope } from "../../../../packages/database/src/scope";
import { migrate } from "../../../../packages/database/scripts/migrate";
import { seed } from "../../../../packages/database/scripts/seed";

import { dispatchOutboxBatch } from "./dispatch-outbox";
import { processMessage } from "./process-message";
import { ingestionQueue } from "../queue";

const scope: Scope = {
  organizationId: "organization-northstar",
  scopeId: "scope-northstar-baseline",
};

function envelopeFor(deliveryId: string): ProviderEnvelope {
  return {
    checksum: `sha256:${deliveryId}`,
    connectionId: "connection-northstar-encoretix",
    deliveryId,
    externalEventId: "event-fictional-summer-hall",
    kind: "sale_delta",
    organizationId: scope.organizationId,
    payload: {
      effects: [{ amountDeltaCents: 500, kind: "sale", ticketDelta: 2 }],
    },
    provider: "encoretix",
    receivedAt: "2026-08-24T12:35:01.000Z",
    scopeId: scope.scopeId,
    sourceOccurredAt: "2026-08-24T12:34:56.000Z",
    sourceVersion: "2026-08-24T12:34:56.000Z",
  };
}

beforeAll(async () => {
  await migrate();
  await seed();
});

describe("outbox dispatch", () => {
  test("retries an enqueue failure and applies one eventual financial effect", async () => {
    const deliveryId = `dispatch-recovery-${crypto.randomUUID()}`;
    const accepted = await acceptMessage(scope, envelopeFor(deliveryId));
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

    await expect(
      dispatchOutboxBatch({
        add: async () => {
          throw new Error("Redis is unavailable");
        },
      }),
    ).rejects.toThrow("Redis is unavailable");

    const recovered = await dispatchOutboxBatch(ingestionQueue);
    const queuedJob = await ingestionQueue.getJob(accepted.messageId);
    const outbox = await sql<
      [{ dispatchAttempts: number; isDispatched: boolean }]
    >`
      SELECT
        dispatch_attempts AS "dispatchAttempts",
        dispatched_at IS NOT NULL AS "isDispatched"
      FROM ingestion_outbox
      WHERE message_id = ${accepted.messageId}
    `;

    expect(recovered).toBeGreaterThanOrEqual(1);
    expect(queuedJob?.id).toBe(accepted.messageId);
    expect(queuedJob?.opts).toEqual(
      expect.objectContaining({
        attempts: 5,
        backoff: { delay: 1000, type: "exponential" },
        removeOnFail: true,
      }),
    );
    expect(outbox[0]).toEqual({ dispatchAttempts: 2, isDispatched: true });

    await processMessage(accepted.messageId);
    await processMessage(accepted.messageId);
    await queuedJob?.remove();

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
      grossSalesCents: String(Number(before[0]!.grossSalesCents) + 500),
      soldTickets: before[0]!.soldTickets + 2,
    });
  });
});
