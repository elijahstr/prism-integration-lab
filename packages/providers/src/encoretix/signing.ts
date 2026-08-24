import { createHmac, createHash, timingSafeEqual } from "node:crypto";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const serialized = JSON.stringify(value);

    if (serialized === undefined) {
      throw new Error("Checksum payload must be JSON serializable");
    }

    return serialized;
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);

  return `{${entries.join(",")}}`;
}

export function signEncorePayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyEncoreSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = signEncorePayload(payload, secret);
  const providedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);

  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }

  return timingSafeEqual(providedBytes, expectedBytes);
}

export function checksumPayload(payload: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(payload)).digest("hex")}`;
}
