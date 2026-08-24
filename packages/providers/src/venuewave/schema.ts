import { z } from "zod";

export const VenueWaveEffectSchema = z
  .object({
    amountDeltaCents: z.number().int(),
    kind: z.enum(["sale", "refund", "fee", "inventory"]),
    ticketDelta: z.number().int(),
  })
  .strict();

export const VenueWavePayloadSchema = z
  .object({
    effects: z.array(VenueWaveEffectSchema),
    nextCursor: z.string().min(1),
  })
  .strict();

export type VenueWavePayload = z.infer<typeof VenueWavePayloadSchema>;
