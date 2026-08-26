import { createHmac } from "node:crypto";

import type { FastifyRequest } from "fastify";

import { sql, type Scope } from "@prism/database";

import { HttpError } from "./errors";

function labTokenHash(token: string): string {
  const pepper = process.env.LAB_TOKEN_PEPPER;

  if (!pepper) {
    throw new Error("LAB_TOKEN_PEPPER is required");
  }

  return createHmac("sha256", pepper).update(token).digest("hex");
}

export async function resolveLabScope(request: FastifyRequest): Promise<Scope> {
  const authorization = request.headers.authorization;
  const token = authorization?.match(/^Lab (.+)$/)?.[1];

  if (!token) {
    throw new HttpError(401, "A lab token is required");
  }

  const sessions = await sql<Scope[]>`
    SELECT
      scope_id AS "scopeId",
      organization_id AS "organizationId"
    FROM demo_sessions
    WHERE token_hash = ${labTokenHash(token)}
      AND state = 'active'
      AND expires_at > now()
  `;
  const scope = sessions[0];

  if (!scope) {
    throw new HttpError(401, "A valid lab token is required");
  }

  return scope;
}
