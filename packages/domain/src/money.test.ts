import { describe, expect, test } from "bun:test";

import { parseUsdMoney, usd } from "./money";

describe("USD money", () => {
  test("keeps a whole-cent USD amount without floating point conversion", () => {
    expect(usd(1999)).toEqual({ cents: 1999, currency: "USD" });
  });

  test("rejects a decimal cent amount", () => {
    expect(() => usd(1999.5)).toThrow("integer cents");
  });

  test("rejects a non-USD amount", () => {
    expect(() => parseUsdMoney({ cents: 1999, currency: "EUR" })).toThrow(
      "USD",
    );
  });
});
