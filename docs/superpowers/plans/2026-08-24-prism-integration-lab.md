# Prism Integration Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, zero-cost portfolio demo that proves safe, explainable ticket-provider ingestion through seven controlled scenarios.

**Architecture:** Keep the web, API, worker, contracts, domain, database, and provider code in focused TypeScript workspaces. PostgreSQL owns durable facts and an outbox. BullMQ provides at-least-once work delivery, while database constraints provide idempotency. The free public deployment combines the static web build, Fastify API, and BullMQ worker in one Render web process.

<!-- fig:free-public-topology -->

**Tech Stack:** Bun workspaces, TypeScript, Next.js, React, Fastify, BullMQ, PostgreSQL, Redis, Zod, Bun test, Playwright, Docker Compose, Render, Neon, and Upstash.

**Spec:** `docs/superpowers/specs/2026-08-24-prism-integration-lab-design.md`

## Global Constraints

- Show “Unofficial portfolio prototype” on every main page.
- Use only fictional providers, organizations, shows, people, and financial data.
- Store money as integer cents in one demo currency: USD.
- Store system timestamps in UTC.
- Use at-least-once delivery and idempotent database effects.
- Never claim exactly-once delivery.
- Never apply uncertain event matches or incomplete snapshots.
- Keep current financial facts provider scoped.
- Preserve raw messages and audit entries until their demo session expires.
- Scope every mutable row by one non-null `scope_id`.
- Never trust an organization ID or scope ID from the browser.
- Derive webhook scope from a server-side provider connection.
- Keep application workspaces independent. They can import shared packages only.
- Use one free public application process. Keep separate local API and worker processes.
- Do not add AI attribution, generated-by labels, or AI co-author lines.
- Use `Elijah Straight <59123589+elijahstr@users.noreply.github.com>` for commits.

## Decisions Added During Planning

### Free deployment packaging

The public demo uses one free Render web service. It serves the Next.js static export, runs Fastify, and starts one BullMQ worker.

This differs from the specification's separate public processes. The cost stays at $0, but the API and worker share one failure boundary.

Render sleeps a free web service after 15 idle minutes. The first request can take about one minute. Warm the demo before a presentation. [Render free limits](https://render.com/docs/free)

Neon Free supplies PostgreSQL without Render's 30-day database expiry. It includes 0.5 GB storage and 100 compute-unit hours per project. [Neon pricing](https://neon.com/pricing)

Upstash Free supplies persistent Redis-compatible storage. Its limit is 256 MB and 500,000 commands monthly. [Upstash pricing](https://upstash.com/pricing/redis)

Upstash supports BullMQ through the Redis protocol. Increase idle delays because BullMQ polls Redis when no jobs exist. [Upstash BullMQ guide](https://upstash.com/docs/redis/integrations/bullmq)

### Durable database-to-queue handoff

Accept each message and create an `ingestion_outbox` row in one PostgreSQL transaction. A dispatcher repeatedly publishes undispatched rows to BullMQ.

This closes the crash gap between a database commit and a Redis publish. Redis remains coordination state, not the only copy of accepted work.

### Message semantics

EncoreTix sales and refunds are immutable effects. Each unique effect applies once, even when it arrives late.

BoxGrid snapshots are absolute provider-scoped state. A provider-specific sequence gate prevents an older snapshot from replacing a newer snapshot.

VenueWave pages contain immutable effects. The cursor advances only after every effect on the page is durable.

### Visitor isolation

The API creates a random 256-bit lab token. It stores `HMAC-SHA256(LAB_TOKEN_PEPPER, token)` and never stores the token. The browser keeps the token in session storage.

Every lab request sends the token through the `Authorization: Lab <token>` header. This avoids cross-origin cookie and CSRF complexity.

The token is not authentication. It is an unguessable capability for fictional, disposable demo data.

## Package Approval Gate

Implementation must not install packages until the user approves this plan and its exact dependency set.

Production dependencies:

| Package | Exact version | Owner and license | Purpose | Alternative not selected |
|---|---:|---|---|---|
| `next` | `16.3.2` | Vercel, MIT | Static dashboard build | Vite would replace the selected Next.js stack |
| `react` / `react-dom` | `19.2.8` | Meta, MIT | Dashboard UI | No framework change after specification approval |
| `fastify` | `5.12.1` | Fastify project, MIT | API and static file host | Node HTTP requires more routing and validation code |
| `bullmq` | `6.2.0` | Taskforce.sh, MIT | Queue, retries, and job events | A custom Redis queue adds failure risk |
| `ioredis` | `6.0.0` | Redis project, MIT | Explicit BullMQ Redis client | BullMQ 6 does not bundle a Redis driver |
| `@fastify/static` | `10.1.3` | Fastify project, MIT | Serve the exported dashboard | A custom file server adds path and cache risk |
| `@fastify/cors` | `11.3.0` | Fastify project, MIT | Permit the local web development origin | Production stays same-origin |
| `postgres` | `3.4.9` | Rasmus Porsager, Unlicense | Small SQL client and transactions | An ORM hides the SQL this learning lab should teach |
| `zod` | `4.4.3` | Colin McDonnell, MIT | Shared runtime schemas | Hand validation duplicates contract logic |

Development dependencies:

| Package | Exact version | Owner and license | Purpose |
|---|---:|---|---|
| `typescript` | `7.0.2` | Microsoft, Apache-2.0 | Type checks and builds |
| `@playwright/test` | `1.62.1` | Microsoft, Apache-2.0 | Seven browser scenarios |
| `prettier` | `3.9.6` | Prettier project, MIT | Deterministic formatting |
| `@types/node` | `24.13.3` | DefinitelyTyped, MIT | Node 24 types |
| `@types/react` | `19.2.18` | DefinitelyTyped, MIT | React types |
| `@types/react-dom` | `19.2.4` | DefinitelyTyped, MIT | React DOM types |
| `@types/bun` | `1.4.0` | DefinitelyTyped, MIT | Bun test and runtime types |

The npm registry showed high monthly use for every selected package on 2026-08-24. The smallest count was over 8.7 million downloads. Each repository is active and owned by its established maintainer or organization. The added packages had 17.3 million to 99.9 million monthly downloads. Registry evidence: [npm download API](https://api.npmjs.org/downloads/point/last-month/fastify), [npm package registry](https://registry.npmjs.org/fastify/latest), [ioredis registry](https://registry.npmjs.org/ioredis/latest), [Fastify static registry](https://registry.npmjs.org/%40fastify%2Fstatic/latest), [Fastify CORS registry](https://registry.npmjs.org/%40fastify%2Fcors/latest).

No selected version was less than 72 hours old when this plan was written. Use the exact versions and commit `bun.lock`.

## File Map

```text
apps/
  api/src/{main,server}.ts
  api/src/http/{errors,lab-scope,raw-json}.ts
  api/src/routes/{dashboard,lab,messages,reviews,webhooks}.ts
  web/src/app/{layout,page,providers,events,needs-review,integration-lab,how-ingestion-works}/
  web/src/components/{app-shell,data-table,metric-card,organization-switcher,scenario-trace}.tsx
  web/src/lib/{api,format}.ts
  worker/src/{main,queue,runtime}.ts
  worker/src/jobs/{dispatch-outbox,expire-sessions,poll-venuewave,process-message}.ts
packages/
  contracts/src/{api,provider-envelope,scenario}.ts
  database/migrations/0001_core.sql
  database/src/{client,ingestion,lab,reads,scope}.ts
  database/scripts/{migrate,seed}.ts
  domain/src/{event-match,money,operations,reconciliation,version}.ts
  providers/src/{boxgrid,encoretix,venuewave}/
  providers/src/fixtures/
tests/e2e/lab-scenarios.spec.ts
```

## Shared Interfaces

```ts
type Scope = {
  organizationId: string;
  scopeId: string;
};

type ProviderEnvelope = {
  scopeId: string;
  organizationId: string;
  connectionId: string;
  provider: "encoretix" | "venuewave" | "boxgrid";
  deliveryId: string;
  externalEventId: string;
  kind: "sale_delta" | "refund_delta" | "inventory_delta" | "snapshot";
  sourceOccurredAt: string;
  receivedAt: string;
  sourceVersion: string;
  checksum: string;
  payload: unknown;
};

type NormalizedOperation =
  | {
      mode: "append";
      operationKey: string;
      kind: "sale" | "refund" | "fee" | "inventory";
      ticketDelta: number;
      amountDeltaCents: number;
      currency: "USD";
    }
  | {
      mode: "replace";
      sourceVersion: string;
      versionRank: bigint;
      facts: ProviderFacts;
    };

interface ProviderAdapter {
  parse(envelope: ProviderEnvelope): NormalizedOperation[];
  compareVersion(left: string, right: string): -1 | 0 | 1;
}

type TraceStep = {
  order: number;
  state: string;
  title: string;
  explanation: string;
  databaseEffect: string;
};
```

---

### Task 1: Create the monorepo and prove the shared boundaries

**Files:**
- Create: `package.json`, `bunfig.toml`, `tsconfig.base.json`, `.prettierrc.json`, `.env.example`, `compose.yaml`
- Modify: `.gitignore`
- Create: `.github/workflows/ci.yml`
- Create: each workspace `package.json` and `tsconfig.json`
- Create: `packages/contracts/src/provider-envelope.ts`, `packages/contracts/src/api.ts`, `packages/contracts/src/scenario.ts`, `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/provider-envelope.test.ts`

**Interfaces:**
- Produces: `ProviderEnvelopeSchema`, `ProviderEnvelope`, `ScenarioId`, `TraceStep`, and public API DTO schemas.

- [ ] **Step 1: Write the failing contract tests**

Test a valid envelope, invalid cents, invalid UTC timestamps, unknown providers, and all seven scenario IDs.

```ts
expect(() => ProviderEnvelopeSchema.parse({ ...validEnvelope, receivedAt: "not-utc" })).toThrow();
expect(ScenarioIdSchema.options).toHaveLength(7);
```

- [ ] **Step 2: Run the focused tests and confirm the missing-module failure**

Run: `bun test packages/contracts/src/provider-envelope.test.ts`

- [ ] **Step 3: Add the workspace manifests and minimal schemas**

Use exact dependency versions from the approval gate. Use Bun workspaces without Turborepo.

Construct one explicit `IORedis` client for BullMQ. Set `maxRetriesPerRequest: null`. Do not rely on BullMQ's native ESM driver loader.

- [ ] **Step 4: Start local PostgreSQL 18 and Redis 8.2**

Run: `docker compose up -d postgres redis`

Verify: `docker compose ps` shows both health checks as healthy.

- [ ] **Step 5: Run contract tests and type checks**

Run: `bun test packages/contracts && bun run typecheck`

- [ ] **Step 6: Add generated-file ignores and continuous integration**

Ignore `out/`, `playwright-report/`, and `test-results/`. Add CI jobs for formatting, type checks, Bun tests, PostgreSQL, and Redis.

- [ ] **Step 7: Commit the foundation**

```bash
git add package.json bun.lock bunfig.toml tsconfig.base.json .prettierrc.json .env.example compose.yaml .gitignore .github apps packages
git commit -m "build: scaffold the integration lab workspaces"
```

### Task 2: Create scoped durable storage

**Files:**
- Create: `packages/database/migrations/0001_core.sql`
- Create: `packages/database/src/client.ts`, `packages/database/src/scope.ts`, `packages/database/src/ingestion.ts`
- Create: `packages/database/scripts/migrate.ts`, `packages/database/scripts/seed.ts`
- Test: `packages/database/src/scope.integration.test.ts`, `packages/database/src/ingestion.integration.test.ts`

**Interfaces:**
- Produces: `withScope(scope, query)`, `acceptMessage(scope, envelope)`, `claimOutbox(limit)`, and `markOutboxDispatched(id)`.

- [ ] **Step 1: Write failing isolation and acceptance tests**

Prove two sessions can accept the same provider delivery ID. Prove one session cannot read the other's message.

```ts
expect(await acceptMessage(scopeA, envelope)).toEqual({ status: "accepted", messageId: expect.any(String) });
expect(await acceptMessage(scopeA, envelope)).toEqual({ status: "duplicate", messageId: expect.any(String) });
expect(await listMessages(scopeB)).toEqual([]);
```

- [ ] **Step 2: Run the database tests and confirm they fail before migration**

Run: `bun test packages/database/src/*.integration.test.ts`

- [ ] **Step 3: Add the schema and constraints**

Create `organizations`, `demo_sessions`, `data_scopes`, `provider_connections`, `shows`, `event_mappings`, `ingestion_messages`, `ingestion_outbox`, `normalized_effects`, `ticket_facts`, `snapshot_staging`, `reconciliation_runs`, `review_items`, `scenario_runs`, `trace_steps`, and `audit_entries`.

Store a public webhook key ID on each connection. Derive its secret with `HMAC-SHA256(PROVIDER_KEY_MASTER_SECRET, connectionId)`.

Add `version_rank bigint` to replacement messages and facts. Add `dispatch_attempts integer not null default 0` to the outbox.

Use these key constraints:

```sql
unique (scope_id, provider, delivery_id)
unique (message_id)
unique (scope_id, provider, operation_key)
unique (scope_id, show_id, provider, currency)
unique (scope_id, provider, external_event_id)
```

Add composite foreign keys that include `scope_id`. Add indexes for pending outbox rows, active sessions, provider cursors, recent audit entries, and pending reviews.

- [ ] **Step 4: Implement transaction helpers and seed two organizations**

Seed stable baseline scopes for “Northstar Presents” and “Harborlight Live.” Seed only fictional USD data.

- [ ] **Step 5: Run migrations twice and all database tests**

Run: `bun run db:migrate && bun run db:migrate && bun test packages/database`

Expected: the second migration run makes no changes, and all tests pass.

- [ ] **Step 6: Commit durable scoped storage**

```bash
git add packages/database
git commit -m "feat: add scoped ingestion storage"
```

### Task 3: Implement pure provider and reconciliation rules

**Files:**
- Create: `packages/domain/src/{money,operations,version,event-match,reconciliation}.ts`
- Create: `packages/providers/src/encoretix/{schema,adapter,signing}.ts`
- Create: `packages/providers/src/venuewave/{schema,adapter,simulator}.ts`
- Create: `packages/providers/src/boxgrid/{schema,adapter,simulator}.ts`
- Create: `packages/providers/src/fixtures/*.json`
- Test: matching `*.test.ts` files beside each module

**Interfaces:**
- Produces: `ProviderAdapter`, `verifyEncoreSignature`, `scoreEventMatch`, `diffProviderSnapshot`, and fictional provider clients.

- [ ] **Step 1: Write failing tests for money, versions, and event matching**

Cover integer cents, USD enforcement, provider-specific version comparison, ambiguous performances, and deterministic checksums.

- [ ] **Step 2: Write failing adapter tests**

EncoreTix must output immutable append operations. VenueWave must output immutable page effects. BoxGrid must output one absolute replacement operation only after a completion marker.

- [ ] **Step 3: Implement the smallest pure functions that pass the tests**

Do not give adapters database access. Do not use floating-point money.

- [ ] **Step 4: Add the provider-change reconciliation case**

```ts
expect(sumProviderFacts([
  { provider: "encoretix", sold: 400 },
  { provider: "boxgrid", sold: 600 },
])).toEqual({ sold: 1000 });
```

- [ ] **Step 5: Run all pure tests**

Run: `bun test packages/domain packages/providers`

- [ ] **Step 6: Commit the provider rules**

```bash
git add packages/domain packages/providers
git commit -m "feat: normalize fictional provider updates"
```

### Task 4: Implement the durable processing path

**Files:**
- Create: `apps/worker/src/queue.ts`, `apps/worker/src/runtime.ts`
- Create: `apps/worker/src/jobs/dispatch-outbox.ts`, `apps/worker/src/jobs/process-message.ts`
- Modify: `packages/database/src/ingestion.ts`
- Test: `apps/worker/src/jobs/process-message.integration.test.ts`, `apps/worker/src/jobs/dispatch-outbox.integration.test.ts`

**Interfaces:**
- Consumes: `acceptMessage`, `claimOutbox`, provider adapters, and database scope helpers.
- Produces: `startWorker()`, `stopWorker()`, `dispatchOutboxBatch()`, and `processMessage(messageId)`.

- [ ] **Step 1: Write the outbox recovery test**

Accept a message, simulate an enqueue failure, run the dispatcher again, and confirm one eventual financial effect.

- [ ] **Step 2: Write the concurrent redelivery test**

Run `processMessage` twice through `Promise.all`. Confirm one `normalized_effects` row and one fact change.

- [ ] **Step 3: Implement outbox dispatch with stable BullMQ job IDs**

Claim rows with `FOR UPDATE SKIP LOCKED`. Increment `dispatch_attempts` per claim. Use `messageId` as the BullMQ job ID.

Mark an outbox row dispatched only after `queue.add` succeeds. Pass an explicit `IORedis` client with `maxRetriesPerRequest: null` to BullMQ.

- [ ] **Step 4: Implement transactional message processing**

Lock or conditionally claim the message. Resolve its mapping. Insert each append effect once. Use `operationKey = deliveryId + lineIndex`.

Apply replacements with one conditional statement against `version_rank`. Zero changed rows means `ignored_old`. Write facts and audits in one transaction.

Add a concurrent snapshot test. Ranks 5 and 7 must always leave rank 7 in both arrival orders.

- [ ] **Step 5: Add graceful shutdown**

On `SIGTERM`, stop new claims, close the BullMQ worker, finish the current database transaction, and close connections.

- [ ] **Step 6: Run Redis-loss and concurrency tests**

Run: `bun test apps/worker packages/database`

- [ ] **Step 7: Commit the processing core**

```bash
git add apps/worker packages/database
git commit -m "feat: process ingestion messages idempotently"
```

### Task 5: Add webhooks, polling, snapshots, and review actions

**Files:**
- Create: `apps/api/src/http/{errors,lab-scope,raw-json}.ts`
- Create: `apps/api/src/routes/{webhooks,messages,reviews}.ts`
- Create: `apps/api/src/{server,main}.ts`
- Create: `apps/worker/src/jobs/poll-venuewave.ts`
- Modify: `apps/worker/src/jobs/process-message.ts`
- Test: route and job integration tests beside these files

**Interfaces:**
- Produces: the specified webhook, message replay, review approval, and review rejection routes.

- [ ] **Step 1: Write failing raw-webhook tests**

Test a valid signature, one changed byte, one stale timestamp, one duplicate, and one reused delivery ID with a changed checksum.

- [ ] **Step 2: Add the raw JSON parser and webhook route**

Limit the body before JSON parsing. Verify the HMAC against exact bytes with `timingSafeEqual`. Never log the secret or signature.

Select the provider connection by its public key. Derive `scope_id` and `organization_id` from that row. Reject mismatched envelope fields.

The scenario runner signs each delivery on the server. The browser never receives a webhook secret.

Test that a connection A signature with connection B scope returns 403 and writes nothing.

- [ ] **Step 3: Write and implement the cursor transaction tests**

Use `SELECT ... FOR UPDATE` on the provider connection. Save every page effect and the next cursor in one transaction. Preserve the old cursor after any failure.

- [ ] **Step 4: Write and implement snapshot staging tests**

An incomplete snapshot writes audit evidence but changes no facts. A complete snapshot validates all rows before one transactional provider-scoped replacement.

A reused delivery ID with a changed checksum becomes `needs_review`. Store both checksums as evidence and change no facts.

- [ ] **Step 5: Add scoped replay and review routes**

Resolve the lab token server-side. Query mutation targets by `(id, organization_id, scope_id)`. Return 404 for another scope.

- [ ] **Step 6: Run API and worker integration tests**

Run: `bun test apps/api apps/worker`

- [ ] **Step 7: Commit provider transports and reviews**

```bash
git add apps/api apps/worker
git commit -m "feat: add provider transports and review controls"
```

### Task 6: Build all seven lab scenarios and read APIs

**Files:**
- Create: `packages/database/src/{lab,reads}.ts`
- Create: `apps/api/src/routes/{dashboard,lab}.ts`
- Create: `apps/worker/src/jobs/expire-sessions.ts`
- Create: `packages/providers/src/fixtures/scenarios/*.json`
- Test: `apps/api/src/routes/lab.integration.test.ts`

**Interfaces:**
- Produces: overview, provider, show, message, review, scenario-run, reset, and trace DTOs.

- [ ] **Step 1: Write failing tests for lab token creation and isolation**

Store only the token HMAC. Prove reset, replay, approve, reject, and reads cannot cross scopes.

- [ ] **Step 2: Add deterministic scenario fixtures**

Create fixtures for duplicate webhook, late immutable effect, outage retry, rate limit, uncertain match, incomplete snapshot, and provider change.

- [ ] **Step 3: Implement scenario orchestration and trace storage**

Each trace must include input, processing state, normalized output, database effect, audit result, and plain-language explanation.

- [ ] **Step 4: Implement one-query summary reads and paginated detail reads**

Do not load raw payloads in list responses. Load evidence only from one scoped detail endpoint.

- [ ] **Step 5: Implement two-stage session expiry**

Mark the session expired first. Reject new runs. Delete its scope only after no active job references it.

Run expiry at process startup and on the outbox interval. Each wake catches every deadline that passed during sleep.

- [ ] **Step 6: Run all scenario API tests**

Run: `bun test apps/api packages/database packages/providers`

- [ ] **Step 7: Commit the complete lab API**

```bash
git add apps/api apps/worker packages/database packages/providers
git commit -m "feat: add isolated integration lab scenarios"
```

### Task 7: Build the Prism-style dashboard

**Files:**
- Create: `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`
- Create: all six page routes under `apps/web/src/app/`
- Create: components and helpers from the file map
- Create: `apps/web/next.config.ts`
- Test: component tests beside pure format and state helpers

**Interfaces:**
- Consumes: stable API DTOs only.
- Produces: a static Next.js export in `apps/web/out`.

- [ ] **Step 1: Build the shared shell and design tokens**

Use a white interface, thin borders, compact tabs, dense tables, narrow navigation, and restrained purple accents. Keep the unofficial label visible.

- [ ] **Step 2: Build Overview, Providers, and Events**

Show revenue, ticket count, sync delay, review count, health, mappings, facts, and source versions.

- [ ] **Step 3: Build Needs Review and Integration Lab**

Use native buttons and tables. Announce scenario progress through `aria-live="polite"`. Restore focus after approve, reject, replay, and reset.

- [ ] **Step 4: Build How Ingestion Works**

Explain the three edge strategies, transactional outbox, at-least-once queue, and provider-scoped total with the 400 + 600 example.

- [ ] **Step 5: Add responsive and reduced-motion behavior**

Do not use color as the only state signal. Keep text contrast at 4.5:1 or higher. Prevent page-level horizontal scrolling.

- [ ] **Step 6: Run formatting, type checks, tests, and the static build**

Run: `bun run format:check && bun run typecheck && bun test && bun run build`

- [ ] **Step 7: Commit the dashboard**

```bash
git add apps/web
git commit -m "feat: build the integration lab dashboard"
```

### Task 8: Package the zero-cost public service

**Files:**
- Modify: `apps/api/src/main.ts`
- Create: `render.yaml`, `scripts/start-public.ts`
- Create: `README.md`
- Test: `tests/e2e/lab-scenarios.spec.ts`, `playwright.config.ts`

**Interfaces:**
- Produces: one Render web process with `/health`, static web assets, API routes, outbox dispatch, and one BullMQ worker.

- [ ] **Step 1: Write the seven Playwright scenario tests**

For each scenario, assert the visible trace, final normalized result, database effect, audit entry, and isolation from a second browser context.

- [ ] **Step 2: Create the combined public entry point**

Start Fastify through Bun. Register `@fastify/static` for `apps/web/out`. Start one worker and run outbox and expiry sweeps at startup and every 15 seconds.

Use a 30-second BullMQ idle delay to reduce Upstash commands. Trigger every lab scenario on demand instead of a wall-clock schedule.

For local development only, register `@fastify/cors` with the exact Next.js development origin. Production stays same-origin.

- [ ] **Step 3: Add health and readiness checks**

`/health` proves the process is alive. `/ready` checks PostgreSQL and Redis with short timeouts.

- [ ] **Step 4: Add the free Render Blueprint**

Create one `free` Node web service. Set `BUN_VERSION=1.3.11`.

Build with `bun install --frozen-lockfile && bun run build`. Start with `bun run scripts/start-public.ts`.

Read `DATABASE_URL`, `REDIS_URL`, `LAB_TOKEN_PEPPER`, and `PROVIDER_KEY_MASTER_SECRET` from unsynced environment variables.

Create Fastify with `trustProxy: true`. Rate-limit with the left-most forwarded address and lab token. Render provides 750 shared free instance hours monthly.

- [ ] **Step 5: Extend CI and add README guidance**

Extend the Task 1 workflow with Playwright and the production build. The README leads with the live demo and five-minute walkthrough.

- [ ] **Step 6: Run the complete local verification**

Run:

```bash
docker compose up -d postgres redis
bun run db:migrate
bun run db:seed
bun run verify
```

Expected: every test passes, the build succeeds, and all seven browser scenarios pass.

- [ ] **Step 7: Verify the public deployment after user-approved provisioning**

Check the first cold load, all seven scenarios, two-browser isolation, queue recovery after a process restart, and secrets absence from browser assets.

- [ ] **Step 8: Commit release packaging**

```bash
git add render.yaml scripts README.md .github tests playwright.config.ts apps/api/src/main.ts
git commit -m "chore: prepare the public portfolio demo"
```

## PR Packaging

Build the whole feature in one implementation session. Package it as this stack for review:

<!-- fig:three-pr-sequence -->

1. Foundation and durable ingestion core: Tasks 1 through 4.
2. Provider transports and lab scenarios: Tasks 5 and 6.
3. Dashboard and free public deployment: Tasks 7 and 8.

Each later branch depends on the previous branch. Do not merge any pull request without explicit approval after final review and required checks.

## Verification Matrix

| Invariant | Primary proof |
|---|---|
| One delivery cannot change financial state twice | duplicate and concurrent-redelivery integration tests |
| An old replacement cannot replace a new one | BoxGrid version-gate test |
| A late immutable effect still applies once | EncoreTix late-effect test |
| An uncertain mapping cannot change facts | ambiguous-performance scenario |
| An incomplete snapshot cannot change facts | BoxGrid staging test |
| One scope cannot read or mutate another | database, API, and two-browser tests |
| Current facts remain explainable | trace-to-message-to-effect-to-audit assertions |
| A lost Redis publish cannot strand work | outbox recovery test |
| Provider totals remain scoped | 400 EncoreTix + 600 BoxGrid equals 1,000 |

## Risks Accepted for the Free Demo

- Render cold starts can delay the first page. Warm the demo before an interview.
- The public API and worker share one process. A process failure pauses both until Render restarts it.
- All polling, expiry, and queue work pauses during sleep. Startup catch-up resumes durable work after the next request.
- Neon and Upstash free quotas can stop the demo after unusual traffic. The API limits scenario runs per lab token and hashed IP window.
- Upstash has no free uptime SLA. PostgreSQL outbox recovery prevents accepted messages from existing only in Redis.
- This deployment proves behavior at demo scale. It does not claim production availability or capacity.

## Plan Self-Review

- Every specification page and scenario maps to Tasks 5 through 8.
- Every safety invariant maps to a database constraint and a test.
- The plan contains no deferred product scope.
- The provider-change example keeps provider totals separate.
- The public topology stays free and names its reliability cost.
- Exact dependencies require approval before installation.
