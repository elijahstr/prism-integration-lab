import { z } from "zod";

import { ProviderSchema, UtcTimestampSchema } from "./provider-envelope";
import { ScenarioIdSchema } from "./scenario";

export const CentsSchema = z.number().int();
export const UsdCurrencySchema = z.literal("USD");

export const LabSessionDtoSchema = z
  .object({
    expiresAt: UtcTimestampSchema,
    token: z.string().min(1),
  })
  .strict();

export const TraceStepSchema = z
  .object({
    order: z.number().int().nonnegative(),
    state: z.string().min(1),
    title: z.string().min(1),
    explanation: z.string().min(1),
    databaseEffect: z.string().min(1),
  })
  .strict();

export const TicketFactDtoSchema = z
  .object({
    provider: ProviderSchema,
    soldTickets: z.number().int().nonnegative(),
    grossSalesCents: CentsSchema,
    refundedTickets: z.number().int().nonnegative(),
    refundCents: CentsSchema,
    inventoryTickets: z.number().int().nonnegative(),
    feeCents: CentsSchema,
    currency: UsdCurrencySchema,
    sourceVersion: z.string().min(1),
  })
  .strict();

export const OverviewDtoSchema = z
  .object({
    revenueCents: CentsSchema,
    ticketCount: z.number().int().nonnegative(),
    syncDelaySeconds: z.number().int().nonnegative(),
    reviewCount: z.number().int().nonnegative(),
  })
  .strict();

export const ProviderDtoSchema = z
  .object({
    id: z.string().min(1),
    provider: ProviderSchema,
    status: z.string().min(1),
    transport: z.string().min(1),
    lastSuccessfulAt: UtcTimestampSchema.nullable(),
    recentError: z.string().min(1).nullable(),
  })
  .strict();

export const ShowDtoSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    startsAt: UtcTimestampSchema,
    facts: z.array(TicketFactDtoSchema),
  })
  .strict();

export const MessageDtoSchema = z
  .object({
    id: z.string().min(1),
    provider: ProviderSchema,
    deliveryId: z.string().min(1),
    state: z.string().min(1),
    receivedAt: UtcTimestampSchema,
  })
  .strict();

export const ReviewDtoSchema = z
  .object({
    id: z.string().min(1),
    kind: z.string().min(1),
    state: z.string().min(1),
    createdAt: UtcTimestampSchema,
  })
  .strict();

export const ScenarioRunDtoSchema = z
  .object({
    id: z.string().min(1),
    scenario: ScenarioIdSchema,
    state: z.string().min(1),
    trace: z.array(TraceStepSchema),
  })
  .strict();

export type TraceStep = z.infer<typeof TraceStepSchema>;
export type LabSessionDto = z.infer<typeof LabSessionDtoSchema>;
export type TicketFactDto = z.infer<typeof TicketFactDtoSchema>;
export type OverviewDto = z.infer<typeof OverviewDtoSchema>;
export type ProviderDto = z.infer<typeof ProviderDtoSchema>;
export type ShowDto = z.infer<typeof ShowDtoSchema>;
export type MessageDto = z.infer<typeof MessageDtoSchema>;
export type ReviewDto = z.infer<typeof ReviewDtoSchema>;
export type ScenarioRunDto = z.infer<typeof ScenarioRunDtoSchema>;
