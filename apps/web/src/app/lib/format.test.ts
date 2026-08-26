import { describe, expect, test } from "bun:test";
import type { MessageDto } from "@prism/contracts";

import {
  formatCurrency,
  formatSyncDelay,
  recentActivityMessages,
  sumProviderTicketFacts,
} from "./format";

describe("dashboard format helpers", () => {
  test("formats integer cents as USD without floating point drift", () => {
    expect(formatCurrency(245050)).toBe("$2,450.50");
    expect(formatCurrency(-125)).toBe("-$1.25");
  });

  test("describes a zero and minute-scale synchronization delay", () => {
    expect(formatSyncDelay(0)).toBe("Current");
    expect(formatSyncDelay(125)).toBe("2m 5s behind");
  });

  test("adds provider-scoped ticket facts without replacing another provider", () => {
    expect(
      sumProviderTicketFacts([
        { provider: "encoretix", soldTickets: 400, refundedTickets: 0 },
        { provider: "boxgrid", soldTickets: 600, refundedTickets: 0 },
      ]),
    ).toBe(1000);
  });

  test("selects the first five messages from a newest-first page larger than 50", () => {
    const messages: MessageDto[] = Array.from({ length: 55 }, (_, index) => ({
      deliveryId: `delivery-${54 - index}`,
      id: `message-${String(54 - index).padStart(2, "0")}`,
      provider: "encoretix",
      receivedAt: new Date(
        Date.UTC(2026, 7, 24, 12, 0, 54 - index),
      ).toISOString(),
      state: "applied",
    }));
    expect(
      recentActivityMessages(messages).map((message) => message.id),
    ).toEqual([
      "message-54",
      "message-53",
      "message-52",
      "message-51",
      "message-50",
    ]);
  });
});
