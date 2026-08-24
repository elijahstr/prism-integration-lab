import type { FastifyInstance } from "fastify";

import { replayMessage } from "../../../../packages/database/src/ingestion";

import { HttpError } from "../http/errors";
import { resolveLabScope } from "../http/lab-scope";

export function registerMessageRoutes(server: FastifyInstance): void {
  server.post<{ Params: { id: string } }>(
    "/api/messages/:id/replay",
    async (request, reply) => {
      const scope = await resolveLabScope(request);
      const replayed = await replayMessage(scope, request.params.id);

      if (!replayed) {
        throw new HttpError(404, "Message was not found");
      }

      return reply.status(202).send({ status: "queued" });
    },
  );
}
