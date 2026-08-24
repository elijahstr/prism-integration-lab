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
});
