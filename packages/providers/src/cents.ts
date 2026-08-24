import { z } from "zod";

export const SafeCentsSchema = z
  .number()
  .int()
  .refine(Number.isSafeInteger, "Money must use safe integer cents");
