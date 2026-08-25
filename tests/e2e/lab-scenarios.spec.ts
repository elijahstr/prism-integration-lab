import { expect, test } from "@playwright/test";

type ScenarioExpectation = {
  audit: string;
  databaseEffect: RegExp | string;
  normalized: string;
  title: string;
};

const scenarios: readonly ScenarioExpectation[] = [
  {
    audit: "The applied delivery has durable audit evidence.",
    databaseEffect: "One ingestion message and one normalized effect exist.",
    normalized: "One immutable EncoreTix sale effect remains.",
    title: "Duplicate webhook",
  },
  {
    audit: "The applied late effect has durable audit evidence.",
    databaseEffect:
      "The provider fact increases once and keeps its source evidence.",
    normalized: "One late EncoreTix sale effect applies once.",
    title: "Late update",
  },
  {
    audit:
      "Audit evidence records the temporary error, 1000 ms executed backoff, and recovery after 2 attempts.",
    databaseEffect:
      /^The cursor changed from .+ to cursor-outage-recovered after 2 attempts and one durable message\.$/,
    normalized:
      "The successful second poll produced one VenueWave sale effect.",
    title: "Provider outage",
  },
  {
    audit:
      "Audit evidence records the 60000 ms executed wait and both retry cursor inputs.",
    databaseEffect:
      /^The cursor stayed unchanged at ([^;]+); both real poll attempts used \1,\1, and no message or financial effect was stored\.$/,
    normalized: "The controlled rate limit emitted no financial operation.",
    title: "Rate limit",
  },
  {
    audit: "The audit records the missing confirmed event mapping.",
    databaseEffect:
      "The message and review item remain pending human confirmation.",
    normalized: "No financial operation is emitted.",
    title: "Uncertain event match",
  },
  {
    audit: "The audit records the incomplete snapshot sequence.",
    databaseEffect:
      "Current BoxGrid facts remain unchanged while staging keeps the raw snapshot.",
    normalized: "No replacement operation is emitted.",
    title: "Incomplete snapshot",
  },
  {
    audit: "A reconciliation audit records both provider scopes.",
    databaseEffect: "The show total is 1,000 across provider-scoped facts.",
    normalized: "EncoreTix has 400 sales. BoxGrid has 600 sales.",
    title: "Provider change",
  },
];

for (const scenario of scenarios) {
  test(`${scenario.title} keeps trace evidence inside its browser session`, async ({
    browser,
    page,
  }) => {
    await page.goto("/integration-lab");
    await expect(page.getByText("Scenario library")).toBeVisible();

    const scenarioCard = page.locator(".scenario").filter({
      has: page.getByRole("heading", { name: scenario.title }),
    });
    await scenarioCard.getByRole("button", { name: "Run scenario" }).click();

    const trace = page.locator(".trace-panel");
    await expect(
      trace.getByRole("heading", { name: scenario.title }),
    ).toBeVisible();
    await expect(trace.getByText("Normalized output")).toBeVisible();
    await expect(trace.getByText(scenario.normalized)).toBeVisible();
    await expect(trace.getByText(scenario.databaseEffect)).toBeVisible();
    await expect(trace.getByText("Audit result")).toBeVisible();
    await expect(trace.getByText(scenario.audit)).toBeVisible();

    const isolatedContext = await browser.newContext();
    const isolatedPage = await isolatedContext.newPage();
    await isolatedPage.goto("/integration-lab");
    const isolatedTrace = isolatedPage.locator(".trace-panel");
    await expect(
      isolatedTrace.getByRole("heading", { name: "No run selected" }),
    ).toBeVisible();
    await expect(isolatedTrace).not.toContainText(scenario.normalized);
    await isolatedContext.close();
  });
}
