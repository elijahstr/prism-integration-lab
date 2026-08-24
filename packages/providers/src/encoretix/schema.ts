import { z } from "zod";

import { SafeCentsSchema } from "../cents";

export const EncoreTixEffectSchema = z
  .object({
    amountDeltaCents: SafeCentsSchema,
    kind: z.enum(["sale", "refund", "fee", "inventory"]),
    ticketDelta: z.number().int(),
  })
  .strict();

export const EncoreTixPayloadSchema = z
  .object({
    effects: z.array(EncoreTixEffectSchema).min(1),
  })
  .strict();

export type EncoreTixPayload = z.infer<typeof EncoreTixPayloadSchema>;
