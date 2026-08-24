import { describe, expect, test } from "bun:test";

import {
  checksumPayload,
  signEncorePayload,
  verifyEncoreSignature,
} from "./signing";

const signRawPayload: (payload: Uint8Array, secret: string) => string =
  signEncorePayload;
const verifyRawPayload: (
  payload: Uint8Array,
  signature: string,
  secret: string,
) => boolean = verifyEncoreSignature;

describe("EncoreTix signing", () => {
  test("verifies exact raw webhook bytes", () => {
    const payload = Uint8Array.from([
      0x7b, 0x22, 0x73, 0x61, 0x6c, 0x65, 0xff, 0x7d,
    ]);
    const signature = signEncorePayload(payload, "encore-secret");

    expect(signRawPayload).toBe(signEncorePayload);
    expect(verifyRawPayload).toBe(verifyEncoreSignature);

    expect(verifyEncoreSignature(payload, signature, "encore-secret")).toBe(
      true,
    );
  });

  test("rejects decoded raw bytes that do not match the signed bytes", () => {
    const rawPayload = Uint8Array.from([
      0x7b, 0x22, 0x73, 0x61, 0x6c, 0x65, 0xff, 0x7d,
    ]);
    const decodedPayload = new TextEncoder().encode(
      new TextDecoder().decode(rawPayload),
    );
    const signature = signEncorePayload(rawPayload, "encore-secret");

    expect(
      verifyEncoreSignature(decodedPayload, signature, "encore-secret"),
    ).toBe(false);
  });

  test("rejects a non-ASCII signature without throwing", () => {
    expect(() =>
      verifyEncoreSignature(Uint8Array.from([0x70]), "é".repeat(64), "secret"),
    ).not.toThrow();
    expect(
      verifyEncoreSignature(Uint8Array.from([0x70]), "é".repeat(64), "secret"),
    ).toBe(false);
  });

  test("creates one deterministic checksum for equivalent object key orders", () => {
    expect(checksumPayload({ b: 2, a: { z: 1, y: 2 } })).toBe(
      checksumPayload({ a: { y: 2, z: 1 }, b: 2 }),
    );
  });
});
