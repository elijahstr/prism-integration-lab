import { describe, expect, test } from "bun:test";

import {
  checksumPayload,
  signEncorePayload,
  verifyEncoreSignature,
} from "./signing";

describe("EncoreTix signing", () => {
  test("verifies a matching HMAC signature", () => {
    const payload = '{"sale":2}';
    const signature = signEncorePayload(payload, "encore-secret");

    expect(verifyEncoreSignature(payload, signature, "encore-secret")).toBe(
      true,
    );
  });

  test("rejects a signature for another payload", () => {
    const signature = signEncorePayload('{"sale":2}', "encore-secret");

    expect(
      verifyEncoreSignature('{"sale":3}', signature, "encore-secret"),
    ).toBe(false);
  });

  test("rejects a non-ASCII signature without throwing", () => {
    expect(() =>
      verifyEncoreSignature("payload", "é".repeat(64), "secret"),
    ).not.toThrow();
    expect(verifyEncoreSignature("payload", "é".repeat(64), "secret")).toBe(
      false,
    );
  });

  test("creates one deterministic checksum for equivalent object key orders", () => {
    expect(checksumPayload({ b: 2, a: { z: 1, y: 2 } })).toBe(
      checksumPayload({ a: { y: 2, z: 1 }, b: 2 }),
    );
  });
});
