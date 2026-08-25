import type { FastifyInstance } from "fastify";
import {
  ProviderEnvelopeSchema,
  type ProviderEnvelope,
} from "@prism/contracts";

import {
  deriveWebhookSecret,
  sql,
} from "../../../../packages/database/src/client";
import { acceptMessage } from "../../../../packages/database/src/ingestion";
import { verifyEncoreSignature } from "../../../../packages/providers/src/encoretix/signing";

import { HttpError } from "../http/errors";
import { parseRawJson } from "../http/raw-json";

const replayWindowMs = 5 * 60 * 1_000;

type Connection = {
  id: string;
  organizationId: string;
  provider: string;
  scopeId: string;
};

function headerValue(value: string | string[] | undefined): string {
  if (typeof value !== "string") {
    throw new HttpError(401, "Webhook credentials are required");
  }

  return value;
}

function assertFresh(envelope: ProviderEnvelope): void {
  const sourceTime = Date.parse(envelope.sourceOccurredAt);

  if (Math.abs(Date.now() - sourceTime) > replayWindowMs) {
    throw new HttpError(401, "Webhook timestamp is outside the replay window");
  }
}

export function registerWebhookRoutes(server: FastifyInstance): void {
  server.post<{ Body: Uint8Array }>(
    "/webhooks/encoretix",
    async (request, reply) => {
      const keyId = headerValue(request.headers["x-encoretix-key-id"]);
      const signature = headerValue(request.headers["x-encoretix-signature"]);
      const connections = await sql<Connection[]>`
      SELECT
        id,
        scope_id AS "scopeId",
        organization_id AS "organizationId",
        provider
      FROM provider_connections
      WHERE public_webhook_key_id = ${keyId}
        AND provider = 'encoretix'
        AND state = 'active'
    `;
      const connection = connections[0];

      if (!connection || connections.length !== 1) {
        throw new HttpError(404, "Webhook connection was not found");
      }

      const raw = request.body;

      if (!(raw instanceof Uint8Array)) {
        throw new HttpError(400, "Webhook body is required");
      }

      if (
        !verifyEncoreSignature(
          raw,
          signature,
          deriveWebhookSecret(connection.id),
        )
      ) {
        throw new HttpError(401, "Webhook signature is invalid");
      }

      let envelope: ProviderEnvelope;

      try {
        envelope = ProviderEnvelopeSchema.parse(parseRawJson(raw));
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }

        throw new HttpError(400, "Webhook envelope is invalid");
      }

      if (
        envelope.provider !== "encoretix" ||
        envelope.connectionId !== connection.id ||
        envelope.scopeId !== connection.scopeId ||
        envelope.organizationId !== connection.organizationId
      ) {
        throw new HttpError(
          403,
          "Webhook envelope scope does not match its connection",
        );
      }
      assertFresh(envelope);

      const accepted = await acceptMessage(
        {
          organizationId: connection.organizationId,
          scopeId: connection.scopeId,
        },
        envelope,
      );

      return reply.status(accepted.status === "accepted" ? 202 : 200).send({
        messageId: accepted.messageId,
        status: accepted.status,
      });
    },
  );
}
