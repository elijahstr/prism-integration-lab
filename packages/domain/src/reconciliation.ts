import type { Provider } from "@prism/contracts";

import type { ProviderFacts } from "./operations";

export type ProviderSoldFact = {
  provider: Provider;
  sold: number;
};

export function sumProviderFacts(facts: ProviderSoldFact[]): { sold: number } {
  return {
    sold: facts.reduce((total, fact) => total + fact.sold, 0),
  };
}

export function diffProviderSnapshot(
  previous: ProviderFacts,
  next: ProviderFacts,
): ProviderFacts {
  return {
    grossSalesCents: next.grossSalesCents - previous.grossSalesCents,
    inventory: next.inventory - previous.inventory,
    sold: next.sold - previous.sold,
  };
}
