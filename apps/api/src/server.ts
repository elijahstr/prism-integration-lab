import cors from "@fastify/cors";
import staticPlugin from "@fastify/static";
import { createHash } from "node:crypto";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";

import { HttpError, sendError } from "./http/errors";
import { MAX_WEBHOOK_BYTES } from "./http/raw-json";
import { registerDashboardRoutes } from "./routes/dashboard";
import { registerLabRoutes } from "./routes/lab";
import type { LabRouteDependencies } from "./routes/lab";
import { registerMessageRoutes } from "./routes/messages";
import { registerReviewRoutes } from "./routes/reviews";
import { registerWebhookRoutes } from "./routes/webhooks";

type LogStream = { write(line: string): void };
type RateLimitOptions = Partial<{
  maxKeys: number;
  now(): number;
  scenarioLimit: number;
  sessionAddressLimit: number;
}>;

export type BuildServerOptions = {
  lab?: LabRouteDependencies;
  logStream?: LogStream;
  rateLimit?: RateLimitOptions;
};

const rateWindowMs = 5 * 60 * 1_000;
const defaultSessionAddressLimit = 20;
const defaultScenarioLimit = 20;
const defaultMaxRateKeys = 10_000;

function resolvedClientAddress(request: FastifyRequest): string {
  const forwardedHeader = request.headers["x-forwarded-for"];
  const forwardedAddresses = Array.isArray(forwardedHeader)
    ? forwardedHeader.join(",")
    : forwardedHeader;
  const immediateProxyAddress = forwardedAddresses?.split(",").at(-1)?.trim();

  return immediateProxyAddress || request.socket.remoteAddress || "unknown";
}

function requestPathname(request: FastifyRequest): string {
  return new URL(request.url, "http://localhost").pathname;
}

function scenarioRateLimitKey(
  request: FastifyRequest,
  clientAddress: string,
): string {
  const tokenHash = createHash("sha256")
    .update(request.headers.authorization ?? "")
    .digest("hex");

  return `${clientAddress}:${tokenHash}`;
}

function pruneRateKeys(
  requestsByKey: Map<string, number[]>,
  now: number,
  maxKeys: number,
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

  while (requestsByKey.size >= maxKeys) {
    let earliestExpiryKey: string | undefined;
    let earliestExpiry = Number.POSITIVE_INFINITY;

    for (const [key, requests] of requestsByKey) {
      const fullExpiry = requests.at(-1)! + rateWindowMs;

      if (fullExpiry < earliestExpiry) {
        earliestExpiry = fullExpiry;
        earliestExpiryKey = key;
      }
    }

    if (!earliestExpiryKey) {
      return;
    }

    requestsByKey.delete(earliestExpiryKey);
  }
}

function enforceRateLimit(
  reply: FastifyReply,
  requestsByKey: Map<string, number[]>,
  key: string,
  limit: number,
  maxKeys: number,
  now: number,
): boolean {
  if (!requestsByKey.has(key)) {
    pruneRateKeys(requestsByKey, now, maxKeys);
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
  const rateLimitOptions = options.rateLimit ?? {};
  const maxKeys = rateLimitOptions.maxKeys ?? defaultMaxRateKeys;
  const now = rateLimitOptions.now ?? Date.now;
  const scenarioLimit = rateLimitOptions.scenarioLimit ?? defaultScenarioLimit;
  const sessionAddressLimit =
    rateLimitOptions.sessionAddressLimit ?? defaultSessionAddressLimit;
  const sessionAddressRequests = new Map<string, number[]>();
  const scenarioAddressRequests = new Map<string, number[]>();
  const scenarioTokenRequests = new Map<string, number[]>();
  const logger =
    process.env.NODE_ENV === "production"
      ? {
          level: "info",
          redact: {
            censor: "[Redacted]",
            paths: [
              "req.headers.authorization",
              "req.headers.cookie",
              "res.headers.set-cookie",
            ],
          },
          ...(options.logStream ? { stream: options.logStream } : {}),
        }
      : false;
  const server = Fastify({
    bodyLimit: MAX_WEBHOOK_BYTES,
    logger,
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
  server.setErrorHandler((error, request, reply) => {
    if (!(error instanceof HttpError)) {
      request.log.error({ err: error }, "Unexpected request error");
    }

    return sendError(reply, error);
  });
  server.get("/health", async () => ({ status: "ok" }));
  server.addHook("onRequest", (request, reply, done) => {
    if (request.method === "POST") {
      const pathname = requestPathname(request);
      const clientAddress = resolvedClientAddress(request);
      const requestedAt = now();

      if (
        pathname === "/api/lab/sessions" &&
        enforceRateLimit(
          reply,
          sessionAddressRequests,
          clientAddress,
          sessionAddressLimit,
          maxKeys,
          requestedAt,
        )
      ) {
        return;
      }

      if (pathname.startsWith("/api/lab/scenarios/")) {
        if (
          enforceRateLimit(
            reply,
            scenarioTokenRequests,
            scenarioRateLimitKey(request, clientAddress),
            scenarioLimit,
            maxKeys,
            requestedAt,
          ) ||
          enforceRateLimit(
            reply,
            scenarioAddressRequests,
            clientAddress,
            scenarioLimit,
            maxKeys,
            requestedAt,
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
