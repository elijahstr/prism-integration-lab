import duplicateWebhook from "./scenarios/duplicate_webhook.json";
import incompleteSnapshot from "./scenarios/incomplete_snapshot.json";
import lateUpdate from "./scenarios/late_update.json";
import providerChange from "./scenarios/provider_change.json";
import providerOutage from "./scenarios/provider_outage.json";
import rateLimit from "./scenarios/rate_limit.json";
import uncertainEventMatch from "./scenarios/uncertain_event_match.json";

import type { ScenarioId } from "@prism/contracts";

export type ScenarioFixture = {
  audit: string;
  databaseEffect: string;
  explanation: string;
  input: string;
  normalized: string;
  processing: string;
  scenario: ScenarioId;
  state: string;
};

export const scenarioFixtures: Record<ScenarioId, ScenarioFixture> = {
  duplicate_webhook: duplicateWebhook as ScenarioFixture,
  incomplete_snapshot: incompleteSnapshot as ScenarioFixture,
  late_update: lateUpdate as ScenarioFixture,
  provider_change: providerChange as ScenarioFixture,
  provider_outage: providerOutage as ScenarioFixture,
  rate_limit: rateLimit as ScenarioFixture,
  uncertain_event_match: uncertainEventMatch as ScenarioFixture,
};
