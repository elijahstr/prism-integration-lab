import type { FastifyInstance } from "fastify";

import { replayMessage } from "@prism/database/ingestion";

import { HttpError } from "../http/errors";
import { resolveLabScope } from "../http/lab-scope";

export function registerMessageRoutes(server: FastifyInstance): void {
  server.post<{ Params: { id: string } }>(
    "/api/messages/:id/replay",
    async (request, reply) => {
      const scope = await resolveLabScope(request);
      const replayed = await replayMessage(scope, request.params.id);

      if (replayed === "not_found") {
        throw new HttpError(404, "Message was not found");
      }

      if (replayed === "not_ready") {
        throw new HttpError(409, "Message is not ready for replay");
      }

      return reply.status(202).send({ status: "queued" });
    },
  );
}
