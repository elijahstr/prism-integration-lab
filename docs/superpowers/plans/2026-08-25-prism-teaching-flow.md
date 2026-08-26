# Prism Teaching Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Integration Lab scenario library with seven Prism-purple lessons that explain each integration challenge before the unchanged safe action.

**Architecture:** Keep all lesson copy and associations in one pure web data module. Keep query parsing and URL serialization in the existing navigation module. Render small lesson, diagram, comparison, and trace components from `DashboardPage`, so the existing session, action, trace, and review behavior stays unchanged.

<!-- fig:teaching-flow-delivery -->

**Tech Stack:** Bun 1.3.11, TypeScript 7.0.2, Next.js 16.3.2, React 19.2.8, React DOM 19.2.8, Bun test, Playwright 1.62.1, and the existing Chrome DevTools workflow.

**Spec:** `docs/superpowers/specs/2026-08-25-prism-teaching-flow-design.md`

## Global Constraints

- Change only the `/integration-lab` presentation layer and its presentation data.
- Add no package, API route, database record, worker behavior, provider behavior, authorization rule, or deployment change.
- Keep all seven existing `ScenarioId` values and their backend behavior unchanged.
- Keep existing organization, run, session, raw trace, provider, event, and review interfaces available.
- Use only fictional providers, organizations, shows, people, fields, and financial data.
- Keep the fixed lesson order: Overview, API Mapping, Webhooks, Polling & Snapshots, Ordering & Conflicts, Money & Refunds, and Reconciliation & Recovery.
- Use `lesson` with `organization` and `run` in the URL. Invalid or absent `lesson` means `overview`.
- Use `history.pushState` only for lesson changes. Keep `history.replaceState` for organization and run changes.
- Use semantic tabs, arrow-key navigation, visible focus, and a polite announcement for scenario results.
- Keep light mode. Use dominant Prism purple `#6d28d9`, pale lavender, deep plum, and an Avenir-first humanist sans stack.
- Use no gradients, glow, colored side rails, AI attribution, or new font download.
- Use green only for recommendation or success, amber only for debt or caution, and red only for failure.
- Place each `Recommended` label above its green approach panel.
- Keep the page free of horizontal overflow at 390px.
- Use `Elijah Straight <59123589+elijahstr@users.noreply.github.com>` for implementation commits.
- Limit review work to three rounds. Run one independent code review after the simplify pass. Do not create an automatic review loop.

## Verified Facts, Inferences, and Guesses

**Verified facts:** `apps/web/src/app/components/dashboard.tsx` holds the current scenario metadata and action state. `apps/web/src/app/lib/navigation.ts` owns `organization` and `run` query state. `packages/contracts/src/scenario.ts` defines the seven scenario IDs. `tests/e2e/lab-scenarios.spec.ts` verifies every scenario trace.

**Inference:** A pure lesson contract prevents copy, tab order, scenario associations, and approach counts from drifting between components and browser tests.

**Guesses:** None. The lesson text and visual direction come from the approved specification.

## Implementation Boundary

The implementation does not alter data loading or action requests. `DashboardPage` continues to create a visitor session, request the same dashboard data, run the same scenario IDs, reset the same run, and render the same trace evidence.

The implementation moves only the current Integration Lab presentation out of `dashboard.tsx`. The provider, event, overview, review, raw-trace, and navigation pages keep their current route behavior.

## File Responsibility Map

| File | Responsibility |
|---|---|
| `apps/web/src/app/lib/integration-lessons.ts` | Defines the seven ordered lessons, scenario metadata, diagrams, approach cards, API-mapping terms, and pure contract checks. |
| `apps/web/src/app/lib/integration-lessons.test.ts` | Proves the fixed order, one-time scenario mapping, required API terms, and every comparison-card invariant. |
| `apps/web/src/app/lib/navigation.ts` | Parses and serializes `lesson` with the existing organization and run route state. |
| `apps/web/src/app/lib/navigation.test.ts` | Proves valid, invalid, and preserved lesson URL behavior. |
| `apps/web/src/app/components/lesson-diagram.tsx` | Renders one accessible, data-driven SVG diagram before a lesson action. |
| `apps/web/src/app/components/lesson-approach-cards.tsx` | Renders fit, two pros, two cons, one recommendation, cost, debt path, and failure prevention. |
| `apps/web/src/app/components/scenario-trace.tsx` | Renders the existing five-part trace and reset action without lesson copy. |
| `apps/web/src/app/components/integration-lessons.tsx` | Renders tab controls, selected lesson content, scenario actions, and the trace. |
| `apps/web/src/app/components/integration-lessons.test.tsx` | Renders the lesson component to static HTML and checks its semantic and visual-content contract. |
| `apps/web/src/app/components/dashboard.tsx` | Keeps session and action state. It supplies route state and handlers to `IntegrationLessons`. |
| `apps/web/src/app/components/dashboard-shell.tsx` | Keeps existing shell links. Its calls to `dashboardHref` preserve the extended route state across pages. |
| `apps/web/src/app/globals.css` | Applies the approved Prism-purple lesson layout, accessibility focus, and narrow-screen rules. |
| `tests/e2e/lab-scenarios.spec.ts` | Runs the existing seven scenarios from their new lesson locations. |
| `tests/e2e/integration-lessons.spec.ts` | Checks tabs, URL history, content order, and desktop/mobile visual safety. |
| `docs/superpowers/plans/prism-teaching-flow-companion/figures.ts` | Defines the plan dependency and verification figure. |
| `docs/superpowers/plans/prism-teaching-flow-companion/{build,serve}.ts` | Builds and serves a digest that is projected from this Markdown plan. |
| `.gitignore` | Ignores generated teaching-flow plan digest files. |

## Lesson and Scenario Mapping

| Lesson ID | Tab label | Existing scenario IDs |
|---|---|---|
| `overview` | Overview | None |
| `api-mapping` | API Mapping | `uncertain_event_match` |
| `webhooks` | Webhooks | `duplicate_webhook` |
| `polling-snapshots` | Polling & Snapshots | `provider_outage`, `rate_limit`, `incomplete_snapshot` |
| `ordering-conflicts` | Ordering & Conflicts | `late_update` |
| `money-refunds` | Money & Refunds | None |
| `reconciliation-recovery` | Reconciliation & Recovery | `provider_change` |

Each existing scenario ID occurs exactly once. Money & Refunds has no scenario because the current seven safe actions do not teach a money-specific integration failure.

## Task Dependency and Verification Gate

Task 1 provides the data and URL contract. Task 2 consumes the data contract. Task 3 connects Task 2 to the existing state machinery. Task 4 styles the connected surface. Task 5 proves the full flow in a browser. Task 6 simplifies, verifies, and sends one independent code review.

The verification gate has focused tests, full verification, one independent review, one triage, and no automatic review loop.

### Task 1: Define the lesson contract and extended route state

**Files:**
- Create: `apps/web/src/app/lib/integration-lessons.ts`
- Create: `apps/web/src/app/lib/integration-lessons.test.ts`
- Modify: `apps/web/src/app/lib/navigation.ts`
- Modify: `apps/web/src/app/lib/navigation.test.ts`

**Interfaces:**
- Consumes: `ScenarioId` and `ScenarioIdSchema.options` from `@prism/contracts`.
- Produces: `LessonId`, `LESSON_IDS`, `INTEGRATION_LESSONS`, `SCENARIOS_BY_ID`, `getLessonContractErrors`, `isLessonId`, `scenarioTitle`, and `withLesson`.
- Produces: `DashboardRouteState = { organizationSlug: string; runId: string | null; lesson: LessonId }`.
- Later consumers: lesson components consume `IntegrationLesson` and `ScenarioSummary`; `DashboardPage` uses `withLesson`; `DashboardShell` continues to use `dashboardHref`.

- [ ] **Step 1: Write the failing lesson-contract tests.**

Create `apps/web/src/app/lib/integration-lessons.test.ts` with direct data checks. Import only the pure data module and `ScenarioIdSchema`.

```ts
import { describe, expect, test } from "bun:test";
import { ScenarioIdSchema } from "@prism/contracts";
import {
  API_MAPPING_REQUIRED_TERMS,
  INTEGRATION_LESSONS,
  LESSON_IDS,
  getLessonContractErrors,
} from "./integration-lessons";

test("keeps the seven lesson tabs in the approved order", () => {
  expect(LESSON_IDS).toEqual([
    "overview", "api-mapping", "webhooks", "polling-snapshots",
    "ordering-conflicts", "money-refunds", "reconciliation-recovery",
  ]);
});

test("maps every existing scenario once", () => {
  const mapped = INTEGRATION_LESSONS.flatMap((lesson) => lesson.scenarioIds);
  expect([...mapped].sort()).toEqual([...ScenarioIdSchema.options].sort());
  expect(new Set(mapped).size).toBe(mapped.length);
});

test("keeps each challenge comparison complete", () => {
  expect(getLessonContractErrors(INTEGRATION_LESSONS)).toEqual([]);
});

test("keeps every required API-mapping term visible", () => {
  const lesson = INTEGRATION_LESSONS.find(({ id }) => id === "api-mapping")!;
  expect(lesson.searchText).toEqual(expect.stringContaining("canonical model"));
  for (const term of API_MAPPING_REQUIRED_TERMS) {
    expect(lesson.searchText.toLowerCase()).toContain(term);
  }
});
```

The actual contract test must also assert each challenge lesson has two or three approaches, exactly one `recommended: true`, one `cost`, one `debtPath`, one `failurePrevented`, and exactly two strings in each `pros` and `cons` tuple.

- [ ] **Step 2: Run the new lesson tests and verify failure.**

Run: `bun test apps/web/src/app/lib/integration-lessons.test.ts`

Expected: FAIL because `./integration-lessons` does not exist.

- [ ] **Step 3: Write the minimal lesson data module.**

Create `apps/web/src/app/lib/integration-lessons.ts`. Use this discriminated contract. Use readonly tuples so TypeScript rejects a third pro or a missing con.

```ts
import { ScenarioIdSchema, type ScenarioId } from "@prism/contracts";

export const LESSON_IDS = [
  "overview", "api-mapping", "webhooks", "polling-snapshots",
  "ordering-conflicts", "money-refunds", "reconciliation-recovery",
] as const;
export type LessonId = (typeof LESSON_IDS)[number];
export type LessonDiagram = {
  description: string;
  edges: readonly { from: string; to: string; label?: string }[];
  nodes: readonly { detail: string; id: string; label: string; tone?: "accent" | "neutral" }[];
};
export type LessonApproach = {
  cons: readonly [string, string];
  fit: string;
  id: string;
  label: string;
  pros: readonly [string, string];
  recommended: boolean;
};
type LessonBase = {
  diagram: LessonDiagram;
  id: LessonId;
  scenarioIds: readonly ScenarioId[];
  searchText: string;
  tabLabel: string;
  title: string;
};
export type OverviewLesson = LessonBase & {
  id: "overview";
  kind: "overview";
  readingOrder: readonly string[];
};
export type ChallengeLesson = LessonBase & {
  approaches: readonly [LessonApproach, LessonApproach, ...LessonApproach[]];
  challenge: string;
  cost: string;
  debtPath: string;
  failurePrevented: string;
  kind: "challenge";
};
export type IntegrationLesson = OverviewLesson | ChallengeLesson;
```

Add `SCENARIOS_BY_ID` with the exact existing IDs, titles, and descriptions from `dashboard.tsx`. Add `API_MAPPING_REQUIRED_TERMS` as lowercase strings: `canonical model`, `provider adapters`, `provider and external IDs`, `unknown values`, `integer cents`, `utc`, `source-zone`, `optional fields`, `capability records`, `mapping versions`, and `immutable raw-payload retention`.

Write the exact approved lesson copy from the specification into `INTEGRATION_LESSONS`. Mark EncoreTix, VenueWave, BoxGrid, and their fields as fictional in `searchText` and visible copy. Give every challenge lesson its specification approaches, cost, debt path, and failure prevented.

Set the API Mapping diagram description to `Three fictional provider shapes map into one explicit Prism model.` The component test uses this exact text.

Export these pure helpers:

```ts
export function isLessonId(value: string | null): value is LessonId {
  return LESSON_IDS.some((id) => id === value);
}

export function scenarioTitle(id: ScenarioId): string {
  return SCENARIOS_BY_ID[id].title;
}

export function getLessonContractErrors(
  lessons: readonly IntegrationLesson[],
): string[] {
  // Return one clear error for every violated count, missing text, or duplicate scenario ID.
}
```

The helper must check all seven IDs against `ScenarioIdSchema.options`. It must not throw at module import. Tests own the contract enforcement.

- [ ] **Step 4: Extend route parsing with a valid lesson value.**

Update `apps/web/src/app/lib/navigation.ts`. Import `LessonId` and `isLessonId` from `./integration-lessons`. Preserve the current organization validation and blank-run normalization.

```ts
export type DashboardRouteState = {
  lesson: LessonId;
  organizationSlug: string;
  runId: string | null;
};

export function dashboardLocation(/* current arguments */): DashboardRouteState {
  const parameters = new URLSearchParams(search);
  const requestedLesson = parameters.get("lesson");
  return {
    lesson: isLessonId(requestedLesson) ? requestedLesson : "overview",
    organizationSlug,
    runId,
  };
}

export function withLesson(
  state: DashboardRouteState,
  lesson: LessonId,
): DashboardRouteState {
  return { ...state, lesson };
}
```

Make `dashboardHref` serialize `organization`, `run` when present, and `lesson`. Keep `switchOrganization` on the selected lesson while it clears only `runId`. Keep `withScenarioRun` on the selected lesson.

- [ ] **Step 5: Extend the navigation tests before checking the implementation.**

Update `apps/web/src/app/lib/navigation.test.ts`. Update all expected route-state objects with `lesson: "overview"`. Add these direct cases.

```ts
test("parses a lesson with organization and run", () => {
  expect(dashboardLocation(
    "?organization=harborlight-live&run=run-123&lesson=webhooks",
    organizations,
    "northstar-presents",
  )).toEqual({
    lesson: "webhooks",
    organizationSlug: "harborlight-live",
    runId: "run-123",
  });
});

test("uses Overview for an invalid lesson without losing the run", () => {
  expect(dashboardLocation(
    "?organization=northstar-presents&run=run-123&lesson=unknown",
    organizations,
    "northstar-presents",
  )).toMatchObject({ lesson: "overview", runId: "run-123" });
});
```

Also assert `dashboardHref`, `dashboardNavigation`, `switchOrganization`, `withScenarioRun`, and `withLesson` preserve the selected lesson.

- [ ] **Step 6: Run focused unit tests and type checks.**

Run: `bun test apps/web/src/app/lib/integration-lessons.test.ts apps/web/src/app/lib/navigation.test.ts && bun run --cwd apps/web typecheck`

Expected: PASS. The output shows all lesson and navigation tests pass. TypeScript reports no type error.

- [ ] **Step 7: Commit the pure contracts.**

```bash
git add apps/web/src/app/lib/integration-lessons.ts apps/web/src/app/lib/integration-lessons.test.ts apps/web/src/app/lib/navigation.ts apps/web/src/app/lib/navigation.test.ts
git commit -m "feat: add integration lesson contracts"
```

### Task 2: Build focused lesson, diagram, comparison, and trace modules

**Files:**
- Create: `apps/web/src/app/components/lesson-diagram.tsx`
- Create: `apps/web/src/app/components/lesson-approach-cards.tsx`
- Create: `apps/web/src/app/components/scenario-trace.tsx`
- Create: `apps/web/src/app/components/integration-lessons.tsx`
- Create: `apps/web/src/app/components/integration-lessons.test.tsx`

**Interfaces:**
- Consumes: `IntegrationLesson`, `ChallengeLesson`, `LessonDiagram`, `LessonId`, `LessonApproach`, `SCENARIOS_BY_ID`, and `scenarioTitle` from `../lib/integration-lessons`.
- Consumes: `ScenarioId` and `ScenarioRunDto` from `@prism/contracts`.
- Produces: `IntegrationLessons(props)` for `DashboardPage`.
- Later consumer: Task 3 passes current route state, run handlers, and status from `DashboardPage`.

- [ ] **Step 1: Write a failing static-render test for the lesson surface.**

Create `apps/web/src/app/components/integration-lessons.test.tsx`. Use the already installed `react-dom/server`; do not add a renderer or test package.

```tsx
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
    expect(html.indexOf("Three fictional provider shapes map into one explicit Prism model.")).toBeLessThan(html.indexOf("Run scenario"));
    expect(html).toContain("Recommended");
    expect(html).toContain("Technical debt path");
    expect(html).toContain("Failure prevented");
  });
});
```

The test must also count six `data-approach-kind="pro"` and six `data-approach-kind="con"` values across the three rendered cards. It must check the `Recommended` label appears before the recommended card markup.

- [ ] **Step 2: Run the component test and verify failure.**

Run: `bun test apps/web/src/app/components/integration-lessons.test.tsx`

Expected: FAIL because `./integration-lessons` does not exist.

- [ ] **Step 3: Implement the accessible diagram component.**

Create `apps/web/src/app/components/lesson-diagram.tsx`. Use the `LessonDiagram` data as the only diagram source. Render a `<figure>` before action controls. Use an inline SVG with a visible `<title>` and `aria-labelledby`, plus text nodes for every node label and detail.

```tsx
export function LessonDiagram({ diagram, lessonId }: {
  diagram: LessonDiagram;
  lessonId: LessonId;
}) {
  const titleId = `${lessonId}-diagram-title`;
  return (
    <figure className="lesson-diagram" aria-labelledby={titleId}>
      <figcaption id={titleId}>{diagram.description}</figcaption>
      <svg viewBox="0 0 720 220" role="img" aria-labelledby={titleId}>
        <defs><marker id={`${lessonId}-arrow`} /* arrowhead only */ /></defs>
        {/* map nodes and edges from diagram */}
      </svg>
    </figure>
  );
}
```

Do not use a canvas, remote image, gradient, or hard-coded provider diagram in the component. Make node positions deterministic from their array index. Give the SVG a responsive container and use CSS for visual color.

- [ ] **Step 4: Implement comparison cards and trace extraction.**

Create `apps/web/src/app/components/lesson-approach-cards.tsx`. It accepts one `ChallengeLesson`. Render cards in source order. Put the standalone `Recommended` text immediately before the one card where `recommended` is true. The green panel starts after that label.

```tsx
export function LessonApproachCards({ lesson }: { lesson: ChallengeLesson }) {
  return <>
    <div className="lesson-approach-grid">
      {lesson.approaches.map((approach) => <ApproachCard key={approach.id} approach={approach} />)}
    </div>
    <dl className="lesson-tradeoff">
      <div><dt>Cost</dt><dd>{lesson.cost}</dd></div>
      <div className="lesson-debt"><dt>Technical debt path</dt><dd>{lesson.debtPath}</dd></div>
      <div className="lesson-prevention"><dt>Failure prevented</dt><dd>{lesson.failurePrevented}</dd></div>
    </dl>
  </>;
}
```

Each `ApproachCard` must render one fit statement, a `Pros` list with both tuple entries, and a `Cons` list with both tuple entries. Use `data-approach`, `data-approach-kind="pro"`, and `data-approach-kind="con"` attributes for deterministic browser checks. Do not add a colored side rail.

Create `apps/web/src/app/components/scenario-trace.tsx`. Move the current trace panel markup from `IntegrationLab` without changing the trace step order, labels, reset behavior, or `aria-live="polite"` behavior. It accepts these exact props:

```ts
type ScenarioTraceProps = {
  onReset: () => Promise<void>;
  pendingAction: string | null;
  run: ScenarioRunDto | null;
  status: string;
};
```

Use `scenarioTitle(run.scenario)` instead of a local scenario list. Keep the current no-run text: `Run a scenario to inspect its input, state changes, database effect, audit result, and explanation.`

- [ ] **Step 5: Implement the IntegrationLessons coordinator.**

Create `apps/web/src/app/components/integration-lessons.tsx` with this exact public interface.

```ts
export type IntegrationLessonsProps = {
  activeLessonId: LessonId;
  onReset: () => Promise<void>;
  onRun: (scenario: ScenarioId) => Promise<void>;
  onSelectLesson: (lesson: LessonId) => void;
  pendingAction: string | null;
  run: ScenarioRunDto | null;
  status: string;
};
```

Render seven `<button type="button" role="tab">` elements from `INTEGRATION_LESSONS`. Give each button a stable ID, `aria-controls`, `aria-selected`, `data-lesson-id`, and roving `tabIndex`. Render one `role="tabpanel"` with matching `aria-labelledby`.

Add `onKeyDown` to each tab. `ArrowRight` and `ArrowDown` select the next tab. `ArrowLeft` and `ArrowUp` select the previous tab. `Home` selects Overview. `End` selects Reconciliation & Recovery. Each key prevents the browser default, calls `onSelectLesson`, and focuses its new tab through an ordered ref array.

Render the selected lesson in this strict visual order:

1. The fictional-provider label and architecture challenge.
2. `LessonDiagram`.
3. `LessonApproachCards` for challenge lessons.
4. The selected lesson scenario action cards, when `scenarioIds.length > 0`.
5. `ScenarioTrace` when the current run belongs to the selected lesson.

Wrap each item in a stable `data-lesson-section` value: `challenge`, `diagram`, `approaches`, `actions`, or `trace`. The Playwright test uses those values to prove diagram-before-action order.

Give every action button `data-scenario-id={scenario.id}`. Disable it while `pendingAction !== null`. Keep the exact current title and description from `SCENARIOS_BY_ID`. For a trace that belongs to another lesson, render one short link-like button: `View the current trace in {source tab label}`. It calls `onSelectLesson` with the source lesson ID. This preserves trace access without copying it into unrelated lessons.

Overview renders its fictional concert story, the reading order, the three fictional sources, and no approach cards. Money & Refunds renders no scenario action because its `scenarioIds` is empty.

- [ ] **Step 6: Run component and contract tests.**

Run: `bun test apps/web/src/app/lib/integration-lessons.test.ts apps/web/src/app/components/integration-lessons.test.tsx && bun run --cwd apps/web typecheck`

Expected: PASS. The static markup shows the tab roles, diagram before action, approach cards, recommendation label, debt path, and failure-prevention text.

- [ ] **Step 7: Commit the focused presentation modules.**

```bash
git add apps/web/src/app/components/lesson-diagram.tsx apps/web/src/app/components/lesson-approach-cards.tsx apps/web/src/app/components/scenario-trace.tsx apps/web/src/app/components/integration-lessons.tsx apps/web/src/app/components/integration-lessons.test.tsx
git commit -m "feat: add integration lesson components"
```

### Task 3: Connect lesson selection to DashboardPage history and existing actions

**Files:**
- Modify: `apps/web/src/app/components/dashboard.tsx`
- Modify: `apps/web/src/app/components/dashboard-shell.tsx`
- Test: `apps/web/src/app/lib/navigation.test.ts`
- Test: `tests/e2e/integration-lessons.spec.ts` in Task 5

**Interfaces:**
- Consumes: `withLesson`, `dashboardLocation`, `dashboardHref`, `DashboardRouteState`, `IntegrationLessons`, and existing `runScenario` and `resetRun` handlers.
- Produces: browser history that pushes only a lesson change and restores state on `popstate`.
- Preserves: `createLabSession`, `loadDashboardSession`, `requestScenarioRun`, `requestScenarioReset`, action generation guards, session storage, and non-lab content branches.

- [ ] **Step 1: Write the failing route-state behavior into the focused unit tests.**

Extend `apps/web/src/app/lib/navigation.test.ts` with a history-safe state change test.

```ts
test("changes only the lesson while it keeps organization and run", () => {
  expect(withLesson(
    { lesson: "webhooks", organizationSlug: "harborlight-live", runId: "run-123" },
    "api-mapping",
  )).toEqual({
    lesson: "api-mapping",
    organizationSlug: "harborlight-live",
    runId: "run-123",
  });
});
```

This test must fail before Task 1 exists. Do not use a DOM mock. The browser-level back and forward behavior belongs in Task 5.

- [ ] **Step 2: Replace the local IntegrationLab surface in DashboardPage.**

In `apps/web/src/app/components/dashboard.tsx`, remove the local `scenarios` constant and the local `IntegrationLab` component. Import `IntegrationLessons`, `scenarioTitle`, and `withLesson`.

Add `lesson: "overview"` to the existing `defaultRouteState`. Keep the existing state and action handler names. Replace the run-status title lookup with `scenarioTitle(scenario)`.

```tsx
<IntegrationLessons
  activeLessonId={routeState.lesson}
  onReset={resetRun}
  onRun={runScenario}
  onSelectLesson={selectLesson}
  pendingAction={pendingAction}
  run={run}
  status={labStatus}
/>
```

The `page === "lab"` branch changes only to this component. Do not alter the overview, providers, events, reviews, or loading branches.

- [ ] **Step 3: Add explicit push, replace, and popstate behavior.**

Keep `replaceRouteState(nextState)` for organization and run changes. Add a `pushLesson(lesson)` function that refuses a no-op and keeps the current `organizationSlug` and `runId`.

```ts
function selectLesson(lesson: LessonId) {
  const nextState = withLesson(routeState, lesson);
  if (nextState.lesson === routeState.lesson) return;
  window.history.pushState(null, "", dashboardHref(window.location.pathname, nextState));
  setRouteState(nextState);
}
```

Add one `useEffect` that registers `window.addEventListener("popstate", onPopState)` and removes it on cleanup. In `onPopState`, parse the URL with `dashboardLocation`.

When only `lesson` changed, set the parsed route state and keep the in-memory run. When organization or run changed, invalidate through the existing load coordinator and call `startSession(nextState)`. This prevents a browser Back action from showing a trace or session from another route state.

Use a `routeStateRef` that updates after each state change. The listener reads the ref instead of a stale closure. Do not attach multiple listeners during refreshes.

- [ ] **Step 4: Preserve lesson state through the dashboard shell.**

Add `lesson: "overview"` to the existing `defaultRouteState` object in `apps/web/src/app/components/dashboard-shell.tsx`. Do not add a second URL builder. Its existing `dashboardHref(item.href, navigationState)` calls then carry `organization`, `run`, and `lesson` together across the existing dashboard links.

Run the type check after Task 1 and Task 3. It proves every `DashboardRouteState` object in `DashboardPage` and `DashboardShell` now includes `lesson`.

- [ ] **Step 5: Run focused state tests and the web type check.**

Run: `bun test apps/web/src/app/lib/navigation.test.ts apps/web/src/app/lib/dashboard-load.test.ts apps/web/src/app/lib/dashboard-session.test.ts && bun run --cwd apps/web typecheck`

Expected: PASS. Existing stale-load and session tests still pass. TypeScript finds no unhandled route-state object.

- [ ] **Step 6: Commit the DashboardPage integration.**

```bash
git add apps/web/src/app/components/dashboard.tsx apps/web/src/app/components/dashboard-shell.tsx apps/web/src/app/lib/navigation.test.ts
git commit -m "feat: connect integration lesson navigation"
```

### Task 4: Apply the approved Prism-purple lesson layout

**Files:**
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes: stable class names from `IntegrationLessons`, `LessonDiagram`, `LessonApproachCards`, and `ScenarioTrace`.
- Produces: fixed-light, responsive lesson styles with no new asset or package.
- Preserves: existing dashboard layout and all non-lab component class behavior.

- [ ] **Step 1: Add a focused CSS contract checklist before changing CSS.**

Add the following expected class names to the component static-render test in `apps/web/src/app/components/integration-lessons.test.tsx`:

```ts
expect(html).toContain('class="lesson-tabs"');
expect(html).toContain('class="lesson-diagram"');
expect(html).toContain('class="lesson-approach recommended"');
expect(html).toContain('class="lesson-recommendation-label"');
expect(html).toContain('class="lesson-debt"');
```

Expected before CSS work: the test may already pass because component classes exist. The browser task proves the layout result.

- [ ] **Step 2: Set the approved palette and font stack.**

Update the root CSS variables in `apps/web/src/app/globals.css`.

```css
:root,
:root[data-theme="dark"],
:root[data-theme="light"] {
  color-scheme: light;
  --accent: #6d28d9;
  --accent-deep: #35135f;
  --accent-pale: #f3eeff;
  --lesson-plum: #2b164f;
  --lesson-lavender: #eee7ff;
  --lesson-recommendation-bg: #edf9f1;
  --lesson-debt-bg: #fff5dc;
  --lesson-failure-bg: #fff0ef;
  font-family: Avenir Next, Avenir, "Segoe UI", Helvetica, Arial, sans-serif;
}
```

Keep the existing fixed-light `@media (prefers-color-scheme: dark)` fallback aligned with these values. Do not load a web font. Use deep plum for lesson headings and white for content surfaces.

- [ ] **Step 3: Add lesson-specific desktop styles.**

Add scoped `.lesson-*` rules after the existing Integration Lab styles. Use a white content panel, a pale-lavender active tab, and a purple selected-tab border that is not a colored side rail.

```css
.lesson-tabs { display: flex; flex-wrap: wrap; gap: 8px; }
.lesson-tab[aria-selected="true"] { background: var(--lesson-lavender); border-color: var(--accent); color: var(--accent-deep); }
.lesson-diagram { background: #fff; border: 1px solid var(--border); border-radius: 16px; margin: 20px 0; padding: 18px; }
.lesson-approach-grid { display: grid; gap: 14px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.lesson-approach { background: #fff; border: 1px solid var(--border); border-radius: 16px; min-width: 0; padding: 18px; }
.lesson-recommendation-label { color: var(--success-ink); font-weight: 800; margin: 0 0 6px; }
.lesson-approach.recommended { background: var(--lesson-recommendation-bg); border-color: #7ac89a; }
.lesson-debt { background: var(--lesson-debt-bg); }
.lesson-prevention { background: var(--lesson-failure-bg); }
```

Do not use `box-shadow`, a gradient, a `border-left`, or a pseudo-element rail for these panels. Use a standard full border and surface color. Use green only on the recommended label and panel. Use amber only on the debt detail. Use red only on the failure-prevention detail.

- [ ] **Step 4: Add narrow-screen and focus behavior.**

At `max-width: 680px`, stack lesson tabs, diagrams, comparison cards, action cards, and tradeoff details to one column. Set `min-width: 0` on every lesson grid child. Give the SVG `display: block; max-width: 100%; height: auto;`. Use `overflow-wrap: anywhere` for long debt text. Keep any table scroll rule scoped to existing tables, not lesson cards.

At 390px, tabs may wrap but must not make the document wider than the viewport. Keep `button:focus-visible` and add `.lesson-tab:focus-visible { outline: 3px solid var(--accent-deep); outline-offset: 3px; }`.

- [ ] **Step 5: Run focused checks after the style change.**

Run: `bun test apps/web/src/app/components/integration-lessons.test.tsx && bun run --cwd apps/web typecheck && bun run format:check`

Expected: PASS. Formatting reports no changed file. The static render still includes the visual class contract.

- [ ] **Step 6: Commit the approved style work.**

```bash
git add apps/web/src/app/globals.css apps/web/src/app/components/integration-lessons.test.tsx
git commit -m "style: apply Prism lesson presentation"
```

### Task 5: Preserve every scenario and prove the teaching flow in Playwright

**Files:**
- Modify: `tests/e2e/lab-scenarios.spec.ts`
- Create: `tests/e2e/integration-lessons.spec.ts`

**Interfaces:**
- Consumes: `data-lesson-id`, `data-scenario-id`, semantic tab roles, trace text, and the existing public server command from `playwright.config.ts`.
- Produces: browser evidence for seven unchanged actions and the new presentation contract.
- Preserves: visitor isolation checks and scenario trace assertions.

- [ ] **Step 1: Update each existing scenario test to select its lesson first.**

In `tests/e2e/lab-scenarios.spec.ts`, add `id` and `lesson` to every `ScenarioExpectation`.

```ts
type ScenarioExpectation = {
  audit: string;
  databaseEffect: RegExp | string;
  id: ScenarioId;
  lesson: string;
  normalized: string;
  title: string;
};
```

Use this exact mapping:

```ts
duplicate_webhook: "webhooks",
late_update: "ordering-conflicts",
provider_outage: "polling-snapshots",
rate_limit: "polling-snapshots",
uncertain_event_match: "api-mapping",
incomplete_snapshot: "polling-snapshots",
provider_change: "reconciliation-recovery",
```

Replace the old `.scenario` locator with this interaction.

```ts
await page.goto("/integration-lab");
await page.locator(`[role="tab"][data-lesson-id="${scenario.lesson}"]`).click();
await page.locator(`button[data-scenario-id="${scenario.id}"]`).click();
```

Keep all existing normalized output, database effect, audit text, URL run-ID, and isolated-browser assertions. Replace `Scenario library` readiness text with the tablist role. The isolated visitor must still receive the unavailable dashboard state and no protected trace evidence.

- [ ] **Step 2: Run the changed scenario file and verify the expected initial failure.**

Run: `bun run test:e2e -- tests/e2e/lab-scenarios.spec.ts`

Expected before Tasks 2 through 4 finish: FAIL because lesson tabs or `data-scenario-id` controls do not exist. Expected after Tasks 2 through 4: seven scenario tests PASS.

- [ ] **Step 3: Add focused lesson-flow browser tests.**

Create `tests/e2e/integration-lessons.spec.ts` with these tests.

```ts
import { expect, test } from "@playwright/test";

test("shows the approved seven-tab teaching order", async ({ page }) => {
  await page.goto("/integration-lab?organization=northstar-presents");
  await expect(page.getByRole("tab")).toHaveText([
    "Overview", "API Mapping", "Webhooks", "Polling & Snapshots",
    "Ordering & Conflicts", "Money & Refunds", "Reconciliation & Recovery",
  ]);
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
});

test("teaches API mapping before an action and keeps the full mapping vocabulary", async ({ page }) => {
  await page.goto("/integration-lab?organization=harborlight-live&lesson=api-mapping");
  const panel = page.getByRole("tabpanel");
  await expect(panel).toContainText("canonical model");
  await expect(panel).toContainText("immutable raw-payload retention");
  await expect(panel.locator(".lesson-diagram")).toBeVisible();
  await expect(panel.locator(".lesson-recommendation-label")).toHaveText("Recommended");
  await expect(panel.locator("[data-approach]")).toHaveCount(3);
  await expect(panel.locator("[data-approach-kind=pro]")).toHaveCount(6);
  await expect(panel.locator("[data-approach-kind=con]")).toHaveCount(6);
  await expect(panel).toContainText("Technical debt path");
  await expect(panel).toContainText("Failure prevented");
  const sectionOrder = await panel.locator("[data-lesson-section]").evaluateAll(
    (nodes) => nodes.map((node) => node.getAttribute("data-lesson-section")),
  );
  expect(sectionOrder.indexOf("diagram")).toBeLessThan(sectionOrder.indexOf("actions"));
});
```

Add a history test that performs this exact route sequence in one browser session:

1. Start at `?organization=northstar-presents`.
2. Select API Mapping and assert `lesson=api-mapping` with the same organization and no run.
3. Select Webhooks and run `duplicate_webhook`.
4. Record the generated run ID. Select API Mapping.
5. Call `page.goBack()` and assert Webhooks is selected, the same run ID remains, and its trace is visible.
6. Call `page.goForward()` and assert API Mapping is selected, with the same organization and run ID.
7. Change organization with the existing select. Assert the lesson stays selected and `run` is absent.

Add keyboard tests for ArrowRight, ArrowLeft, Home, and End. Assert selection and focus move together.

Add browser checks at desktop and `page.setViewportSize({ width: 390, height: 844 })`. On each, collect `page.on("console")` errors, assert no page error occurs, and assert:

```ts
expect(await page.evaluate(
  () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
)).toBe(true);
```

- [ ] **Step 4: Run the focused browser tests.**

Run: `bun run test:e2e -- tests/e2e/lab-scenarios.spec.ts tests/e2e/integration-lessons.spec.ts`

Expected: PASS. The output reports seven scenario tests and all lesson-flow tests passed. No console errors appear.

- [ ] **Step 5: Commit the browser coverage.**

```bash
git add tests/e2e/lab-scenarios.spec.ts tests/e2e/integration-lessons.spec.ts
git commit -m "test: cover integration lesson flow"
```

### Task 6: Simplify, verify, and perform one independent review

**Files:**
- Modify only if the checks expose a real presentation defect: the smallest affected file from Tasks 1 through 5.
- Verify: all files from Tasks 1 through 5.

**Interfaces:**
- Consumes: the completed lesson contract, UI modules, URL state, CSS, and Playwright checks.
- Produces: a clean, reviewer-ready feature branch with fresh evidence.
- Review boundary: one independent code review after the simplify pass. Do not start a repeated review gate.

- [ ] **Step 1: Run the simplify pass before the final review.**

Read the changed diff. Remove only duplication that the new modules introduced. Keep one lesson source of truth. Keep one URL serialization path. Keep the existing action-generation and session safeguards.

Do not change API, database, provider, worker, scenario, authorization, or deployment files. Do not remove a test to make the check pass.

- [ ] **Step 2: Run all focused checks after simplification.**

Run: `bun test apps/web/src/app/lib/integration-lessons.test.ts apps/web/src/app/lib/navigation.test.ts apps/web/src/app/components/integration-lessons.test.tsx && bun run test:e2e -- tests/e2e/lab-scenarios.spec.ts tests/e2e/integration-lessons.spec.ts && bun run --cwd apps/web typecheck && bun run format:check`

Expected: PASS. The route, data, static render, scenario, lesson, type, and format checks all pass.

- [ ] **Step 3: Run the complete repository verification.**

Run: `env -u NO_COLOR bun run verify && git diff --check && git status --short`

Expected: `bun run verify` passes formatting, type checks, unit tests, production build, and Playwright tests. `git diff --check` has no output. `git status --short` has no uncommitted implementation file.

- [ ] **Step 4: Inspect the finished interface with Chrome DevTools.**

Start the existing public server with the local Postgres and Redis values from the project README. Inspect `/integration-lab` at a desktop size and at 390×844.

Confirm the fixed-light Prism-purple surface, Avenir-first type stack, seven tabs, tab focus, diagram-before-action order, standalone Recommended label above a green panel, amber debt panel, red failure panel, working trace, no console error, and no page-level horizontal overflow.

Use the browser results as evidence. Do not claim visual completion from CSS source alone.

- [ ] **Step 5: Run one independent code review.**

Use `external-pr-reviewer` on the completed branch after the simplify pass. Give the reviewer the approved specification, this plan, the final diff, and the following constraints: presentation-only scope, no new dependency, every scenario ID mapped once, and one review round by default.

Triage the returned findings once. If it reports a material defect, fix it, rerun the exact focused check that proves the fix, then rerun `env -u NO_COLOR bun run verify`. Do not start another review automatically. Report any remaining concern to the user.

## Locked Decisions

- The implementation is presentation only. Existing system behavior remains unchanged.
- The seven lessons and their order are fixed.
- All seven scenario IDs map once, with no Money & Refunds action.
- A canonical model is taught through provider adapters, raw evidence, capabilities, unknown-value retention, and mapping versions.
- Each challenge lesson uses two or three approaches and exactly one recommendation.
- Every approach has one fit statement, exactly two pros, and exactly two cons.
- The recommendation label sits above the green panel.
- The selected approach states a cost, a technical-debt path, and a failure prevented.
- Browser tab changes use push history. Organization and run changes use replace history.
- No dependency is added.

## Open Questions

None. The design is approved.

## Plan Self-Review

### Specification coverage

| Specification requirement | Plan task |
|---|---|
| Seven fixed tabs and Overview story | Tasks 1 and 2 |
| Provider challenge, diagram, approaches, recommendation, cost, debt, and prevention | Tasks 1, 2, and 4 |
| Canonical model and all API-mapping terms | Task 1 and Task 5 |
| Fictional labels and unchanged provider behavior | Tasks 1, 2, and 6 |
| Existing actions, traces, and review details | Tasks 2, 3, and 5 |
| `organization`, `run`, and `lesson` URL behavior with browser history | Tasks 1, 3, and 5 |
| Semantic tabs, keyboard use, result announcement, 390px safety | Tasks 2, 4, and 5 |
| Prism-purple, light, Avenir-first visual direction | Task 4 and Task 6 |
| No new dependency or backend change | Global Constraints and Task 6 |

### Type consistency

`LessonId` starts in `integration-lessons.ts`. `DashboardRouteState.lesson`, `withLesson`, `IntegrationLessonsProps.activeLessonId`, and the browser `data-lesson-id` use the same ID values. `ScenarioId` stays in `@prism/contracts` and the lesson contract only references it.

### Placeholder scan

This plan has no deferred implementation marker. Each task names its files, tests, commands, failure result, expected pass result, and commit boundary.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-25-prism-teaching-flow.md`.

1. **Subagent-Driven (recommended)**: Use `superpowers:subagent-driven-development`. Dispatch one fresh implementation subagent for each task. Review each task result before the next task.
2. **Inline Execution**: Use `superpowers:executing-plans`. Execute tasks in order with the verification gates above.

Use the approved specification with this plan during execution.
