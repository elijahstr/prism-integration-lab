import type {
  MessageDto,
  OverviewDto,
  ProviderDto,
  ReviewDto,
  ShowDto,
  TicketFactDto,
} from "@prism/contracts";

import { sql } from "./client";
import type { Scope } from "./scope";

type OverviewRow = {
  revenueCents: string;
  reviewCount: string;
  syncDelaySeconds: string;
  ticketCount: string;
};
type ProviderRow = Omit<ProviderDto, "lastSuccessfulAt"> & {
  lastSuccessfulAt: Date | null;
};
type ShowRow = Omit<ShowDto, "startsAt"> & {
  startsAt: Date;
};
type MessageRow = Omit<MessageDto, "receivedAt"> & { receivedAt: Date };
type ReviewRow = Omit<ReviewDto, "createdAt"> & { createdAt: Date };

export type MessageEvidence = {
  audit: unknown[];
  effects: unknown[];
  payload: unknown;
};

function toNumber(value: string): number {
  return Number(value);
}

function toIso(value: Date): string {
  return value.toISOString();
}

export async function readOverview(scope: Scope): Promise<OverviewDto> {
  const rows = await sql<OverviewRow[]>`
    SELECT
      COALESCE(sum(gross_sales_cents - refund_cents), 0)::text AS "revenueCents",
      COALESCE(sum(sold_tickets - refunded_tickets), 0)::text AS "ticketCount",
      COALESCE(
        floor(extract(epoch FROM now() - max(updated_at))), 0
      )::text AS "syncDelaySeconds",
      (
        SELECT count(*)
        FROM review_items
        WHERE scope_id = ${scope.scopeId}
          AND organization_id = ${scope.organizationId}
          AND state = 'pending'
      )::text AS "reviewCount"
    FROM ticket_facts
    WHERE scope_id = ${scope.scopeId}
      AND organization_id = ${scope.organizationId}
  `;
  const row = rows[0]!;

  return {
    revenueCents: toNumber(row.revenueCents),
    reviewCount: toNumber(row.reviewCount),
    syncDelaySeconds: Math.max(0, toNumber(row.syncDelaySeconds)),
    ticketCount: toNumber(row.ticketCount),
  };
}

export async function readProviders(scope: Scope): Promise<ProviderDto[]> {
  const rows = await sql<ProviderRow[]>`
    SELECT
      id,
      provider,
      state AS status,
      CASE provider
        WHEN 'encoretix' THEN 'webhook'
        WHEN 'venuewave' THEN 'poll'
        ELSE 'snapshot'
      END AS transport,
      last_successful_at AS "lastSuccessfulAt",
      recent_error AS "recentError"
    FROM provider_connections
    WHERE scope_id = ${scope.scopeId}
      AND organization_id = ${scope.organizationId}
    ORDER BY provider
  `;

  return rows.map((row) => ({
    ...row,
    lastSuccessfulAt: row.lastSuccessfulAt ? toIso(row.lastSuccessfulAt) : null,
  }));
}

export async function readShows(scope: Scope): Promise<ShowDto[]> {
  const rows = await sql<ShowRow[]>`
    SELECT
      shows.id,
      shows.name,
      shows.starts_at AS "startsAt",
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'provider', ticket_facts.provider,
            'soldTickets', ticket_facts.sold_tickets,
            'grossSalesCents', ticket_facts.gross_sales_cents,
            'refundedTickets', ticket_facts.refunded_tickets,
            'refundCents', ticket_facts.refund_cents,
            'inventoryTickets', ticket_facts.inventory_tickets,
            'feeCents', ticket_facts.fee_cents,
            'currency', ticket_facts.currency,
            'sourceVersion', ticket_facts.source_version
          ) ORDER BY ticket_facts.provider
        ) FILTER (WHERE ticket_facts.id IS NOT NULL),
        '[]'::jsonb
      ) AS facts
    FROM shows
    LEFT JOIN ticket_facts
      ON ticket_facts.scope_id = shows.scope_id
      AND ticket_facts.show_id = shows.id
    WHERE shows.scope_id = ${scope.scopeId}
      AND shows.organization_id = ${scope.organizationId}
    GROUP BY shows.id, shows.name, shows.starts_at
    ORDER BY shows.starts_at, shows.id
  `;

  return rows.map((row) => ({
    ...row,
    facts: row.facts as TicketFactDto[],
    startsAt: toIso(row.startsAt),
  }));
}

export async function readMessages(
  scope: Scope,
  cursor?: string,
  limit = 50,
): Promise<MessageDto[]> {
  const rows = await sql<MessageRow[]>`
    SELECT id, provider, delivery_id AS "deliveryId", state,
      received_at AS "receivedAt"
    FROM ingestion_messages
    WHERE scope_id = ${scope.scopeId}
      AND organization_id = ${scope.organizationId}
      AND (
        ${cursor ?? null}::text IS NULL
        OR (received_at, id) > (
          SELECT received_at, id
          FROM ingestion_messages AS cursor_message
          WHERE cursor_message.scope_id = ${scope.scopeId}
            AND cursor_message.organization_id = ${scope.organizationId}
            AND cursor_message.id = ${cursor ?? null}
        )
      )
    ORDER BY received_at, id
    LIMIT ${Math.min(Math.max(limit, 1), 100)}
  `;

  return rows.map((row) => ({ ...row, receivedAt: toIso(row.receivedAt) }));
}

export async function readReviews(
  scope: Scope,
  cursor?: string,
  limit = 50,
): Promise<ReviewDto[]> {
  const rows = await sql<ReviewRow[]>`
    SELECT id, kind, state, created_at AS "createdAt"
    FROM review_items
    WHERE scope_id = ${scope.scopeId}
      AND organization_id = ${scope.organizationId}
      AND (
        ${cursor ?? null}::text IS NULL
        OR (created_at, id) > (
          SELECT created_at, id
          FROM review_items AS cursor_review
          WHERE cursor_review.scope_id = ${scope.scopeId}
            AND cursor_review.organization_id = ${scope.organizationId}
            AND cursor_review.id = ${cursor ?? null}
        )
      )
    ORDER BY created_at, id
    LIMIT ${Math.min(Math.max(limit, 1), 100)}
  `;

  return rows.map((row) => ({ ...row, createdAt: toIso(row.createdAt) }));
}

export async function readMessageEvidence(
  scope: Scope,
  messageId: string,
): Promise<MessageEvidence | null> {
  const messages = await sql<{ payload: unknown }[]>`
    SELECT payload
    FROM ingestion_messages
    WHERE id = ${messageId}
      AND scope_id = ${scope.scopeId}
      AND organization_id = ${scope.organizationId}
  `;
  const message = messages[0];

  if (!message) {
    return null;
  }

  const [audit, effects] = await Promise.all([
    sql`
      SELECT action, details, created_at AS "createdAt"
      FROM audit_entries
      WHERE message_id = ${messageId}
        AND scope_id = ${scope.scopeId}
        AND organization_id = ${scope.organizationId}
      ORDER BY created_at
    `,
    sql`
      SELECT operation_key AS "operationKey", kind, ticket_delta AS "ticketDelta",
        amount_delta_cents AS "amountDeltaCents", currency
      FROM normalized_effects
      WHERE message_id = ${messageId}
        AND scope_id = ${scope.scopeId}
        AND organization_id = ${scope.organizationId}
      ORDER BY operation_key
    `,
  ]);

  return { audit, effects, payload: message.payload };
}
