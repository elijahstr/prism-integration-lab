import type { ProviderEnvelope } from "@prism/contracts";

import type { ProviderAdapter } from "../../../domain/src/operations";
import { compareProviderVersion } from "../../../domain/src/version";

import { BoxGridSnapshotSchema } from "./schema";

function assertBoxGridEnvelope(envelope: ProviderEnvelope): void {
  if (envelope.provider !== "boxgrid") {
    throw new Error("BoxGrid adapter requires a BoxGrid envelope");
  }
}

export const boxGridAdapter: ProviderAdapter = {
  compareVersion(left, right) {
    return compareProviderVersion("boxgrid", left, right);
  },
  parse(envelope) {
    assertBoxGridEnvelope(envelope);
    const snapshot = BoxGridSnapshotSchema.parse(envelope.payload);

    if (!snapshot.complete) {
      return [];
    }

    return [
      {
        facts: snapshot.facts,
        mode: "replace" as const,
        sourceVersion: envelope.sourceVersion,
        versionRank: BigInt(snapshot.sequence),
      },
    ];
  },
};
