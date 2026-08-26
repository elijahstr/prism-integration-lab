import { expect, test, type Page } from "@playwright/test";

async function expectSelectedAndFocusedTab(
  page: Page,
  name: string,
): Promise<void> {
  const tab = page.getByRole("tab", { name });
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect(tab).toBeFocused();
}

test("shows the approved seven-tab teaching order", async ({ page }) => {
  await page.goto("/integration-lab?organization=northstar-presents");

  await expect(page.getByRole("tab")).toHaveText([
    "Overview",
    "API Mapping",
    "Webhooks",
    "Polling & Snapshots",
    "Ordering & Conflicts",
    "Money & Refunds",
    "Reconciliation & Recovery",
  ]);
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("teaches API mapping before an action and keeps the full mapping vocabulary", async ({
  page,
}) => {
  await page.goto(
    "/integration-lab?organization=harborlight-live&lesson=api-mapping",
  );

  const panel = page.getByRole("tabpanel");
  await expect(panel).toContainText("canonical model");
  await expect(panel).toContainText("immutable raw-payload retention");
  await expect(panel.locator(".lesson-diagram")).toBeVisible();
  await expect(panel.locator(".lesson-recommendation-label")).toHaveText(
    "Recommended",
  );
  await expect(panel.locator("[data-approach]")).toHaveCount(3);
  await expect(panel.locator("[data-approach-kind=pro]")).toHaveCount(6);
  await expect(panel.locator("[data-approach-kind=con]")).toHaveCount(6);
  await expect(panel).toContainText("Technical debt path");
  await expect(panel).toContainText("Failure prevented");
  const sectionOrder = await panel
    .locator("[data-lesson-section]")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-lesson-section")),
    );

  expect(sectionOrder.indexOf("diagram")).toBeLessThan(
    sectionOrder.indexOf("actions"),
  );
});

test("preserves the organization, run, and lesson through history navigation", async ({
  page,
}) => {
  await page.context().setExtraHTTPHeaders({
    "x-forwarded-for": "203.0.113.24",
  });
  await page.goto("/integration-lab?organization=northstar-presents");

  await page.locator('[role="tab"][data-lesson-id="api-mapping"]').click();
  let url = new URL(page.url());
  expect(url.searchParams.get("organization")).toBe("northstar-presents");
  expect(url.searchParams.get("lesson")).toBe("api-mapping");
  expect(url.searchParams.get("run")).toBeNull();

  await page.locator('[role="tab"][data-lesson-id="webhooks"]').click();
  await page.locator('button[data-scenario-id="duplicate_webhook"]').click();
  const trace = page.locator(".trace-panel");
  await expect(
    trace.getByRole("heading", { name: "Duplicate webhook" }),
  ).toBeVisible();
  url = new URL(page.url());
  const runId = url.searchParams.get("run");
  expect(runId).not.toBeNull();

  await page.locator('[role="tab"][data-lesson-id="api-mapping"]').click();
  await page.goBack();
  await expect(
    page.locator('[role="tab"][data-lesson-id="webhooks"]'),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    trace.getByRole("heading", { name: "Duplicate webhook" }),
  ).toBeVisible();
  url = new URL(page.url());
  expect(url.searchParams.get("organization")).toBe("northstar-presents");
  expect(url.searchParams.get("run")).toBe(runId);

  await page.goForward();
  await expect(
    page.locator('[role="tab"][data-lesson-id="api-mapping"]'),
  ).toHaveAttribute("aria-selected", "true");
  url = new URL(page.url());
  expect(url.searchParams.get("organization")).toBe("northstar-presents");
  expect(url.searchParams.get("run")).toBe(runId);

  await page.getByLabel("Demo organization").selectOption("harborlight-live");
  await expect(
    page.locator('[role="tab"][data-lesson-id="api-mapping"]'),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Demo organization")).toHaveValue(
    "harborlight-live",
  );
  url = new URL(page.url());
  expect(url.searchParams.get("organization")).toBe("harborlight-live");
  expect(url.searchParams.get("lesson")).toBe("api-mapping");
  expect(url.searchParams.get("run")).toBeNull();
});

test("moves tab focus and selection with the keyboard", async ({ page }) => {
  await page.goto("/integration-lab?organization=northstar-presents");

  const overview = page.getByRole("tab", { name: "Overview" });
  await overview.focus();
  await overview.press("ArrowRight");
  await expectSelectedAndFocusedTab(page, "API Mapping");

  await page.getByRole("tab", { name: "API Mapping" }).press("ArrowLeft");
  await expectSelectedAndFocusedTab(page, "Overview");

  await page.getByRole("tab", { name: "Overview" }).press("End");
  await expectSelectedAndFocusedTab(page, "Reconciliation & Recovery");

  await page
    .getByRole("tab", { name: "Reconciliation & Recovery" })
    .press("Home");
  await expectSelectedAndFocusedTab(page, "Overview");
});

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "390px", width: 390, height: 844 },
] as const) {
  test(`has no browser errors or horizontal overflow at ${viewport.name}`, async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto(
      "/integration-lab?organization=northstar-presents&lesson=api-mapping",
    );
    await expect(page.getByRole("tabpanel")).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
}
