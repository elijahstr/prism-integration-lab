import { describe, expect, test } from "bun:test";

import { TicketFactDtoSchema } from "./api";
import {
  ProviderEnvelopeSchema,
  type ProviderEnvelope,
} from "./provider-envelope";
import { ScenarioIdSchema } from "./scenario";

const validEnvelope: ProviderEnvelope = {
  scopeId: "scope-demo-1",
  organizationId: "organization-northstar",
  connectionId: "connection-encoretix",
  provider: "encoretix",
  deliveryId: "delivery-123",
  externalEventId: "event-456",
  kind: "sale_delta",
  sourceOccurredAt: "2026-08-24T12:34:56.000Z",
  receivedAt: "2026-08-24T12:35:01.000Z",
  sourceVersion: "2026-08-24T12:34:56.000Z",
  checksum: "sha256:abc123",
  payload: { ticketCount: 2 },
};

describe("shared ingestion contracts", () => {
  test("accepts an envelope with UTC source and receive timestamps", () => {
    expect(ProviderEnvelopeSchema.parse(validEnvelope)).toEqual(validEnvelope);
  });

  test("rejects a ticket fact with decimal cents", () => {
    expect(() =>
      TicketFactDtoSchema.parse({
        provider: "encoretix",
        soldTickets: 2,
        grossSalesCents: 1999.5,
        refundedTickets: 0,
        refundCents: 0,
        inventoryTickets: 50,
        feeCents: 0,
        currency: "USD",
        sourceVersion: "2026-08-24T12:34:56.000Z",
      }),
    ).toThrow();
  });

  test("rejects an envelope with a non-UTC receive timestamp", () => {
    expect(() =>
      ProviderEnvelopeSchema.parse({ ...validEnvelope, receivedAt: "not-utc" }),
    ).toThrow();
  });

  test("rejects an envelope from an unknown provider", () => {
    expect(() =>
      ProviderEnvelopeSchema.parse({
        ...validEnvelope,
        provider: "other-provider",
      }),
    ).toThrow();
  });

  test("defines the seven integration-lab scenarios", () => {
    expect(ScenarioIdSchema.options).toHaveLength(7);
    expect(ScenarioIdSchema.options).toEqual([
      "duplicate_webhook",
      "late_update",
      "provider_outage",
      "rate_limit",
      "uncertain_event_match",
      "incomplete_snapshot",
      "provider_change",
    ]);
  });
});
