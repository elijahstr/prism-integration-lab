# Prism Integration Lab Design

Status: Approved for implementation planning  
Date: 2026-08-24

## Goal

Build a public portfolio demo that shows how Prism could safely import ticket sales, inventory, refunds, and fee data from ticketing providers with different API capabilities. The demo must look polished, teach the system design concepts, and support a short interview walkthrough.

This is an unofficial portfolio prototype. It is not an official Prism.fm product. All providers, organizations, shows, people, and financial data are fictional.

<!-- fig:ingestion-architecture -->

## Scope

**In scope:** A public dashboard, three fictional provider simulators, webhook ingestion, polling ingestion, snapshot ingestion, a durable processing queue, event mapping, duplicate and order checks, reconciliation, audit history, tenant isolation, controlled failure scenarios, automated tests, local Docker setup, and public deployment.

**Out of scope:** Real ticketing provider access, real customer data, ticket sales, seat reservations, payment processing, production authentication, a general integration platform, and full Prism booking or settlement features.

## Locked decisions

- Use a TypeScript monorepo with focused web, API, and worker applications.
- Use Next.js for the web interface and Fastify for the API.
- Use PostgreSQL for durable records and Redis with BullMQ for jobs and retries.
- Use three fictional providers: EncoreTix, VenueWave, and BoxGrid.
- Use a different transport for each provider because their capabilities differ.
- Save each accepted provider message before asynchronous processing starts.
- Keep every original provider payload immutable for audit and replay.
- Use at-least-once delivery with idempotent processing instead of an exactly-once claim.
- Store all money as integer cents and all system time as UTC.
- Put uncertain event matches and financial differences into a review queue.
- Use a fake organization switcher with no login friction.
- Keep each public lab run isolated from other visitors.
- Match the supplied Prism interface references without copying private assets or real customer data.
- Show a clear “unofficial portfolio prototype” label.
- Keep the GitHub repository public with no AI attribution or AI co-author lines.
- Use one free Render web service with Neon Free PostgreSQL and Upstash Free Redis for the public demo.
- Combine the public web, API, and worker process only for free hosting. Keep their source modules separate.

## User experience

The first page must look like a production ticket-integration dashboard. It must use a compact white interface, a narrow left navigation rail, thin tabs, small report cards, dense tables, and purple accents based on the supplied Prism screenshots.

The main pages are:

1. **Overview:** Ticket revenue, ticket count, sync delay, review count, provider health, and recent activity.
2. **Providers:** Connection state, transport type, rate-limit state, last successful update, and recent errors.
3. **Events:** Prism shows, provider event mappings, current ticket facts, and source versions.
4. **Needs Review:** Uncertain event matches and reconciliation differences with source evidence.
5. **Integration Lab:** Controlled scenarios with a visible step-by-step processing trace.
6. **How Ingestion Works:** The three provider strategies, their advantages and risks, and why the shared pipeline was selected.

The fake organization switcher contains at least two organizations. Switching organizations changes every dashboard query. The public demo uses only seeded data and does not pretend that the switcher is real authentication.

Each visitor gets an isolated lab session. A scenario changes only that session's records. Baseline demo data stays stable for other visitors. Lab sessions expire automatically.

## System structure

The repository contains these main units:

```text
apps/web       Next.js dashboard and Integration Lab
apps/api       Fastify API, webhook endpoint, reads, reviews, and lab controls
apps/worker    BullMQ workers, poll schedules, adapters, and reconciliation
packages/contracts   Shared schemas, provider envelopes, and normalized types
packages/database    Schema, migrations, queries, and seed data
packages/providers   Fictional provider clients, simulators, and fixtures
```

The applications share TypeScript contracts. They do not import each other's internal modules. PostgreSQL is the durable source of truth. Redis holds queued work and short-lived coordination state, but no financial fact exists only in Redis.

## Ingestion architecture alternatives

| Option | Advantages | Risks | Decision |
|---|---|---|---|
| Write provider data directly during each request | Very small and fast to build | Provider failures affect API requests; weak replay; hard audit; mixed provider logic | Rejected |
| Save raw messages, queue work, then normalize with provider adapters | Durable input; safe retries; clear audit; provider failures stay isolated | Eventual consistency; queue operations and monitoring are required | Selected |
| Store every change in an event stream and build all state from consumers | Strong replay and many downstream consumers | High operating cost; harder local work; unnecessary for the demo volume | Deferred |

The selected design keeps one shared processing pipeline. It changes only the provider transport and adapter at the system edge.

<!-- fig:provider-strategies -->

## Provider strategies

### EncoreTix: signed webhooks with reconciliation

EncoreTix sends a signed update for each sale, refund, fee change, and inventory change. It can send duplicates and late messages.

The API verifies an HMAC signature and a recent source timestamp. It stores the raw message with a unique delivery key, returns success after the durable write, and then queues the processing job. A scheduled snapshot check finds messages that were never delivered.

Advantages: low delay and low polling cost.  
Risks: duplicates, replay attacks, late messages, and missed delivery during an outage.

### VenueWave: incremental polling

VenueWave has no webhook. A scheduled worker requests updates with a cursor. The API is paginated and rate limited.

The worker saves each page before it advances the cursor. A failed page keeps the old cursor and can run again. Rate-limit responses cause exponential backoff with random delay. A large backfill uses a separate low-priority queue so it cannot block current sales updates.

Advantages: Prism controls retry timing and can recover after downtime.  
Risks: slower updates, rate limits, pagination mistakes, and skipped records if cursor state moves too early.

### BoxGrid: complete snapshots

BoxGrid sends a complete provider-scoped snapshot for one external event. A snapshot can correct an older total.

The worker validates the complete snapshot in staging. It compares the new snapshot with the last accepted BoxGrid snapshot and writes the difference in one database transaction. It never assumes that a BoxGrid snapshot includes tickets sold by another provider.

Advantages: simple provider contract, old corrections, and strong settlement checks.  
Risks: larger payloads, partial snapshots, and incorrect scope assumptions.

## Common provider envelope

Each transport creates one common envelope before it enters the queue:

```ts
type ProviderEnvelope = {
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
```

The envelope preserves source time and receive time because messages can arrive late. `deliveryId` protects against repeat delivery. `sourceVersion` protects against older state replacing newer state. `checksum` helps detect a provider that reuses a delivery ID with different content.

Each provider adapter validates its payload and returns a normalized ticket update. An adapter cannot write financial tables directly.

## Data model

<!-- fig:data-model -->

| Table | Purpose | Important constraints |
|---|---|---|
| `organizations` | Fictional demo tenants | Stable ID and unique slug |
| `demo_sessions` | Isolated public lab runs | Signed session ID and expiry |
| `provider_connections` | Provider state and polling cursor | Unique organization and provider |
| `shows` | Prism event records | Organization required |
| `event_mappings` | External event to Prism show mapping | Unique organization, provider, and external event ID |
| `ingestion_messages` | Immutable provider envelopes and raw payloads | Unique organization, provider, and delivery ID |
| `ticket_facts` | Current provider-scoped sales, refunds, inventory, fees, and taxes | Unique show and provider; source version check |
| `reconciliation_runs` | Snapshot comparison and differences | Source scope and evidence required |
| `review_items` | Uncertain mappings and financial differences | Pending, approved, or rejected state |
| `audit_entries` | Every accepted, ignored, corrected, reviewed, and replayed change | Append-only |

Every main table includes `organization_id`. Every lab-owned table also includes `demo_session_id`. Database constraints and query helpers require both values where applicable.

## Event mapping

An external ticket event must map to one Prism show before financial data is applied. The stable mapping key is organization, provider, and external event ID.

The demo can suggest a match from venue, artist, and start time. It never applies a suggestion below the configured confidence threshold. An uncertain match creates a review item. A user can select the correct show and replay the blocked message.

The lab includes a case with two similar performances to show why name-only matching is unsafe.

## Processing states and failure handling

<!-- fig:processing-states -->

An ingestion message starts as `received`, then moves to `queued`, `processing`, and `applied`.

Valid terminal or waiting states are:

- `duplicate`: The delivery was already accepted. Do not apply it again.
- `ignored_old`: A newer source version is already stored. Keep an audit entry.
- `needs_review`: The event mapping, snapshot scope, or financial difference is uncertain.
- `retrying`: A temporary database, queue, or provider error occurred.
- `failed`: The retry limit ended. A user can inspect and replay the message.

The API rejects an invalid webhook signature. A valid duplicate returns success so EncoreTix stops retrying it. The worker retries temporary failures with exponential backoff and random delay. Permanent schema errors go directly to failed review.

Polling cursors advance only after a complete page is durable. Snapshot totals change only after complete validation. A reconciliation difference creates a review item and does not automatically replace stored financial totals.

## Reconciliation example

A venue changes ticket providers while a show is on sale. EncoreTix sold 400 tickets before the change. BoxGrid later sold 600 tickets and reports a complete BoxGrid snapshot of 600.

The correct Prism total is 1,000 because the BoxGrid snapshot is provider scoped. Replacing the complete show total with 600 would lose the EncoreTix sales. The reconciliation record must show both provider scopes and require review if the scope is unclear.

## API boundaries

The initial API surface is:

```text
POST /webhooks/encoretix
GET  /api/overview
GET  /api/providers
GET  /api/shows
GET  /api/messages
GET  /api/reviews
POST /api/reviews/:id/approve
POST /api/reviews/:id/reject
POST /api/messages/:id/replay
POST /api/lab/scenarios/:scenario/run
GET  /api/lab/runs/:id
POST /api/lab/runs/:id/reset
```

The public API accepts only seeded organization slugs. The server maps each slug to a known organization. It does not trust an arbitrary organization ID from the browser.

Webhook routes do not use the fake organization switcher. A connection-specific webhook key identifies the organization, and the signature binds the request body and timestamp.

## Integration Lab scenarios

The first version includes:

1. **Duplicate webhook:** EncoreTix sends the same delivery twice. The second delivery is acknowledged and ignored.
2. **Late update:** An old sale update arrives after a newer refund update. The old source version is ignored.
3. **Provider outage:** VenueWave returns temporary failures, then recovers. The worker shows backoff and retry.
4. **Rate limit:** VenueWave returns a rate-limit response. The poller waits and preserves its cursor.
5. **Uncertain event match:** Two Prism shows look similar. Financial data waits for review.
6. **Incomplete snapshot:** BoxGrid omits its completion marker. Current totals do not change.
7. **Provider change:** EncoreTix and BoxGrid each own part of the show total. Reconciliation keeps both scopes.

Each run shows the original input, processing steps, state changes, normalized output, database effects, audit record, and final explanation.

## Security and privacy

- Use only fictional and seeded data.
- Mark fake login and organization controls as demo controls.
- Verify webhook signatures with constant-time comparison.
- Reject webhook timestamps outside the replay window.
- Keep secrets out of logs, fixtures, browser bundles, and Git history.
- Limit public scenario creation by IP and demo session.
- Validate all external payloads before normalization.
- Store tenant keys on mappings, messages, facts, reviews, and audit entries.
- Do not allow the public demo to create arbitrary outbound network requests.
- Expire and delete lab session data on a schedule.

## Observability

The dashboard and logs expose:

- Last successful update by provider
- Current sync delay
- Queue depth and oldest job age
- Duplicate, retry, failure, and review counts
- Poll cursor age
- Reconciliation difference count and value
- Processing time by provider and message kind
- Correlation IDs from provider delivery through audit entry

No metric can combine organizations unless it is an explicit aggregate over fictional demo data.

## Testing strategy

Unit tests cover provider schemas, adapters, signature verification, source-version comparison, snapshot differences, money calculations, and event-match scoring.

Integration tests use real PostgreSQL and Redis containers. They cover unique constraints, transactions, cursor commits, queue retries, replay, tenant isolation, and atomic snapshot application.

End-to-end tests run each Integration Lab scenario through the public UI and confirm both the visible explanation and the stored result.

The highest-value invariants are:

- One delivery cannot change financial state twice.
- An old source version cannot replace a new source version.
- An uncertain mapping cannot change financial state.
- An incomplete snapshot cannot change financial state.
- One organization or demo session cannot read another one's records.
- Current financial state can be explained from source messages and audit entries.

## Delivery and repository

Local development uses Docker Compose for PostgreSQL and Redis. One command starts the web, API, worker, database, and queue dependencies. Seed scripts produce a stable presentation dataset.

Continuous integration runs formatting, type checks, unit tests, integration tests, and the production build. The public demo runs one Render web process that serves the static web build, Fastify API, and BullMQ worker. It uses Neon PostgreSQL and Upstash Redis-compatible storage.

This free topology pauses background work when Render sleeps. PostgreSQL outbox recovery and startup catch-up resume durable work after the next request.

The repository is public. The README starts with the live demo, a short system summary, the ingestion architecture, a five-minute walkthrough, local setup, test commands, and the limits of the prototype. Repository text and commits do not include AI attribution or AI co-author lines.

## Success criteria

- A visitor can open the deployed demo without an account.
- The first screen looks like a credible Prism integration surface.
- A visitor can run all seven scenarios without affecting another visitor.
- Each scenario explains the design rule that protected the data.
- All three ingestion strategies feed one shared processing pipeline.
- Tests prove the six stated invariants.
- The repository contains no real provider credentials or customer data.
- A five-minute walkthrough explains the problem, alternatives, selected design, one failure, and one reconciliation case.

## Open questions

- Select the final public domain after the first deployment is available.
