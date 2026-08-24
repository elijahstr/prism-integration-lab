import type { ProviderEnvelope } from "@prism/contracts";

export type ProviderFacts = {
  grossSalesCents: number;
  inventory: number;
  sold: number;
};

export type AppendOperation = {
  amountDeltaCents: number;
  currency: "USD";
  kind: "sale" | "refund" | "fee" | "inventory";
  mode: "append";
  operationKey: string;
  ticketDelta: number;
};

export type ReplaceOperation = {
  facts: ProviderFacts;
  mode: "replace";
  sourceVersion: string;
  versionRank: bigint;
};

export type NormalizedOperation = AppendOperation | ReplaceOperation;

export interface ProviderAdapter {
  compareVersion(left: string, right: string): -1 | 0 | 1;
  parse(envelope: ProviderEnvelope): NormalizedOperation[];
}
