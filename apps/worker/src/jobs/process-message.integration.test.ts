import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type { ProviderEnvelope } from "../../../../packages/contracts/src/provider-envelope";
import { sql, type Scope } from "@prism/database";
import { acceptMessage } from "@prism/database/ingestion";
import { migrate } from "@prism/database/migrate";
import { seed } from "@prism/database/seed";

import { processMessage, processQueueJob } from "./process-message";

const scope: Scope = {
  organizationId: "organization-northstar",
  scopeId: "scope-northstar-baseline",
};

const otherScope: Scope = {
  organizationId: "organization-harborlight",
  scopeId: "scope-harborlight-baseline",
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

async function dropConflictRaceTrigger(): Promise<void> {
  const triggers = await sql`
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'prism_test_pause_conflict_race'
      AND NOT tgisinternal
  `;

  if (triggers.length !== 0) {
    await sql`DROP TRIGGER prism_test_pause_conflict_race ON ingestion_messages`;
  }
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
  await sql`
    CREATE OR REPLACE FUNCTION prism_test_pause_conflict_race()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF (
        NEW.delivery_id LIKE 'conflict-first-%'
        AND NEW.state = 'needs_review'
      ) OR (
        NEW.delivery_id LIKE 'worker-first-%'
        AND NEW.state = 'processing'
      ) THEN
        PERFORM pg_sleep(0.15);
      END IF;

      RETURN NEW;
    END;
    $$;
  `;
  await dropConflictRaceTrigger();
  await sql`
    CREATE TRIGGER prism_test_pause_conflict_race
    BEFORE UPDATE OF state ON ingestion_messages
    FOR EACH ROW
    EXECUTE FUNCTION prism_test_pause_conflict_race()
  `;
});

afterAll(async () => {
  await dropConflictRaceTrigger();
  await sql`DROP FUNCTION IF EXISTS prism_test_pause_conflict_race()`;
});

describe("message processing", () => {
  test("rejects a message identifier outside the supplied internal scope", async () => {
    const accepted = await acceptMessage(
      scope,
      encoreEnvelopeFor(`wrong-processing-scope-${crypto.randomUUID()}`),
    );

    await expect(
      processMessage(accepted.messageId, otherScope),
    ).rejects.toThrow("Ingestion message does not exist");
  });

  test("does not fail a message outside the queued internal scope", async () => {
    const accepted = await acceptMessage(
      scope,
      encoreEnvelopeFor(`wrong-failure-scope-${crypto.randomUUID()}`),
    );

    await expect(
      processQueueJob(
        {
          attemptsMade: 4,
          data: {
            messageId: accepted.messageId,
            organizationId: otherScope.organizationId,
            scopeId: otherScope.scopeId,
          },
        },
        async () => {
          throw new Error("database unavailable");
        },
      ),
    ).rejects.toThrow("Ingestion message does not exist");
    expect(
      Array.from(
        await sql<{ state: string }[]>`
          SELECT state FROM ingestion_messages WHERE id = ${accepted.messageId}
        `,
      ),
    ).toEqual([{ state: "received" }]);
  });

  test("keeps the conflicting payload out when conflict locks the delivery first", async () => {
    const deliveryId = `conflict-first-${crypto.randomUUID()}`;
    const accepted = await acceptMessage(scope, encoreEnvelopeFor(deliveryId));
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
    const conflict = {
      ...encoreEnvelopeFor(deliveryId),
      checksum: `sha256:conflict-${deliveryId}`,
      payload: {
        effects: [{ amountDeltaCents: 9900, kind: "sale", ticketDelta: 99 }],
      },
    };

    const conflictResult = acceptMessage(scope, conflict);
    await Bun.sleep(25);
    const processingResult = processMessage(accepted.messageId, scope);

    await Promise.all([conflictResult, processingResult]);

    expect(
      Array.from(
        await sql<[{ state: string }]>`
          SELECT state FROM ingestion_messages WHERE id = ${accepted.messageId}
        `,
      ),
    ).toEqual([{ state: "needs_review" }]);
    expect(
      await sql<[{ soldTickets: number; grossSalesCents: string }]>`
        SELECT
          sold_tickets AS "soldTickets",
          gross_sales_cents AS "grossSalesCents"
        FROM ticket_facts
        WHERE scope_id = ${scope.scopeId}
          AND show_id = 'show-northstar-summer-hall'
          AND provider = 'encoretix'
          AND currency = 'USD'
      `,
    ).toEqual(before);
  });

  test("keeps prior facts and applied state when processing locks the delivery first", async () => {
    const deliveryId = `worker-first-${crypto.randomUUID()}`;
    const accepted = await acceptMessage(scope, encoreEnvelopeFor(deliveryId));
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
    const conflict = {
      ...encoreEnvelopeFor(deliveryId),
      checksum: `sha256:conflict-${deliveryId}`,
      payload: {
        effects: [{ amountDeltaCents: 9900, kind: "sale", ticketDelta: 99 }],
      },
    };

    const processingResult = processMessage(accepted.messageId, scope);
    await Bun.sleep(25);
    const conflictResult = acceptMessage(scope, conflict);

    await Promise.all([processingResult, conflictResult]);

    expect(
      Array.from(
        await sql<[{ state: string }]>`
          SELECT state FROM ingestion_messages WHERE id = ${accepted.messageId}
        `,
      ),
    ).toEqual([{ state: "applied" }]);
    expect(
      Array.from(
        await sql<[{ soldTickets: number; grossSalesCents: string }]>`
          SELECT
            sold_tickets AS "soldTickets",
            gross_sales_cents AS "grossSalesCents"
          FROM ticket_facts
          WHERE scope_id = ${scope.scopeId}
            AND show_id = 'show-northstar-summer-hall'
            AND provider = 'encoretix'
            AND currency = 'USD'
        `,
      ),
    ).toEqual([
      {
        grossSalesCents: String(Number(before[0]!.grossSalesCents) + 700),
        soldTickets: before[0]!.soldTickets + 3,
      },
    ]);
    expect(
      Array.from(
        await sql<[{ count: string }]>`
          SELECT count(*)::text AS count
          FROM review_items
          WHERE message_id = ${accepted.messageId}
            AND kind = 'checksum_conflict'
            AND state = 'pending'
        `,
      ),
    ).toEqual([{ count: "1" }]);
  });

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

    await expect(processMessage(accepted.messageId, scope)).resolves.toBe(
      "needs_review",
    );
    expect(
      Array.from(
        await sql<{ facts: string; staged: string; action: string }[]>`
          SELECT
            (SELECT count(*)::text FROM ticket_facts
              WHERE scope_id = ${scope.scopeId} AND provider = 'boxgrid') AS facts,
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

    await expect(processMessage(accepted.messageId, scope)).resolves.toBe(
      "applied",
    );
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
        {
          attemptsMade: 0,
          data: {
            messageId: "transient-message",
            organizationId: scope.organizationId,
            scopeId: scope.scopeId,
          },
        },
        processor,
      ),
    ).rejects.toThrow("temporary database error");
    await expect(
      processQueueJob(
        {
          attemptsMade: 1,
          data: {
            messageId: "transient-message",
            organizationId: scope.organizationId,
            scopeId: scope.scopeId,
          },
        },
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
        {
          attemptsMade: 4,
          data: {
            messageId: accepted.messageId,
            organizationId: scope.organizationId,
            scopeId: scope.scopeId,
          },
        },
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
      processMessage(accepted.messageId, scope),
      processMessage(accepted.messageId, scope),
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
        processMessage(first.messageId, scope),
        processMessage(second.messageId, scope),
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
