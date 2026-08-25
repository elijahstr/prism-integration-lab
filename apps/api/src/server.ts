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

const scenarioWindowMs = 5 * 60 * 1_000;
const scenarioLimit = 20;
const maxScenarioRateKeys = 10_000;
const scenarioRequests = new Map<string, number[]>();

function leftMostAddress(request: FastifyRequest): string {
  const forwarded = request.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const address = value?.split(",")[0]?.trim();

  return address || request.ip;
}

function scenarioRateLimitKey(request: FastifyRequest): string {
  const tokenHash = createHash("sha256")
    .update(request.headers.authorization ?? "")
    .digest("hex");

  return `${leftMostAddress(request)}:${tokenHash}`;
}

function pruneScenarioRateKeys(now: number): void {
  for (const [key, requests] of scenarioRequests) {
    const activeRequests = requests.filter(
      (requestedAt) => requestedAt > now - scenarioWindowMs,
    );

    if (activeRequests.length === 0) {
      scenarioRequests.delete(key);
      continue;
    }

    scenarioRequests.set(key, activeRequests);
  }

  while (scenarioRequests.size >= maxScenarioRateKeys) {
    const oldestKey = scenarioRequests.keys().next().value;

    if (!oldestKey) {
      return;
    }

    scenarioRequests.delete(oldestKey);
  }
}

function enforceScenarioRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  const now = Date.now();
  const key = scenarioRateLimitKey(request);
  if (!scenarioRequests.has(key)) {
    pruneScenarioRateKeys(now);
  }
  const requests = (scenarioRequests.get(key) ?? []).filter(
    (requestedAt) => requestedAt > now - scenarioWindowMs,
  );

  if (requests.length >= scenarioLimit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((requests[0]! + scenarioWindowMs - now) / 1_000),
    );
    reply.header("retry-after", String(retryAfterSeconds));
    reply.code(429).send({ message: "Too many scenario runs" });
    return true;
  }

  requests.push(now);
  scenarioRequests.set(key, requests);
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
    if (
      request.method === "POST" &&
      request.url.startsWith("/api/lab/scenarios/")
    ) {
      if (enforceScenarioRateLimit(request, reply)) {
        return;
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
