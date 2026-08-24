import { sql } from "./client";

export type Scope = {
  organizationId: string;
  scopeId: string;
};

export type ScopedMessage = {
  deliveryId: string;
  id: string;
  provider: string;
  receivedAt: Date;
  scopeId: string;
  state: string;
};

export type ScopedRepository = {
  listMessages(deliveryId?: string): Promise<ScopedMessage[]>;
};

function scopedRepository(scope: Scope): ScopedRepository {
  return {
    async listMessages(deliveryId?: string) {
      return sql<ScopedMessage[]>`
        SELECT
          id,
          scope_id AS "scopeId",
          provider,
          delivery_id AS "deliveryId",
          state,
          received_at AS "receivedAt"
        FROM ingestion_messages
        WHERE scope_id = ${scope.scopeId}
          AND organization_id = ${scope.organizationId}
          AND (${deliveryId ?? null}::text IS NULL OR delivery_id = ${deliveryId ?? null})
        ORDER BY received_at, id
      `;
    },
  };
}

export async function withScope<T>(
  scope: Scope,
  query: (repository: ScopedRepository) => Promise<T>,
): Promise<T> {
  const scopes = await sql`
    SELECT 1
    FROM data_scopes
    WHERE scope_id = ${scope.scopeId}
      AND organization_id = ${scope.organizationId}
  `;

  if (scopes.length !== 1) {
    throw new Error("Unknown scope");
  }

  return query(scopedRepository(scope));
}

export function listMessages(
  scope: Scope,
  deliveryId?: string,
): Promise<ScopedMessage[]> {
  return withScope(scope, (repository) => repository.listMessages(deliveryId));
}
