import { describe, expect, test } from "bun:test";

import { diffProviderSnapshot, sumProviderFacts } from "./reconciliation";

describe("provider-scoped reconciliation", () => {
  test("keeps facts from providers separate when it totals a show", () => {
    expect(
      sumProviderFacts([
        { provider: "encoretix", sold: 400 },
        { provider: "boxgrid", sold: 600 },
      ]),
    ).toEqual({ sold: 1000 });
  });

  test("calculates changes only inside one provider snapshot", () => {
    expect(
      diffProviderSnapshot(
        { grossSalesCents: 18000, inventory: 88, sold: 12 },
        { grossSalesCents: 21000, inventory: 85, sold: 15 },
      ),
    ).toEqual({ grossSalesCents: 3000, inventory: -3, sold: 3 });
  });
});
