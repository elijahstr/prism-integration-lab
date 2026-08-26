import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import { IntegrationLessons } from "./integration-lessons";

describe("IntegrationLessons", () => {
  test("declares the Prism lesson stylesheet contract", () => {
    const css = readFileSync(
      new URL("../globals.css", import.meta.url),
      "utf8",
    );
    const mobileStyles = css.slice(css.indexOf("@media (max-width: 680px)"));

    expect(css).toContain("--accent: #6d28d9;");
    expect(css).toMatch(
      /font-family:\s*Avenir Next,\s*Avenir,\s*"Segoe UI",\s*Helvetica,\s*Arial,\s*sans-serif;/,
    );
    expect(css).toMatch(/\.lesson-approach\.recommended\s*\{/);
    expect(css).toMatch(
      /\.lesson-diagram-flow\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(170px,\s*1fr\)\);/s,
    );
    expect(css).toMatch(
      /\.lesson-diagram-flow-node\s*\{[^}]*border:\s*1px solid var\(--border\);/s,
    );
    expect(css).toMatch(
      /\.lesson-diagram-paths\s*\{[^}]*overflow-wrap:\s*anywhere;/s,
    );
    expect(mobileStyles).toMatch(
      /\.lesson-diagram-flow\s*\{\s*grid-template-columns:\s*1fr;/,
    );

    for (const selector of [
      ".lesson-approach.recommended",
      ".lesson-tradeoff",
      ".lesson-tradeoff > div",
      ".lesson-debt",
      ".lesson-prevention",
    ]) {
      const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rule = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));

      expect(rule?.[1]).not.toContain("border-left");
    }
  });

  test("renders API Mapping before its action with a recommended comparison", () => {
    const html = renderToStaticMarkup(
      <IntegrationLessons
        activeLessonId="api-mapping"
        onReset={() => Promise.resolve()}
        onRun={() => Promise.resolve()}
        onSelectLesson={() => {}}
        pendingAction={null}
        run={null}
        status="No scenario has run."
      />,
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('data-lesson-id="api-mapping"');
    expect(html).toContain('class="lesson-tabs"');
    expect(html).toContain('class="lesson-diagram"');
    expect(html).toContain('class="lesson-diagram-flow"');
    expect(html).toContain('class="lesson-diagram-flow-node"');
    expect(html).toContain("EncoreTix");
    expect(html).toContain("Fictional saleWebhook.sale_id field");
    expect(html).toContain('class="lesson-diagram-paths"');
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("lesson-diagram-mobile");
    expect(
      html.indexOf(
        "Three fictional provider shapes map into one explicit Prism model.",
      ),
    ).toBeLessThan(html.indexOf("Run scenario"));
    expect(html).toContain("Recommended");
    expect(html).toContain("Technical debt path");
    expect(html).toContain("Failure prevented");
    expect(html).toContain('class="lesson-approach recommended"');
    expect(html).toContain('class="lesson-recommendation-label"');
    expect(html).toContain('class="lesson-debt"');
    expect(html.match(/data-approach-kind="pro"/g) ?? []).toHaveLength(6);
    expect(html.match(/data-approach-kind="con"/g) ?? []).toHaveLength(6);
    expect(html.indexOf("Recommended")).toBeLessThan(
      html.indexOf('data-approach="canonical-adapters"'),
    );
  });
});
