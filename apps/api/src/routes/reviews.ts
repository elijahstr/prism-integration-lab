import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";

import { sql } from "@prism/database";

import { HttpError } from "../http/errors";
import { resolveLabScope } from "../http/lab-scope";

type UpdatedReview = { messageId: string | null };

export function registerReviewRoutes(server: FastifyInstance): void {
  for (const [action, state] of [
    ["approve", "approved"],
    ["reject", "rejected"],
  ] as const) {
    server.post<{ Params: { id: string } }>(
      `/api/reviews/:id/${action}`,
      async (request, reply) => {
        const scope = await resolveLabScope(request);
        const reviews = await sql.begin(async (transaction) => {
          const updated = await transaction<UpdatedReview[]>`
            UPDATE review_items
            SET state = ${state}, resolved_at = now()
            WHERE id = ${request.params.id}
              AND organization_id = ${scope.organizationId}
              AND scope_id = ${scope.scopeId}
            RETURNING message_id AS "messageId"
          `;
          const review = updated[0];

          if (review?.messageId) {
            await transaction`
              INSERT INTO audit_entries (
                id, scope_id, organization_id, message_id, action, details
              )
              VALUES (
                ${randomUUID()},
                ${scope.scopeId},
                ${scope.organizationId},
                ${review.messageId},
                ${`review_${state}`},
                '{}'::jsonb
              )
            `;
          }

          return updated;
        });

        if (reviews.length !== 1) {
          throw new HttpError(404, "Review was not found");
        }

        return reply.send({ state });
      },
    );
  }
}
