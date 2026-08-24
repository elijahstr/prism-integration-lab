import { describe, expect, test } from "bun:test";

import { EncoreTixPayloadSchema } from "./schema";

describe("EncoreTix payload schema", () => {
  test("rejects a decimal money delta", () => {
    expect(() =>
      EncoreTixPayloadSchema.parse({
        effects: [{ amountDeltaCents: 10.5, kind: "sale", ticketDelta: 1 }],
      }),
    ).toThrow();
  });

  test("rejects an unsafe integer money delta", () => {
    expect(() =>
      EncoreTixPayloadSchema.parse({
        effects: [
          {
            amountDeltaCents: Number.MAX_SAFE_INTEGER + 1,
            kind: "sale",
            ticketDelta: 1,
          },
        ],
      }),
    ).toThrow();
  });
});
