import { describe, expect, test } from "bun:test";

import { VenueWavePayloadSchema } from "./schema";

describe("VenueWave payload schema", () => {
  test("rejects a payload without its next cursor", () => {
    expect(() =>
      VenueWavePayloadSchema.parse({
        effects: [{ amountDeltaCents: 100, kind: "sale", ticketDelta: 1 }],
      }),
    ).toThrow();
  });

  test("rejects an unsafe integer money delta", () => {
    expect(() =>
      VenueWavePayloadSchema.parse({
        effects: [
          {
            amountDeltaCents: Number.MAX_SAFE_INTEGER + 1,
            kind: "sale",
            ticketDelta: 1,
          },
        ],
        nextCursor: "cursor-1",
      }),
    ).toThrow();
  });
});
