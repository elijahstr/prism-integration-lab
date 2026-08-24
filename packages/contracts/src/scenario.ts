import { z } from "zod";

export const ScenarioIdSchema = z.enum([
  "duplicate_webhook",
  "late_update",
  "provider_outage",
  "rate_limit",
  "uncertain_event_match",
  "incomplete_snapshot",
  "provider_change",
]);

export type ScenarioId = z.infer<typeof ScenarioIdSchema>;
