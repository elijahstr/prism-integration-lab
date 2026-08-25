import type { FastifyInstance } from "fastify";

import {
  readMessageEvidence,
  readMessages,
  readOverview,
  readProviders,
  readReviews,
  readShows,
} from "@prism/database/reads";

import { HttpError } from "../http/errors";
import { resolveLabScope } from "../http/lab-scope";

function pageValue(value: string | undefined): number {
  const parsed = Number(value ?? "50");

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new HttpError(400, "The page limit must be between 1 and 100");
  }

  return parsed;
}

export function registerDashboardRoutes(server: FastifyInstance): void {
  server.get("/api/overview", async (request) =>
    readOverview(await resolveLabScope(request)),
  );
  server.get("/api/providers", async (request) =>
    readProviders(await resolveLabScope(request)),
  );
  server.get("/api/shows", async (request) =>
    readShows(await resolveLabScope(request)),
  );
  server.get<{ Querystring: { cursor?: string; limit?: string } }>(
    "/api/messages",
    async (request) =>
      readMessages(
        await resolveLabScope(request),
        request.query.cursor,
        pageValue(request.query.limit),
      ),
  );
  server.get<{ Querystring: { cursor?: string; limit?: string } }>(
    "/api/reviews",
    async (request) =>
      readReviews(
        await resolveLabScope(request),
        request.query.cursor,
        pageValue(request.query.limit),
      ),
  );
  server.get<{ Params: { id: string } }>(
    "/api/messages/:id",
    async (request) => {
      const evidence = await readMessageEvidence(
        await resolveLabScope(request),
        request.params.id,
      );

      if (!evidence) {
        throw new HttpError(404, "Message was not found");
      }

      return evidence;
    },
  );
}
