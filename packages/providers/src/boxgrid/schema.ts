import { z } from "zod";

import { SafeCentsSchema } from "../cents";

export const BoxGridFactsSchema = z
  .object({
    grossSalesCents: SafeCentsSchema,
    inventory: z.number().int().nonnegative(),
    sold: z.number().int().nonnegative(),
  })
  .strict();

export const BoxGridSnapshotSchema = z
  .object({
    complete: z.boolean(),
    facts: BoxGridFactsSchema,
    sequence: z.string().regex(/^\d+$/),
  })
  .strict();

export type BoxGridSnapshot = z.infer<typeof BoxGridSnapshotSchema>;
