import { describe, expect, test } from "bun:test";

import type { ProviderEnvelope } from "@prism/contracts";

import { venueWaveAdapter } from "./adapter";

const envelope: ProviderEnvelope = {
  checksum: "sha256:venuewave",
  connectionId: "connection-venuewave",
  deliveryId: "page-42",
  externalEventId: "event-summer-hall",
  kind: "sale_delta",
  organizationId: "organization-northstar",
  payload: {
    effects: [{ amountDeltaCents: 7500, kind: "sale", ticketDelta: 3 }],
    nextCursor: "cursor-43",
  },
  provider: "venuewave",
  receivedAt: "2026-08-24T12:35:01.000Z",
  scopeId: "scope-northstar",
  sourceOccurredAt: "2026-08-24T12:34:56.000Z",
  sourceVersion: "cursor-42",
};

describe("VenueWave adapter", () => {
  test("turns one durable page into immutable append operations", () => {
    expect(venueWaveAdapter.parse(envelope)).toEqual([
      {
        amountDeltaCents: 7500,
        currency: "USD",
        kind: "sale",
        mode: "append",
        operationKey: "page-42:0",
        ticketDelta: 3,
      },
    ]);
  });
});
