# Diagram overlap fix report

## Result

The lesson diagram now uses one responsive HTML and CSS flow.

The fixed SVG and the separate mobile duplicate no longer exist.

The flow uses the existing `LessonDiagram` nodes and edges only.

## Changed files

- `apps/web/src/app/components/lesson-diagram.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/components/integration-lessons.test.tsx`
- `tests/e2e/integration-lessons.spec.ts`

## Design

`lesson-diagram-flow` renders the diagram nodes in an auto-fit grid.

Each `lesson-diagram-flow-node` contains its label and detail as DOM text.

`lesson-diagram-paths` renders each relationship as source, arrow, optional label, arrow, and target.

At 680px and below, the node grid changes to one column.

The path rows wrap their text within full neutral borders.

The diagram uses Prism purple and lavender only.

It adds no gradient, glow, shadow, or side rail.

## TDD evidence

The first focused component test run was RED.

It failed because the stylesheet had no `lesson-diagram-flow` grid and the render had no flow nodes.

The current render instead contained an SVG and `lesson-diagram-mobile` duplicate.

The implementation then made the same focused test pass.

## Browser evidence

The first browser regression run was RED after the source edit.

The public server served the existing static `apps/web/out` build, so it had zero flow nodes.

`bun run build` refreshed that static output.

The desktop and 390px browser tests then passed.

Each visible node now has a nonempty label and detail with `scrollWidth <= clientWidth`.

Each relationship row has `scrollWidth <= clientWidth`.

The desktop screenshot shows four readable nodes and three separate relationship rows.

## Verification

Passed:

- Focused component test: 2 tests.
- Focused lesson and navigation tests: 18 tests.
- Both E2E files: 13 tests.
- Re-run lesson E2E after the final accessibility change: 6 tests.
- Web TypeScript check.
- Repository format check.
- Production web build.

`env -u NO_COLOR bun run verify` failed twice in an unrelated worker integration test.

`apps/worker/src/jobs/dispatch-outbox.integration.test.ts` expected 14 tickets and 36500 cents.

The full suite instead read 16 and 41500 cents, then 22 and 56500 cents.

The same test passed when run alone.

This evidence indicates shared local test data during the full suite.

This task does not change worker code, test data, database behavior, or test isolation.

## Scope check

The change does not modify lesson copy, scenarios, APIs, database code, workers, providers, security, dependencies, or deployment configuration.
