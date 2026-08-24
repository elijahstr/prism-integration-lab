import { TextDecoder } from "node:util";

import { HttpError } from "./errors";

export const MAX_WEBHOOK_BYTES = 1_048_576;

export function parseRawJson(raw: Uint8Array): unknown {
  if (raw.byteLength > MAX_WEBHOOK_BYTES) {
    throw new HttpError(413, "Webhook body is too large");
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    throw new HttpError(400, "Webhook body must be valid JSON");
  }
}
