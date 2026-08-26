import { expect, test } from "@playwright/test";

const establishedProviders = ["DICE", "Tixr"];
const providerContext =
  "Posh is the proposed new provider in this hypothetical onboarding scenario.";
const removedFooter =
  "Static architecture explainer · No live customer or provider data";

async function expectOverviewProviderContext(
  page: import("@playwright/test").Page,
) {
  await expect(page.getByText(/Come and Take It Live/).first()).toBeVisible();
  await expect(
    page.getByText(/Come and Take It Productions/).first(),
  ).toBeVisible();
  await expect(page.getByText(providerContext)).toBeVisible();

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
  await expect(page.getByText(providerContext)).toHaveCount(0);
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

async function expectNoDocumentOverflow(page: import("@playwright/test").Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
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
  await expect(page.getByRole("tab")).toHaveCount(5);
  await expect(page.getByRole("tab")).toHaveText([
    "Overview",
    "API Mapping",
    "Ordering & Conflicts",
    "Ticket Data Integrity",
    "Transaction Accuracy",
  ]);
  await expect(page.locator(".architecture-diagram")).toHaveCount(0);
  await expect(page.getByText(removedFooter)).toHaveCount(0);
});

test("opens a canonical lesson from its shareable URL", async ({ page }) => {
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

test("uses visible challenge numbers in lesson order", async ({ page }) => {
  for (const [id, challenge] of [
    ["api-mapping", "01"],
    ["ordering-conflicts", "02"],
    ["ticket-data-integrity", "03"],
    ["transaction-accuracy", "04"],
  ]) {
    await page.goto(`/?lesson=${id}`);
    await expect(page.locator(".eyebrow")).toContainText(
      `Challenge ${challenge}`,
    );
  }
});

for (const lesson of [
  {
    id: "api-mapping",
    diagramName: /Provider adapters map the Come and Take It Live show/,
    scenarioText: /Map one proposed Posh order/,
  },
  {
    id: "ordering-conflicts",
    diagramName: /One Prism show record controls the accepted venue/,
    scenarioText: /Protect the confirmed Come and Take It Live show/,
    detailText:
      /One Prism show record holds the accepted date, room, status, and version/,
  },
  {
    id: "ticket-data-integrity",
    diagramName: /Prism applies a proposed Posh sale once/,
    scenarioText: /Keep one trustworthy sold count/,
    detailText: /Idempotency means a retry has the same effect as one delivery/,
  },
  {
    id: "transaction-accuracy",
    diagramName: /Prism keeps refund, fee, cost, and deal facts separate/,
    scenarioText: /Close a settlement without hiding an exception/,
    detailText: /A typed financial ledger stores each amount with its type/,
  },
]) {
  test(`shows the ${lesson.id} scenario, diagram, and approaches`, async ({
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
    await expectNoDocumentOverflow(page);
  });
}

test("shows the complete ticket-data sequence", async ({ page }) => {
  await page.goto("/?lesson=ticket-data-integrity");

  for (const label of [
    "sale event arrives",
    "apply once",
    "duplicate retry",
    "acknowledge, no second effect",
    "request ticket report",
    "report pages 1 + 2",
    "stage partial report",
    "request page 3",
    "page 3 failure",
    "stage error + cursor",
    "keep last trusted facts",
    "retry page 3",
    "page 3 arrives",
    "stage complete report",
    "send complete scope",
    "validate and publish snapshot",
  ]) {
    await expect(
      page.locator("svg text").filter({ hasText: label }),
    ).toBeVisible();
  }
});

test("keeps every merged-diagram node title inside its node", async ({
  page,
}) => {
  for (const lesson of ["ticket-data-integrity", "transaction-accuracy"]) {
    await page.goto(`/?lesson=${lesson}`);
    const overflow = await page
      .locator(".architecture-diagram svg")
      .evaluate((svg) =>
        Array.from(
          svg.querySelectorAll<SVGTextElement>(
            ".architecture-node .architecture-node-title",
          ),
        )
          .map((title) => {
            const titleBox = title.getBBox();
            const node = title.closest(".architecture-node");
            const nodeBox = node?.querySelector("rect")?.getBBox();
            return {
              text: title.textContent,
              overflows:
                !nodeBox ||
                titleBox.x + titleBox.width > nodeBox.x + nodeBox.width,
            };
          })
          .filter((item) => item.overflows),
      );
    expect(overflow).toEqual([]);
  }
});

test("shows the transaction accuracy recovery flow", async ({ page }) => {
  await page.goto("/?lesson=transaction-accuracy");

  for (const label of [
    "refund −$45.00",
    "retained fee +$3.50",
    "unsupported expense $250.00",
    "Review queue",
    "Settlement checkpoint",
  ]) {
    await expect(
      page.locator("svg text").filter({ hasText: label }),
    ).toBeVisible();
  }
});

test("resolves legacy links to canonical lessons", async ({ page }) => {
  for (const [legacy, canonical, tab] of [
    ["webhooks", "ticket-data-integrity", "Ticket Data Integrity"],
    ["polling-snapshots", "ticket-data-integrity", "Ticket Data Integrity"],
    ["money-refunds", "transaction-accuracy", "Transaction Accuracy"],
    ["reconciliation-recovery", "transaction-accuracy", "Transaction Accuracy"],
  ]) {
    await page.goto(`/?lesson=${legacy}`);
    await expect(page).toHaveURL(new RegExp(`lesson=${canonical}`));
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  }
});

test("uses the approved keyboard tab order", async ({ page }) => {
  await page.goto("/");

  const api = page.getByRole("tab", { name: "API Mapping" });
  await api.focus();
  await api.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Ordering & Conflicts" }),
  ).toBeFocused();
  await expect(page).toHaveURL(/lesson=ordering-conflicts/);

  const ordering = page.getByRole("tab", { name: "Ordering & Conflicts" });
  await ordering.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Ticket Data Integrity" }),
  ).toBeFocused();
  await expect(page).toHaveURL(/lesson=ticket-data-integrity/);
});

test("uses the approved footer order", async ({ page }) => {
  await page.goto("/?lesson=ordering-conflicts");

  await expect(
    page.getByRole("button", { name: "← API Mapping" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ticket Data Integrity →" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Ticket Data Integrity →" }).click();
  await expect(page).toHaveURL(/lesson=ticket-data-integrity/);
  await expect(
    page.getByRole("button", { name: "Transaction Accuracy →" }),
  ).toBeVisible();
});

test("keeps mobile diagrams inside a scrollable viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const lesson of ["ticket-data-integrity", "transaction-accuracy"]) {
    await page.goto(`/?lesson=${lesson}`);
    await expectNoDocumentOverflow(page);
    await expect(page.locator(".architecture-viewport")).toHaveAttribute(
      "tabindex",
      "0",
    );
  }
});
