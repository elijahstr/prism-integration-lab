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
  status: "accepted" | "duplicate";
};

export type OutboxRow = {
  dispatchAttempts: number;
  id: string;
  messageId: string;
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
      const duplicates = await transaction<{ id: string }[]>`
        SELECT id
        FROM ingestion_messages
        WHERE scope_id = ${scope.scopeId}
          AND organization_id = ${scope.organizationId}
          AND provider = ${envelope.provider}
          AND delivery_id = ${envelope.deliveryId}
      `;

      return { status: "duplicate", messageId: duplicates[0]!.id };
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
        outbox.message_id AS "messageId",
        outbox.dispatch_attempts AS "dispatchAttempts"
    `,
  );
}

export async function markOutboxDispatched(id: string): Promise<void> {
  await sql`
    UPDATE ingestion_outbox
    SET dispatched_at = now()
    WHERE id = ${id}
      AND dispatched_at IS NULL
  `;
}
