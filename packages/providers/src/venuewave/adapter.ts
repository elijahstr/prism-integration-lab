import type { ProviderEnvelope } from "@prism/contracts";

import type { ProviderAdapter } from "../../../domain/src/operations";
import { compareProviderVersion } from "../../../domain/src/version";

import { VenueWavePayloadSchema } from "./schema";

function assertVenueWaveEnvelope(envelope: ProviderEnvelope): void {
  if (envelope.provider !== "venuewave") {
    throw new Error("VenueWave adapter requires a VenueWave envelope");
  }
}

export const venueWaveAdapter: ProviderAdapter = {
  compareVersion(left, right) {
    return compareProviderVersion("venuewave", left, right);
  },
  parse(envelope) {
    assertVenueWaveEnvelope(envelope);
    const payload = VenueWavePayloadSchema.parse(envelope.payload);

    return payload.effects.map((effect, index) => ({
      ...effect,
      currency: "USD" as const,
      mode: "append" as const,
      operationKey: `${envelope.deliveryId}:${index}`,
    }));
  },
};
