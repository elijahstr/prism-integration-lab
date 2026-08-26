import { randomUUID } from "node:crypto";

import {
  ProviderEnvelopeSchema,
  type ProviderEnvelope,
} from "@prism/contracts";
import type { JSONValue } from "postgres";

import { sql } from "./client";
import type { Scope } from "./scope";

export type AcceptMessageResult = {
  messageId: string;
  status: "accepted" | "checksum_conflict" | "duplicate";
};

export type OutboxRow = {
  dispatchAttempts: number;
  id: string;
  messageId: string;
  organizationId: string;
  scopeId: string;
};

function assertEnvelopeScope(scope: Scope, envelope: ProviderEnvelope): void {
  if (
    scope.scopeId !== envelope.scopeId ||
    scope.organizationId !== envelope.organizationId
  ) {
    throw new Error("Envelope scope does not match the requested scope");
  }
}

function asJsonValue(payload: unknown): JSONValue {
  let serialized: string | undefined;

  try {
    serialized = JSON.stringify(payload);
  } catch {
    throw new Error("Envelope payload must be JSON serializable");
  }

  if (serialized === undefined) {
    throw new Error("Envelope payload must be JSON serializable");
  }

  return JSON.parse(serialized) as JSONValue;
}

export async function acceptMessage(
  scope: Scope,
  unvalidatedEnvelope: ProviderEnvelope,
): Promise<AcceptMessageResult> {
  const envelope = ProviderEnvelopeSchema.parse(unvalidatedEnvelope);
  assertEnvelopeScope(scope, envelope);
  const payload = asJsonValue(envelope.payload);

  return sql.begin(async (transaction) => {
    const connections = await transaction`
      SELECT 1
      FROM provider_connections
      WHERE scope_id = ${scope.scopeId}
        AND organization_id = ${scope.organizationId}
        AND id = ${envelope.connectionId}
        AND provider = ${envelope.provider}
        AND state = 'active'
    `;

    if (connections.length !== 1) {
      throw new Error(
        "Provider connection does not belong to the requested scope",
      );
    }

    const messageId = randomUUID();
    const inserted = await transaction<{ id: string }[]>`
      INSERT INTO ingestion_messages (
        id,
        scope_id,
        organization_id,
        connection_id,
        provider,
        delivery_id,
        external_event_id,
        kind,
        source_occurred_at,
        received_at,
        source_version,
        checksum,
        payload
      )
      VALUES (
        ${messageId},
        ${scope.scopeId},
        ${scope.organizationId},
        ${envelope.connectionId},
        ${envelope.provider},
        ${envelope.deliveryId},
        ${envelope.externalEventId},
        ${envelope.kind},
        ${envelope.sourceOccurredAt},
        ${envelope.receivedAt},
        ${envelope.sourceVersion},
        ${envelope.checksum},
        ${transaction.json(payload)}
      )
      ON CONFLICT (scope_id, provider, delivery_id) DO NOTHING
      RETURNING id
    `;

    if (inserted.length === 0) {
      const duplicates = await transaction<
        { checksum: string; id: string; state: string }[]
      >`
        SELECT id, checksum, state
        FROM ingestion_messages
        WHERE scope_id = ${scope.scopeId}
          AND organization_id = ${scope.organizationId}
          AND provider = ${envelope.provider}
          AND delivery_id = ${envelope.deliveryId}
        FOR UPDATE
      `;

      const duplicate = duplicates[0];

      if (!duplicate) {
        throw new Error("Duplicate delivery was not found");
      }

      if (duplicate.checksum === envelope.checksum) {
        return { status: "duplicate", messageId: duplicate.id };
      }

      if (duplicate.state !== "applied") {
        await transaction`
          UPDATE ingestion_messages
          SET state = 'needs_review'
          WHERE scope_id = ${scope.scopeId}
            AND organization_id = ${scope.organizationId}
            AND id = ${duplicate.id}
        `;
      }
      const details = {
        firstChecksum: duplicate.checksum,
        repeatedChecksum: envelope.checksum,
      };
      await transaction`
        INSERT INTO audit_entries (
          id, scope_id, organization_id, message_id, action, details
        )
        VALUES (
          ${randomUUID()},
          ${scope.scopeId},
          ${scope.organizationId},
          ${duplicate.id},
          'checksum_conflict',
          ${transaction.json(details)}
        )
      `;
      await transaction`
        INSERT INTO review_items (
          id, scope_id, organization_id, message_id, kind, details
        )
        SELECT
          ${randomUUID()},
          ${scope.scopeId},
          ${scope.organizationId},
          ${duplicate.id},
          'checksum_conflict',
          ${transaction.json(details)}
        WHERE NOT EXISTS (
          SELECT 1
          FROM review_items
          WHERE scope_id = ${scope.scopeId}
            AND organization_id = ${scope.organizationId}
            AND message_id = ${duplicate.id}
            AND kind = 'checksum_conflict'
            AND state = 'pending'
        )
      `;

      return { status: "checksum_conflict", messageId: duplicate.id };
    }

    await transaction`
      INSERT INTO ingestion_outbox (id, scope_id, organization_id, message_id)
      VALUES (
        ${randomUUID()},
        ${scope.scopeId},
        ${scope.organizationId},
        ${inserted[0]!.id}
      )
    `;

    return { status: "accepted", messageId: inserted[0]!.id };
  });
}

export type ReplayMessageResult = "not_found" | "not_ready" | "replayed";

type ReplayableMessage = {
  connectionId: string;
  externalEventId: string;
  id: string;
  provider: string;
  state: string;
};

export async function replayMessage(
  scope: Scope,
  messageId: string,
): Promise<ReplayMessageResult> {
  return sql.begin(async (transaction) => {
    const messages = await transaction<ReplayableMessage[]>`
      SELECT
        id,
        state,
        connection_id AS "connectionId",
        external_event_id AS "externalEventId",
        provider
      FROM ingestion_messages
      WHERE id = ${messageId}
        AND organization_id = ${scope.organizationId}
        AND scope_id = ${scope.scopeId}
      FOR UPDATE
    `;

    if (messages.length !== 1) {
      return "not_found";
    }

    const message = messages[0]!;

    if (message.state !== "failed" && message.state !== "needs_review") {
      return "not_ready";
    }

    if (message.state === "needs_review") {
      const reviews = await transaction<{ state: string }[]>`
        SELECT state
        FROM review_items
        WHERE message_id = ${message.id}
          AND organization_id = ${scope.organizationId}
          AND scope_id = ${scope.scopeId}
      `;

      if (
        reviews.length === 0 ||
        reviews.some((review) => review.state !== "approved")
      ) {
        return "not_ready";
      }

      const mappings = await transaction`
        SELECT 1
        FROM event_mappings
        WHERE scope_id = ${scope.scopeId}
          AND organization_id = ${scope.organizationId}
          AND connection_id = ${message.connectionId}
          AND provider = ${message.provider}
          AND external_event_id = ${message.externalEventId}
          AND state = 'confirmed'
      `;

      if (mappings.length !== 1) {
        return "not_ready";
      }
    }

    await transaction`
      UPDATE ingestion_messages
      SET state = 'received'
      WHERE id = ${messageId}
        AND organization_id = ${scope.organizationId}
        AND scope_id = ${scope.scopeId}
    `;
    await transaction`
      INSERT INTO ingestion_outbox (id, scope_id, organization_id, message_id)
      VALUES (
        ${randomUUID()},
        ${scope.scopeId},
        ${scope.organizationId},
        ${messageId}
      )
      ON CONFLICT (message_id) DO UPDATE
      SET dispatched_at = NULL, last_claimed_at = NULL
    `;
    await transaction`
      INSERT INTO audit_entries (
        id, scope_id, organization_id, message_id, action, details
      )
      VALUES (
        ${randomUUID()},
        ${scope.scopeId},
        ${scope.organizationId},
        ${messageId},
        'replayed',
        '{}'::jsonb
      )
    `;

    return "replayed";
  });
}

export async function claimOutbox(limit: number): Promise<OutboxRow[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Outbox claim limit must be a positive integer");
  }

  return sql.begin(
    async (transaction) =>
      transaction<OutboxRow[]>`
      WITH candidates AS (
        SELECT id
        FROM ingestion_outbox
        WHERE dispatched_at IS NULL
        ORDER BY created_at, id
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE ingestion_outbox AS outbox
      SET
        dispatch_attempts = outbox.dispatch_attempts + 1,
        last_claimed_at = now()
      FROM candidates
      WHERE outbox.id = candidates.id
      RETURNING
        outbox.id,
        outbox.scope_id AS "scopeId",
        outbox.organization_id AS "organizationId",
        outbox.message_id AS "messageId",
        outbox.dispatch_attempts AS "dispatchAttempts"
    `,
  );
}

export async function markOutboxDispatched(id: string): Promise<void> {
  await sql.begin(async (transaction) => {
    const dispatched = await transaction<
      { messageId: string; scopeId: string }[]
    >`
      UPDATE ingestion_outbox
      SET dispatched_at = now()
      WHERE id = ${id}
        AND dispatched_at IS NULL
      RETURNING message_id AS "messageId", scope_id AS "scopeId"
    `;

    if (dispatched.length === 0) {
      return;
    }

    await transaction`
      UPDATE ingestion_messages
      SET state = 'queued'
      WHERE scope_id = ${dispatched[0]!.scopeId}
        AND id = ${dispatched[0]!.messageId}
        AND state = 'received'
    `;
  });
}

export async function markMessageFailed(
  messageId: string,
  error: string,
  attempts: number,
  scope: Scope,
): Promise<void> {
  await sql.begin(async (transaction) => {
    const messages = await transaction<
      { organizationId: string; scopeId: string }[]
    >`
      SELECT
        organization_id AS "organizationId",
        scope_id AS "scopeId"
      FROM ingestion_messages
      WHERE id = ${messageId}
        AND scope_id = ${scope.scopeId}
        AND organization_id = ${scope.organizationId}
      FOR UPDATE
    `;
    const message = messages[0];

    if (!message) {
      throw new Error("Ingestion message does not exist");
    }

    const failed = await transaction<{ id: string }[]>`
      UPDATE ingestion_messages
      SET state = 'failed'
      WHERE id = ${messageId}
        AND scope_id = ${scope.scopeId}
        AND organization_id = ${scope.organizationId}
        AND state NOT IN ('applied', 'ignored_old', 'needs_review', 'failed')
      RETURNING id
    `;

    if (failed.length === 0) {
      return;
    }

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
        ${messageId},
        'failed',
        ${transaction.json({ attempts, error })}
      )
    `;
  });
}
