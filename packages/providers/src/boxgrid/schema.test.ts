import { describe, expect, test } from "bun:test";

import { BoxGridSnapshotSchema } from "./schema";

describe("BoxGrid snapshot schema", () => {
  test("rejects a snapshot with a decimal ticket total", () => {
    expect(() =>
      BoxGridSnapshotSchema.parse({
        complete: true,
        facts: { grossSalesCents: 100, inventory: 10, sold: 1.5 },
        sequence: "10",
      }),
    ).toThrow();
  });

  test("rejects unsafe integer gross sales cents", () => {
    expect(() =>
      BoxGridSnapshotSchema.parse({
        complete: true,
        facts: {
          grossSalesCents: Number.MAX_SAFE_INTEGER + 1,
          inventory: 10,
          sold: 1,
        },
        sequence: "10",
      }),
    ).toThrow();
  });
});
