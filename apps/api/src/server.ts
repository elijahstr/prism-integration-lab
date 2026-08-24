import Fastify, { type FastifyInstance } from "fastify";

import { sendError } from "./http/errors";
import { MAX_WEBHOOK_BYTES } from "./http/raw-json";
import { registerMessageRoutes } from "./routes/messages";
import { registerReviewRoutes } from "./routes/reviews";
import { registerWebhookRoutes } from "./routes/webhooks";

export function buildServer(): FastifyInstance {
  const server = Fastify({ bodyLimit: MAX_WEBHOOK_BYTES, logger: false });

  server.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_request, body, done) => {
      if (typeof body === "string") {
        done(new Error("Webhook parser requires bytes"));
        return;
      }

      done(null, new Uint8Array(body));
    },
  );
  server.setErrorHandler((error, _request, reply) => sendError(reply, error));
  registerWebhookRoutes(server);
  registerMessageRoutes(server);
  registerReviewRoutes(server);

  return server;
}
