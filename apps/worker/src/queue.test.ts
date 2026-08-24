import { describe, expect, test } from "bun:test";

import { bullMqConnection, getBullMqConnection } from "./queue";

describe("BullMQ connection", () => {
  test("returns one client to repeated consumers", () => {
    expect(getBullMqConnection()).toBe(bullMqConnection);
    expect(getBullMqConnection()).toBe(bullMqConnection);
  });

  test("disables request retries for the shared BullMQ client", () => {
    expect(bullMqConnection.options.maxRetriesPerRequest).toBeNull();
  });
});
