import { expect, test } from "@playwright/test";

const establishedProviders = ["DICE", "Tixr"];
const removedFooter =
  "Static architecture explainer · No live customer or provider data";

async function expectProviderScenario(page: import("@playwright/test").Page) {
  await expect(page.getByText(/Come and Take It Live/).first()).toBeVisible();
  await expect(
    page.getByText(/Come and Take It Productions/).first(),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Posh is the proposed new provider in this hypothetical onboarding scenario.",
    ),
  ).toBeVisible();

  for (const provider of establishedProviders) {
    await expect(
      page.getByText(provider, { exact: false }).first(),
    ).toBeVisible();
  }
}

test("shows the venue and promoter overview", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("UNOFFICIAL PORTFOLIO PROTOTYPE")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "One show, two operating views",
  );
  await expectProviderScenario(page);
  await expect(
    page.getByRole("img", { name: /Come and Take It Live venue logo/ }),
  ).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(7);
  await expect(page.locator(".architecture-diagram")).toHaveCount(0);
  await expect(page.getByText(removedFooter)).toHaveCount(0);
});

test("opens a lesson from its shareable URL", async ({ page }) => {
  await page.goto("/?lesson=api-mapping");

  await expect(page.getByRole("tab", { name: "API Mapping" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Provider data must mean the same thing",
  );
  await expectProviderScenario(page);
  await expect(page.getByText("Recommended")).toBeVisible();
  await expect(page.getByText("Technical debt")).toHaveCount(3);
});

for (const lesson of [
  {
    id: "api-mapping",
    diagramName: /Provider adapters map the Come and Take It Live show/,
    scenarioText: /Map one proposed Posh order/,
  },
  {
    id: "webhooks",
    diagramName: /A proposed Posh event enters Prism once/,
    scenarioText: /Receive a duplicate proposed Posh sale/,
  },
  {
    id: "polling-snapshots",
    diagramName: /A proposed Posh ticket snapshot becomes/,
    scenarioText: /Reject an incomplete proposed Posh snapshot/,
  },
  {
    id: "ordering-conflicts",
    diagramName: /Prism protects the confirmed Come and Take It Live show/,
    scenarioText: /Protect the confirmed Come and Take It Live show/,
  },
  {
    id: "money-refunds",
    diagramName: /DICE, Tixr, and proposed Posh/,
    scenarioText: /Apply a refund without hiding the provider fee/,
  },
  {
    id: "reconciliation-recovery",
    diagramName: /Prism compares the Come and Take It Productions offer/,
    scenarioText: /Recover a Posh settlement check/,
  },
]) {
  test(`shows the ${lesson.id} provider scenario, diagram, and example`, async ({
    page,
  }) => {
    await page.goto(`/?lesson=${lesson.id}`);

    await expectProviderScenario(page);
    await expect(
      page.getByRole("img", { name: lesson.diagramName }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: lesson.scenarioText }),
    ).toBeVisible();
    await expect(page.locator(".example button")).toHaveCount(0);
    await expect(page.locator(".trace li")).toHaveCount(4);
    await expect(page.locator(".trace .result")).toBeVisible();
    await expect(page.getByText(removedFooter)).toHaveCount(0);
  });
}

test("supports keyboard tab navigation", async ({ page }) => {
  await page.goto("/");

  const overview = page.getByRole("tab", { name: "Overview" });
  await overview.focus();
  await overview.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "API Mapping" })).toBeFocused();
  await expect(page).toHaveURL(/lesson=api-mapping/);
});
