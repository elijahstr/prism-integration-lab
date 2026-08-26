import { describe, expect, test } from "bun:test";

import { VenueWaveClient } from "./simulator";

describe("VenueWave simulator", () => {
  test("returns a fixture page by cursor", () => {
    const client = new VenueWaveClient([
      { cursor: null, effects: [], nextCursor: "cursor-1" },
    ]);

    expect(client.getPage(null)).toEqual({
      cursor: null,
      effects: [],
      nextCursor: "cursor-1",
    });
  });
});
