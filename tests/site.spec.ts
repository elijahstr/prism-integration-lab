import { expect, test } from "@playwright/test";

test("shows the venue and promoter overview", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("UNOFFICIAL PORTFOLIO PROTOTYPE")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "One business group, two operating views",
  );
  await expect(
    page.getByText(/Come and Take It Live is an Austin music venue/),
  ).toBeVisible();
  await expect(
    page.getByText(/Come and Take It Productions promotes and produces shows/),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Come and Take It Live venue logo/ }),
  ).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(7);
  await expect(page.locator(".architecture-diagram")).toHaveCount(0);
});

test("opens a lesson from its shareable URL", async ({ page }) => {
  await page.goto("/?lesson=api-mapping");

  await expect(page.getByRole("tab", { name: "API Mapping" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Different provider fields",
  );
  await expect(page.getByText("Recommended")).toBeVisible();
  await expect(page.getByText("Technical debt")).toHaveCount(3);
});

for (const lesson of [
  { id: "api-mapping", diagramName: /Provider adapters translate/ },
  { id: "webhooks", diagramName: /The receiver accepts repeats/ },
  { id: "polling-snapshots", diagramName: /A scoped snapshot/ },
  { id: "ordering-conflicts", diagramName: /Version checks protect/ },
  { id: "money-refunds", diagramName: /A financial ledger keeps/ },
  {
    id: "reconciliation-recovery",
    diagramName: /Prism compares source totals/,
  },
]) {
  test(`shows the ${lesson.id} diagram and example`, async ({ page }) => {
    await page.goto(`/?lesson=${lesson.id}`);

    await expect(
      page.getByRole("img", { name: lesson.diagramName }),
    ).toBeVisible();
    await expect(page.locator(".example button")).toHaveCount(0);
    await expect(page.locator(".trace li")).toHaveCount(4);
    await expect(page.locator(".trace .result")).toBeVisible();
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
