import { z } from "zod";

export const ProviderSchema = z.enum(["encoretix", "venuewave", "boxgrid"]);

export const ProviderEnvelopeKindSchema = z.enum([
  "sale_delta",
  "refund_delta",
  "inventory_delta",
  "snapshot",
]);

export const UtcTimestampSchema = z.iso.datetime({ offset: false });

export const ProviderEnvelopeSchema = z
  .object({
    scopeId: z.string().min(1),
    organizationId: z.string().min(1),
    connectionId: z.string().min(1),
    provider: ProviderSchema,
    deliveryId: z.string().min(1),
    externalEventId: z.string().min(1),
    kind: ProviderEnvelopeKindSchema,
    sourceOccurredAt: UtcTimestampSchema,
    receivedAt: UtcTimestampSchema,
    sourceVersion: z.string().min(1),
    checksum: z.string().min(1),
    payload: z.unknown(),
  })
  .strict();

export type ProviderEnvelope = z.infer<typeof ProviderEnvelopeSchema>;
export type Provider = z.infer<typeof ProviderSchema>;
export type ProviderEnvelopeKind = z.infer<typeof ProviderEnvelopeKindSchema>;
