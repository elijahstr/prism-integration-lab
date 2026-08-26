import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { IntegrationLessons } from "./integration-lessons";

describe("IntegrationLessons", () => {
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
    expect(
      html.indexOf(
        "Three fictional provider shapes map into one explicit Prism model.",
      ),
    ).toBeLessThan(html.indexOf("Run scenario"));
    expect(html).toContain("Recommended");
    expect(html).toContain("Technical debt path");
    expect(html).toContain("Failure prevented");
    expect((html.match(/data-approach-kind="pro"/g) ?? [])).toHaveLength(6);
    expect((html.match(/data-approach-kind="con"/g) ?? [])).toHaveLength(6);
    expect(html.indexOf("Recommended")).toBeLessThan(
      html.indexOf('data-approach="canonical-adapters"'),
    );
  });
});
