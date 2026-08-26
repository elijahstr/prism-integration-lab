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
    const diagramStyles = css.match(
      /\.lesson-diagram > svg\s*\{([^}]*)\}/,
    )?.[1];

    expect(css).toContain("--accent: #6d28d9;");
    expect(css).toMatch(
      /font-family:\s*Avenir Next,\s*Avenir,\s*"Segoe UI",\s*Helvetica,\s*Arial,\s*sans-serif;/,
    );
    expect(css).toMatch(/\.lesson-approach\.recommended\s*\{/);
    expect(diagramStyles).toContain("display: block;");
    expect(diagramStyles).toContain("height: auto;");
    expect(diagramStyles).toContain("max-width: 100%;");
    expect(css).toMatch(/\.lesson-diagram-mobile\s*\{\s*display: none;/);
    expect(mobileStyles).toMatch(
      /\.lesson-diagram > svg\s*\{\s*display: none;/,
    );
    expect(mobileStyles).toMatch(
      /\.lesson-diagram-mobile\s*\{\s*display: block;/,
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
    expect(html).toContain('class="lesson-diagram-mobile"');
    expect(html).toContain('class="lesson-debt"');
    expect(html.match(/data-approach-kind="pro"/g) ?? []).toHaveLength(6);
    expect(html.match(/data-approach-kind="con"/g) ?? []).toHaveLength(6);
    expect(html.indexOf("Recommended")).toBeLessThan(
      html.indexOf('data-approach="canonical-adapters"'),
    );
  });
});
