import { describe, expect, test } from "bun:test";

import { compareProviderVersion } from "./version";

describe("provider versions", () => {
  test("compares EncoreTix timestamps chronologically", () => {
    expect(
      compareProviderVersion(
        "encoretix",
        "2026-08-24T12:34:57.000Z",
        "2026-08-24T12:34:56.000Z",
      ),
    ).toBe(1);
  });

  test("compares VenueWave cursor versions lexically", () => {
    expect(compareProviderVersion("venuewave", "cursor-10", "cursor-9")).toBe(
      -1,
    );
  });

  test("compares BoxGrid sequence versions as bigint ranks", () => {
    expect(
      compareProviderVersion("boxgrid", "9007199254740993", "9007199254740992"),
    ).toBe(1);
  });
});
