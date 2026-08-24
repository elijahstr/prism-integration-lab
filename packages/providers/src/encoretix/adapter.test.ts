import { describe, expect, test } from "bun:test";

import type { ProviderEnvelope } from "@prism/contracts";

import { encoreTixAdapter } from "./adapter";

const envelope: ProviderEnvelope = {
  checksum: "sha256:encore",
  connectionId: "connection-encore",
  deliveryId: "delivery-encore-1",
  externalEventId: "event-summer-hall",
  kind: "sale_delta",
  organizationId: "organization-northstar",
  payload: {
    effects: [
      { amountDeltaCents: 5000, kind: "sale", ticketDelta: 2 },
      { amountDeltaCents: 300, kind: "fee", ticketDelta: 0 },
    ],
  },
  provider: "encoretix",
  receivedAt: "2026-08-24T12:35:01.000Z",
  scopeId: "scope-northstar",
  sourceOccurredAt: "2026-08-24T12:34:56.000Z",
  sourceVersion: "2026-08-24T12:34:56.000Z",
};

describe("EncoreTix adapter", () => {
  test("turns each webhook line into an immutable append operation", () => {
    expect(encoreTixAdapter.parse(envelope)).toEqual([
      {
        amountDeltaCents: 5000,
        currency: "USD",
        kind: "sale",
        mode: "append",
        operationKey: "delivery-encore-1:0",
        ticketDelta: 2,
      },
      {
        amountDeltaCents: 300,
        currency: "USD",
        kind: "fee",
        mode: "append",
        operationKey: "delivery-encore-1:1",
        ticketDelta: 0,
      },
    ]);
  });

  test("keeps a late valid effect as an append operation", () => {
    expect(
      encoreTixAdapter.parse({
        ...envelope,
        deliveryId: "delivery-encore-late",
        sourceOccurredAt: "2026-08-23T12:34:56.000Z",
      }),
    ).toHaveLength(2);
  });
});
