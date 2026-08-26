import { expect, test } from "@playwright/test";

const establishedProviders = ["DICE", "Tixr"];
const removedFooter =
  "Static architecture explainer · No live customer or provider data";

async function expectOverviewProviderContext(
  page: import("@playwright/test").Page,
) {
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

async function expectVenueAndPromoterScenario(
  page: import("@playwright/test").Page,
) {
  await expect(page.getByText(/Come and Take It Live/).first()).toBeVisible();
  await expect(
    page.getByText(/Come and Take It Productions/).first(),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Posh is the proposed new provider in this hypothetical onboarding scenario.",
    ),
  ).toHaveCount(0);
}

async function expectApproachLayout(page: import("@playwright/test").Page) {
  await expect(page.getByText("Recommended", { exact: true })).toHaveCount(1);
  await expect(
    page.getByText("Alternate approach", { exact: true }),
  ).toHaveCount(2);
  await expect(page.locator("[data-approach-kind]")).toHaveCount(3);
  await expect(page.locator("[data-approach-kind]").first()).toHaveAttribute(
    "data-approach-kind",
    "recommended",
  );
  await expect(
    page.locator(".recommended-approach > .recommended-label"),
  ).toHaveText("Recommended");
}

test("shows the venue and promoter overview", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("UNOFFICIAL PORTFOLIO PROTOTYPE")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "One show, two operating views",
  );
  await expectOverviewProviderContext(page);
  await expect(
    page.getByRole("img", { name: /Come and Take It Live venue logo/ }),
  ).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(7);
  await expect(page.getByRole("tab")).toHaveText([
    "Overview",
    "API Mapping",
    "Webhooks",
    "Ordering & Conflicts",
    "Money & Refunds",
    "Reconciliation & Recovery",
    "Polling & Snapshots",
  ]);
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
  await expectVenueAndPromoterScenario(page);
  await expectApproachLayout(page);
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
    diagramName: /Prism stages a three-page ticket report/,
    scenarioText: /Hold a partial three-page ticket report/,
    detailText:
      /The provider adapter handles pagination, cursors, completion signals/,
  },
  {
    id: "ordering-conflicts",
    diagramName: /One Prism show record controls the accepted venue/,
    scenarioText: /Protect the confirmed Come and Take It Live show/,
    detailText:
      /One Prism show record holds the accepted date, room, status, and version/,
  },
  {
    id: "money-refunds",
    diagramName:
      /Prism separates a \$45.00 refund from a \$3.50 retained provider fee/,
    scenarioText: /Apply a refund without hiding the provider fee/,
    detailText:
      /A customer receives a \$45.00 ticket refund, while a \$3.50 provider fee remains/,
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

    await expectVenueAndPromoterScenario(page);
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
    await expectApproachLayout(page);
    if (lesson.detailText) {
      await expect(page.getByText(lesson.detailText)).toBeVisible();
    }
  });
}

test("supports keyboard tab navigation", async ({ page }) => {
  await page.goto("/");

  const overview = page.getByRole("tab", { name: "Overview" });
  await overview.focus();
  await overview.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "API Mapping" })).toBeFocused();
  await expect(page).toHaveURL(/lesson=api-mapping/);

  const reconciliation = page.getByRole("tab", {
    name: "Reconciliation & Recovery",
  });
  await reconciliation.focus();
  await reconciliation.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Polling & Snapshots" }),
  ).toBeFocused();
  await expect(page).toHaveURL(/lesson=polling-snapshots/);
});

test("uses the lesson sequence in footer navigation", async ({ page }) => {
  await page.goto("/?lesson=ordering-conflicts");

  await expect(page.getByRole("button", { name: "← Webhooks" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Money & Refunds →" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Money & Refunds →" }).click();
  await expect(page).toHaveURL(/lesson=money-refunds/);
  await expect(
    page.getByRole("button", { name: "Reconciliation & Recovery →" }),
  ).toBeVisible();
});
