import { describe, expect, test } from "bun:test";

import { BoxGridClient } from "./simulator";

describe("BoxGrid simulator", () => {
  test("returns its complete snapshot fixture", () => {
    const client = new BoxGridClient({
      complete: true,
      facts: { grossSalesCents: 1500000, inventory: 400, sold: 600 },
      sequence: "12",
    });

    expect(client.getSnapshot()).toEqual({
      complete: true,
      facts: { grossSalesCents: 1500000, inventory: 400, sold: 600 },
      sequence: "12",
    });
  });
});
