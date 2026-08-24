import { describe, expect, test } from "bun:test";

import { SafeCentsSchema } from "./cents";

describe("provider cents", () => {
  test("rejects an unsafe integer cents value", () => {
    expect(() => SafeCentsSchema.parse(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
});
