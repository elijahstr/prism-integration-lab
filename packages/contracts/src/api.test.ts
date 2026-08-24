import { describe, expect, test } from "bun:test";

import { LabSessionDtoSchema } from "./api";

describe("lab session DTO", () => {
  test("accepts the token and UTC expiry returned to the browser", () => {
    expect(
      LabSessionDtoSchema.parse({
        expiresAt: "2026-08-24T12:00:00.000Z",
        token: "token-123",
      }),
    ).toEqual({
      expiresAt: "2026-08-24T12:00:00.000Z",
      token: "token-123",
    });
  });

  test("rejects a session response without a token", () => {
    expect(() =>
      LabSessionDtoSchema.parse({ expiresAt: "2026-08-24T12:00:00.000Z" }),
    ).toThrow();
  });
});
