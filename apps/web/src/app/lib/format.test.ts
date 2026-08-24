import { describe, expect, test } from "bun:test";

import {
  formatCurrency,
  formatSyncDelay,
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
});
