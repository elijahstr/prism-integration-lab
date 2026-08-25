import { beforeAll, describe, expect, test } from "bun:test";

import type { ProviderEnvelope } from "../../../../packages/contracts/src/provider-envelope";
import { sql, type Scope } from "@prism/database";
import { acceptMessage, replayMessage } from "@prism/database/ingestion";
import { migrate } from "@prism/database/migrate";
import { seed } from "@prism/database/seed";

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
    const queuedJob = await ingestionQueue.getJob(`${accepted.messageId}-2`);
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
    expect(queuedJob?.id).toBe(`${accepted.messageId}-2`);
    expect(queuedJob?.opts).toEqual(
      expect.objectContaining({
        attempts: 5,
        backoff: { delay: 1000, type: "exponential" },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: true,
      }),
    );
    expect(outbox[0]).toEqual({ dispatchAttempts: 2, isDispatched: true });

    await processMessage(accepted.messageId, scope);
    await processMessage(accepted.messageId, scope);
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

  test("executes an approved needs-review message in a new queue attempt", async () => {
    const externalEventId = `unmapped-${crypto.randomUUID()}`;
    const accepted = await acceptMessage(scope, {
      ...envelopeFor(`needs-review-replay-${crypto.randomUUID()}`),
      externalEventId,
    });
    await sql`
      UPDATE ingestion_outbox
      SET created_at = '2000-01-01T00:00:00.000Z'
      WHERE message_id = ${accepted.messageId}
    `;
    const completedJobIds = new Set<string>();
    let executions = 0;
    const executingQueue = {
      async add(
        _name: string,
        data: { messageId: string; organizationId: string; scopeId: string },
        options: { jobId: string },
      ) {
        if (completedJobIds.has(options.jobId)) {
          return;
        }

        completedJobIds.add(options.jobId);
        executions += 1;
        await processMessage(data.messageId, {
          organizationId: data.organizationId,
          scopeId: data.scopeId,
        });
      },
    };

    await dispatchOutboxBatch(executingQueue, 1);
    expect(
      Array.from(
        await sql<{ state: string }[]>`
          SELECT state FROM ingestion_messages WHERE id = ${accepted.messageId}
        `,
      ),
    ).toEqual([{ state: "needs_review" }]);

    await sql`
      INSERT INTO event_mappings (
        id, scope_id, organization_id, connection_id, provider,
        external_event_id, show_id, state
      )
      VALUES (
        ${`mapping-${crypto.randomUUID()}`}, ${scope.scopeId},
        ${scope.organizationId}, 'connection-northstar-encoretix',
        'encoretix', ${externalEventId}, 'show-northstar-summer-hall',
        'confirmed'
      )
    `;
    await sql`
      INSERT INTO review_items (
        id, scope_id, organization_id, message_id, kind, state, resolved_at
      )
      VALUES (
        ${`review-${crypto.randomUUID()}`}, ${scope.scopeId},
        ${scope.organizationId}, ${accepted.messageId},
        'uncertain_event_match', 'approved', now()
      )
    `;

    await expect(replayMessage(scope, accepted.messageId)).resolves.toBe(
      "replayed",
    );
    await dispatchOutboxBatch(executingQueue, 1);

    expect(executions).toBe(2);
    expect(completedJobIds).toEqual(
      new Set([`${accepted.messageId}-1`, `${accepted.messageId}-2`]),
    );
    expect(
      Array.from(
        await sql<{ state: string }[]>`
          SELECT state FROM ingestion_messages WHERE id = ${accepted.messageId}
        `,
      ),
    ).toEqual([{ state: "applied" }]);
  });
});
