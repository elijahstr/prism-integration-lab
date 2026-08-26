import { expect, test } from "@playwright/test";

test("shows the venue and promoter overview", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("UNOFFICIAL PORTFOLIO PROTOTYPE")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "One business group, two operating views",
  );
  await expect(
    page.getByText("Come and Take It Live", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Come and Take It Productions", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Come and Take It Live venue logo/ }),
  ).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(7);
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
  "api-mapping",
  "webhooks",
  "polling-snapshots",
  "ordering-conflicts",
  "money-refunds",
  "reconciliation-recovery",
]) {
  test(`runs the ${lesson} browser-only example`, async ({ page }) => {
    await page.goto(`/?lesson=${lesson}`);

    await page.getByRole("button", { name: "Run example" }).click();
    await page.getByRole("button", { name: "Next step" }).click();
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(
      page.getByRole("button", { name: "Reset example" }),
    ).toBeVisible();
    await expect(page.locator(".trace .result.visible")).toBeVisible();
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
