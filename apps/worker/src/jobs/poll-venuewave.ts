import { randomUUID } from "node:crypto";

import {
  checksumPayload,
  VenueWavePayloadSchema,
  type VenueWavePollResponse,
} from "@prism/providers";

import { sql } from "@prism/database";

export type VenueWavePageClient = {
  getPage(cursor: string | null): VenueWavePollResponse | undefined;
};

type PollConnection = {
  id: string;
  organizationId: string;
  pollCursor: string | null;
  scopeId: string;
};

export type PollVenueWaveResult =
  | { status: "no_page" }
  | { error: string; status: "temporary_failure" }
  | { retryAfterSeconds: number; status: "rate_limited" }
  | { status: "saved"; nextCursor: string };

export async function pollVenueWave(input: {
  client: VenueWavePageClient;
  connectionId: string;
  deliveryId: string;
  externalEventId: string;
}): Promise<PollVenueWaveResult> {
  return sql.begin(async (transaction) => {
    const connections = await transaction<PollConnection[]>`
      SELECT
        id,
        scope_id AS "scopeId",
        organization_id AS "organizationId",
        poll_cursor AS "pollCursor"
      FROM provider_connections
      WHERE id = ${input.connectionId}
        AND provider = 'venuewave'
        AND state = 'active'
      FOR UPDATE
    `;
    const connection = connections[0];

    if (!connection || connections.length !== 1) {
      throw new Error("VenueWave connection does not exist");
    }

    const page = input.client.getPage(connection.pollCursor);

    if (!page) {
      return { status: "no_page" };
    }

    if ("type" in page) {
      if (page.type === "temporary_failure") {
        return { error: page.error, status: "temporary_failure" };
      }

      return {
        retryAfterSeconds: page.retryAfterSeconds,
        status: "rate_limited",
      };
    }

    if (page.cursor !== connection.pollCursor) {
      throw new Error("VenueWave page cursor does not match the connection");
    }

    const payload = VenueWavePayloadSchema.parse({
      effects: page.effects,
      nextCursor: page.nextCursor,
    });
    const receivedAt = new Date().toISOString();
    const inserted = await transaction<{ id: string }[]>`
      INSERT INTO ingestion_messages (
        id, scope_id, organization_id, connection_id, provider, delivery_id,
        external_event_id, kind, source_occurred_at, received_at, source_version,
        checksum, payload
      )
      VALUES (
        ${randomUUID()},
        ${connection.scopeId},
        ${connection.organizationId},
        ${connection.id},
        'venuewave',
        ${input.deliveryId},
        ${input.externalEventId},
        'sale_delta',
        ${receivedAt},
        ${receivedAt},
        ${connection.pollCursor ?? "initial"},
        ${checksumPayload(payload)},
        ${transaction.json(payload)}
      )
      ON CONFLICT (scope_id, provider, delivery_id) DO NOTHING
      RETURNING id
    `;

    if (inserted.length !== 1) {
      throw new Error("VenueWave delivery already exists");
    }

    await transaction`
      INSERT INTO ingestion_outbox (id, scope_id, organization_id, message_id)
      VALUES (
        ${randomUUID()},
        ${connection.scopeId},
        ${connection.organizationId},
        ${inserted[0]!.id}
      )
    `;
    await transaction`
      UPDATE provider_connections
      SET poll_cursor = ${payload.nextCursor}, last_successful_at = now(), recent_error = NULL, updated_at = now()
      WHERE id = ${connection.id}
        AND scope_id = ${connection.scopeId}
        AND organization_id = ${connection.organizationId}
    `;

    return { status: "saved", nextCursor: payload.nextCursor };
  });
}
