import { describe, expect, test } from "bun:test";

import { scoreEventMatch, sumProviderFacts, usd } from "@prism/domain";

describe("domain package public interface", () => {
  test("exports its provider rule functions", () => {
    expect(usd(1)).toEqual({ cents: 1, currency: "USD" });
    expect(sumProviderFacts([])).toEqual({ sold: 0 });
    expect(
      scoreEventMatch({ name: "a", startsAt: "b", venueName: "c" }, []),
    ).toEqual({
      confidence: 0,
      state: "unmatched",
    });
  });
});
