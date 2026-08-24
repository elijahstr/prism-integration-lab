import { randomUUID } from "node:crypto";

import type {
  Provider,
  ProviderEnvelope,
} from "../../../../packages/contracts/src/provider-envelope";
import type {
  NormalizedOperation,
  ProviderAdapter,
} from "../../../../packages/domain/src/operations";
import {
  boxGridAdapter,
  BoxGridSnapshotSchema,
  encoreTixAdapter,
  venueWaveAdapter,
} from "../../../../packages/providers/src/index";
import {
  sql,
  type TransactionSql,
} from "../../../../packages/database/src/client";
import { markMessageFailed } from "../../../../packages/database/src/ingestion";

const processingAttempts = 5;

type StoredMessage = {
  checksum: string;
  connectionId: string;
  deliveryId: string;
  externalEventId: string;
  id: string;
  kind: ProviderEnvelope["kind"];
  organizationId: string;
  payload: unknown;
  provider: Provider;
  receivedAt: Date;
  scopeId: string;
  sourceOccurredAt: Date;
  sourceVersion: string;
  state: string;
};

type Mapping = {
  showId: string;
};

export type ProcessMessageResult =
  "already_processed" | "applied" | "ignored_old" | "needs_review";

export type ProcessMessageJob = {
  attemptsMade: number;
  data: { messageId: string };
};

function adapterFor(provider: Provider): ProviderAdapter {
  if (provider === "encoretix") {
    return encoreTixAdapter;
  }

  if (provider === "venuewave") {
    return venueWaveAdapter;
  }

  return boxGridAdapter;
}

function toEnvelope(message: StoredMessage): ProviderEnvelope {
  return {
    checksum: message.checksum,
    connectionId: message.connectionId,
    deliveryId: message.deliveryId,
    externalEventId: message.externalEventId,
    kind: message.kind,
    organizationId: message.organizationId,
    payload: message.payload,
    provider: message.provider,
    receivedAt: message.receivedAt.toISOString(),
    scopeId: message.scopeId,
    sourceOccurredAt: message.sourceOccurredAt.toISOString(),
    sourceVersion: message.sourceVersion,
  };
}

function isProcessable(state: string): boolean {
  return ["processing", "queued", "received"].includes(state);
}

async function writeAudit(
  transaction: TransactionSql,
  message: StoredMessage,
  action: string,
  details: Record<string, string | number>,
): Promise<void> {
  await transaction`
    INSERT INTO audit_entries (
      id,
      scope_id,
      organization_id,
      message_id,
      action,
      details
    )
    VALUES (
      ${randomUUID()},
      ${message.scopeId},
      ${message.organizationId},
      ${message.id},
      ${action},
      ${JSON.stringify(details)}::jsonb
    )
  `;
}

async function stageSnapshot(
  transaction: TransactionSql,
  message: StoredMessage,
): Promise<boolean> {
  const snapshot = BoxGridSnapshotSchema.parse(message.payload);

  await transaction`
    INSERT INTO snapshot_staging (
      id, scope_id, organization_id, message_id, provider, external_event_id,
      version_rank, payload, complete
    )
    VALUES (
      ${randomUUID()},
      ${message.scopeId},
      ${message.organizationId},
      ${message.id},
      ${message.provider},
      ${message.externalEventId},
      ${snapshot.sequence},
      ${JSON.stringify(message.payload)}::jsonb,
      ${snapshot.complete}
    )
  `;

  return snapshot.complete;
}

async function applyAppendOperation(
  transaction: TransactionSql,
  message: StoredMessage,
  mapping: Mapping,
  operation: Extract<NormalizedOperation, { mode: "append" }>,
  lineIndex: number,
): Promise<boolean> {
  const operationKey = `${message.deliveryId}:${lineIndex}`;
  const inserted = await transaction<{ id: string }[]>`
    INSERT INTO normalized_effects (
      id,
      scope_id,
      organization_id,
      message_id,
      provider,
      operation_key,
      kind,
      ticket_delta,
      amount_delta_cents,
      currency
    )
    VALUES (
      ${randomUUID()},
      ${message.scopeId},
      ${message.organizationId},
      ${message.id},
      ${message.provider},
      ${operationKey},
      ${operation.kind},
      ${operation.ticketDelta},
      ${operation.amountDeltaCents},
      ${operation.currency}
    )
    ON CONFLICT (scope_id, provider, operation_key) DO NOTHING
    RETURNING id
  `;

  if (inserted.length === 0) {
    return false;
  }

  const saleTickets = operation.kind === "sale" ? operation.ticketDelta : 0;
  const saleCents = operation.kind === "sale" ? operation.amountDeltaCents : 0;
  const refundTickets = operation.kind === "refund" ? operation.ticketDelta : 0;
  const refundCents =
    operation.kind === "refund" ? operation.amountDeltaCents : 0;
  const inventoryTickets =
    operation.kind === "inventory" ? operation.ticketDelta : 0;
  const feeCents = operation.kind === "fee" ? operation.amountDeltaCents : 0;

  await transaction`
    INSERT INTO ticket_facts (
      id,
      scope_id,
      organization_id,
      show_id,
      connection_id,
      provider,
      sold_tickets,
      gross_sales_cents,
      refunded_tickets,
      refund_cents,
      inventory_tickets,
      fee_cents,
      currency,
      source_version
    )
    VALUES (
      ${randomUUID()},
      ${message.scopeId},
      ${message.organizationId},
      ${mapping.showId},
      ${message.connectionId},
      ${message.provider},
      ${saleTickets},
      ${saleCents},
      ${refundTickets},
      ${refundCents},
      ${inventoryTickets},
      ${feeCents},
      ${operation.currency},
      ${message.sourceVersion}
    )
    ON CONFLICT (scope_id, show_id, provider, currency) DO UPDATE
    SET
      sold_tickets = ticket_facts.sold_tickets + EXCLUDED.sold_tickets,
      gross_sales_cents = ticket_facts.gross_sales_cents + EXCLUDED.gross_sales_cents,
      refunded_tickets = ticket_facts.refunded_tickets + EXCLUDED.refunded_tickets,
      refund_cents = ticket_facts.refund_cents + EXCLUDED.refund_cents,
      inventory_tickets = ticket_facts.inventory_tickets + EXCLUDED.inventory_tickets,
      fee_cents = ticket_facts.fee_cents + EXCLUDED.fee_cents,
      source_version = EXCLUDED.source_version,
      updated_at = now()
  `;

  return true;
}

async function applyReplacementOperation(
  transaction: TransactionSql,
  message: StoredMessage,
  mapping: Mapping,
  operation: Extract<NormalizedOperation, { mode: "replace" }>,
): Promise<boolean> {
  const changed = await transaction<{ id: string }[]>`
    INSERT INTO ticket_facts (
      id,
      scope_id,
      organization_id,
      show_id,
      connection_id,
      provider,
      sold_tickets,
      gross_sales_cents,
      refunded_tickets,
      refund_cents,
      inventory_tickets,
      fee_cents,
      currency,
      source_version,
      version_rank
    )
    VALUES (
      ${randomUUID()},
      ${message.scopeId},
      ${message.organizationId},
      ${mapping.showId},
      ${message.connectionId},
      ${message.provider},
      ${operation.facts.sold},
      ${operation.facts.grossSalesCents},
      0,
      0,
      ${operation.facts.inventory},
      0,
      'USD',
      ${operation.sourceVersion},
      ${operation.versionRank.toString()}
    )
    ON CONFLICT (scope_id, show_id, provider, currency) DO UPDATE
    SET
      sold_tickets = EXCLUDED.sold_tickets,
      gross_sales_cents = EXCLUDED.gross_sales_cents,
      refunded_tickets = EXCLUDED.refunded_tickets,
      refund_cents = EXCLUDED.refund_cents,
      inventory_tickets = EXCLUDED.inventory_tickets,
      fee_cents = EXCLUDED.fee_cents,
      source_version = EXCLUDED.source_version,
      version_rank = EXCLUDED.version_rank,
      updated_at = now()
    WHERE ticket_facts.version_rank IS NULL
      OR ticket_facts.version_rank < EXCLUDED.version_rank
    RETURNING id
  `;

  return changed.length === 1;
}

export async function processMessage(
  messageId: string,
): Promise<ProcessMessageResult> {
  return sql.begin(async (transaction) => {
    const messages = await transaction<StoredMessage[]>`
      SELECT
        id,
        scope_id AS "scopeId",
        organization_id AS "organizationId",
        connection_id AS "connectionId",
        provider,
        delivery_id AS "deliveryId",
        external_event_id AS "externalEventId",
        kind,
        source_occurred_at AS "sourceOccurredAt",
        received_at AS "receivedAt",
        source_version AS "sourceVersion",
        checksum,
        payload,
        state
      FROM ingestion_messages
      WHERE id = ${messageId}
      FOR UPDATE
    `;
    const message = messages[0];

    if (!message) {
      throw new Error("Ingestion message does not exist");
    }

    if (!isProcessable(message.state)) {
      return "already_processed";
    }

    await transaction`
      UPDATE ingestion_messages
      SET state = 'processing'
      WHERE scope_id = ${message.scopeId}
        AND id = ${message.id}
    `;

    if (message.provider === "boxgrid" && message.kind === "snapshot") {
      const isComplete = await stageSnapshot(transaction, message);

      if (!isComplete) {
        await transaction`
          UPDATE ingestion_messages
          SET state = 'needs_review'
          WHERE scope_id = ${message.scopeId}
            AND id = ${message.id}
        `;
        await writeAudit(transaction, message, "snapshot_incomplete", {
          sequence: (message.payload as { sequence: string }).sequence,
        });

        return "needs_review";
      }
    }

    const mappings = await transaction<Mapping[]>`
      SELECT show_id AS "showId"
      FROM event_mappings
      WHERE scope_id = ${message.scopeId}
        AND organization_id = ${message.organizationId}
        AND connection_id = ${message.connectionId}
        AND provider = ${message.provider}
        AND external_event_id = ${message.externalEventId}
        AND state = 'confirmed'
    `;
    const mapping = mappings[0];

    if (!mapping) {
      await transaction`
        UPDATE ingestion_messages
        SET state = 'needs_review'
        WHERE scope_id = ${message.scopeId}
          AND id = ${message.id}
      `;
      await writeAudit(transaction, message, "needs_review", {
        reason: "missing_confirmed_event_mapping",
      });
      return "needs_review";
    }

    const operations = adapterFor(message.provider).parse(toEnvelope(message));
    let appendCount = 0;
    let replacementWasIgnored = false;

    for (const [lineIndex, operation] of operations.entries()) {
      if (operation.mode === "append") {
        if (
          await applyAppendOperation(
            transaction,
            message,
            mapping,
            operation,
            lineIndex,
          )
        ) {
          appendCount += 1;
        }
      } else if (
        !(await applyReplacementOperation(
          transaction,
          message,
          mapping,
          operation,
        ))
      ) {
        replacementWasIgnored = true;
      }
    }

    const result: ProcessMessageResult = replacementWasIgnored
      ? "ignored_old"
      : "applied";
    await transaction`
      UPDATE ingestion_messages
      SET state = ${result}
      WHERE scope_id = ${message.scopeId}
        AND id = ${message.id}
    `;
    await writeAudit(transaction, message, result, {
      appendEffectsApplied: appendCount,
      operations: operations.length,
    });

    return result;
  });
}

export async function processQueueJob(
  job: ProcessMessageJob,
  processor: (
    messageId: string,
  ) => Promise<ProcessMessageResult> = processMessage,
): Promise<ProcessMessageResult> {
  try {
    return await processor(job.data.messageId);
  } catch (error) {
    if (job.attemptsMade + 1 === processingAttempts) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await markMessageFailed(job.data.messageId, message, processingAttempts);
    }

    throw error;
  }
}
