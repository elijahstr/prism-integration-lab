import cors from "@fastify/cors";
import staticPlugin from "@fastify/static";
import { createHash } from "node:crypto";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";

import { sendError } from "./http/errors";
import { MAX_WEBHOOK_BYTES } from "./http/raw-json";
import { registerDashboardRoutes } from "./routes/dashboard";
import { registerLabRoutes } from "./routes/lab";
import type { LabRouteDependencies } from "./routes/lab";
import { registerMessageRoutes } from "./routes/messages";
import { registerReviewRoutes } from "./routes/reviews";
import { registerWebhookRoutes } from "./routes/webhooks";

export type BuildServerOptions = { lab?: LabRouteDependencies };

const rateWindowMs = 5 * 60 * 1_000;
const sessionAddressLimit = 20;
const scenarioLimit = 20;
const maxRateKeys = 10_000;
const sessionAddressRequests = new Map<string, number[]>();
const scenarioAddressRequests = new Map<string, number[]>();
const scenarioTokenRequests = new Map<string, number[]>();

function resolvedClientAddress(request: FastifyRequest): string {
  return request.ip;
}

function requestPathname(request: FastifyRequest): string {
  return new URL(request.url, "http://localhost").pathname;
}

function scenarioRateLimitKey(request: FastifyRequest): string {
  const tokenHash = createHash("sha256")
    .update(request.headers.authorization ?? "")
    .digest("hex");

  return `${resolvedClientAddress(request)}:${tokenHash}`;
}

function pruneRateKeys(
  requestsByKey: Map<string, number[]>,
  now: number,
): void {
  for (const [key, requests] of requestsByKey) {
    const activeRequests = requests.filter(
      (requestedAt) => requestedAt > now - rateWindowMs,
    );

    if (activeRequests.length === 0) {
      requestsByKey.delete(key);
      continue;
    }

    requestsByKey.set(key, activeRequests);
  }

  while (requestsByKey.size >= maxRateKeys) {
    const oldestKey = requestsByKey.keys().next().value;

    if (!oldestKey) {
      return;
    }

    requestsByKey.delete(oldestKey);
  }
}

function enforceRateLimit(
  reply: FastifyReply,
  requestsByKey: Map<string, number[]>,
  key: string,
  limit: number,
): boolean {
  const now = Date.now();
  if (!requestsByKey.has(key)) {
    pruneRateKeys(requestsByKey, now);
  }
  const requests = (requestsByKey.get(key) ?? []).filter(
    (requestedAt) => requestedAt > now - rateWindowMs,
  );

  if (requests.length >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((requests[0]! + rateWindowMs - now) / 1_000),
    );
    reply.header("retry-after", String(retryAfterSeconds));
    reply.code(429).send({ message: "Too many scenario runs" });
    return true;
  }

  requests.push(now);
  requestsByKey.set(key, requests);
  return false;
}

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
  const server = Fastify({
    bodyLimit: MAX_WEBHOOK_BYTES,
    logger: false,
    trustProxy: true,
  });

  if (process.env.NODE_ENV !== "production") {
    server.register(cors, { origin: "http://localhost:3000" });
  }

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
  server.get("/health", async () => ({ status: "ok" }));
  server.addHook("onRequest", (request, reply, done) => {
    if (request.method === "POST") {
      const pathname = requestPathname(request);

      if (
        pathname === "/api/lab/sessions" &&
        enforceRateLimit(
          reply,
          sessionAddressRequests,
          resolvedClientAddress(request),
          sessionAddressLimit,
        )
      ) {
        return;
      }

      if (pathname.startsWith("/api/lab/scenarios/")) {
        if (
          enforceRateLimit(
            reply,
            scenarioTokenRequests,
            scenarioRateLimitKey(request),
            scenarioLimit,
          ) ||
          enforceRateLimit(
            reply,
            scenarioAddressRequests,
            resolvedClientAddress(request),
            scenarioLimit,
          )
        ) {
          return;
        }
      }
    }

    done();
  });
  registerWebhookRoutes(server);
  registerDashboardRoutes(server);
  registerLabRoutes(server, options.lab);
  registerMessageRoutes(server);
  registerReviewRoutes(server);

  return server;
}

export function registerPublicStatic(
  server: FastifyInstance,
  root: string,
): void {
  server.register(staticPlugin, { redirect: true, root });
}
