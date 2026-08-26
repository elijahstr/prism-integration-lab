import type { FastifyReply } from "fastify";

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function safeStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) {
    return undefined;
  }

  const statusCode = error.statusCode;

  return typeof statusCode === "number" &&
    Number.isInteger(statusCode) &&
    statusCode >= 400 &&
    statusCode <= 599
    ? statusCode
    : undefined;
}

export function sendError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof HttpError) {
    return reply.status(error.statusCode).send({ error: error.message });
  }

  const statusCode = safeStatusCode(error) ?? 500;

  return reply.status(statusCode).send({
    error: statusCode >= 500 ? "Internal server error" : "Invalid request",
  });
}
