import type { FastifyReply } from "fastify";

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function sendError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof HttpError) {
    return reply.status(error.statusCode).send({ error: error.message });
  }

  return reply.status(400).send({ error: "Invalid request" });
}
