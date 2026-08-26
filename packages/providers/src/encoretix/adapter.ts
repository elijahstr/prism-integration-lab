import type { ProviderEnvelope } from "@prism/contracts";
import { compareProviderVersion, type ProviderAdapter } from "@prism/domain";

import { EncoreTixPayloadSchema } from "./schema";

function assertEncoreTixEnvelope(envelope: ProviderEnvelope): void {
  if (envelope.provider !== "encoretix") {
    throw new Error("EncoreTix adapter requires an EncoreTix envelope");
  }
}

export const encoreTixAdapter: ProviderAdapter = {
  compareVersion(left, right) {
    return compareProviderVersion("encoretix", left, right);
  },
  parse(envelope) {
    assertEncoreTixEnvelope(envelope);
    const payload = EncoreTixPayloadSchema.parse(envelope.payload);

    return payload.effects.map((effect, index) => ({
      ...effect,
      currency: "USD" as const,
      mode: "append" as const,
      operationKey: `${envelope.deliveryId}:${index}`,
    }));
  },
};
