import { describe, expect, test } from "bun:test";

import type { ProviderEnvelope } from "@prism/contracts";

import { boxGridAdapter } from "./adapter";

const envelope: ProviderEnvelope = {
  checksum: "sha256:boxgrid",
  connectionId: "connection-boxgrid",
  deliveryId: "snapshot-12",
  externalEventId: "event-summer-hall",
  kind: "snapshot",
  organizationId: "organization-northstar",
  payload: {
    complete: true,
    facts: { grossSalesCents: 1500000, inventory: 400, sold: 600 },
    sequence: "9007199254740993",
  },
  provider: "boxgrid",
  receivedAt: "2026-08-24T12:35:01.000Z",
  scopeId: "scope-northstar",
  sourceOccurredAt: "2026-08-24T12:34:56.000Z",
  sourceVersion: "9007199254740993",
};

describe("BoxGrid adapter", () => {
  test("creates one absolute provider-scoped replacement after completion", () => {
    expect(boxGridAdapter.parse(envelope)).toEqual([
      {
        facts: { grossSalesCents: 1500000, inventory: 400, sold: 600 },
        mode: "replace",
        sourceVersion: "9007199254740993",
        versionRank: 9007199254740993n,
      },
    ]);
  });

  test("does not apply an incomplete snapshot", () => {
    expect(
      boxGridAdapter.parse({
        ...envelope,
        payload: { ...(envelope.payload as object), complete: false },
      }),
    ).toEqual([]);
  });
});
