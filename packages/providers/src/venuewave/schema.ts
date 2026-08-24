import { z } from "zod";

import { SafeCentsSchema } from "../cents";

export const VenueWaveEffectSchema = z
  .object({
    amountDeltaCents: SafeCentsSchema,
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
