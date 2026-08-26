# Prism Integration Lab Teaching Flow Rework

Status: Approved for implementation  
Date: 2026-08-25

## Goal

This presentation-only rework makes `/integration-lab` the main place to learn the fictional ticket-provider integration. The page first explains one concert scenario. It then teaches the technical problems, choices, costs, and failure prevention behind the existing safe lab actions.

This change adds no provider behavior or system architecture. It does not change ingestion, the API, database, visitor isolation, security controls, or the seven backend scenarios.

<!-- fig:teaching-journey -->

## Scope

**In scope:** Internal lesson tabs, explanatory diagrams, approach comparisons, recommendation costs, technical-debt paths, query-state-preserving navigation, existing trace access, and focused presentation tests.

**Out of scope:** New providers, real provider APIs, new lab scenarios, changed financial rules, changed queue behavior, new dependencies, and a new deployment topology.

## Verified facts, inferences, and guesses

**Verified facts:** The current lab has seven browser scenarios. The providers and payload fields are fictional. The current organization and run values use the page query string.

**Inference:** The approved mock gives the visitor a clearer learning order than a single scenario list. The rework therefore uses lessons before actions.

**Guesses:** None. The page must label fictional examples as fictional and must not claim a real provider contract.

## Teaching journey

The Overview tab explains a fictional Northstar Presents concert. It shows three fictional sales sources, one Prism view, and the safe lab controls. It tells the visitor to read each later tab as a problem, its choices, the selected path, its cost, and the failure that the path prevents.

<!-- fig:lesson-anatomy -->

## Lesson contract

The tab order is fixed: Overview, API Mapping, Webhooks, Polling & Snapshots, Ordering & Conflicts, Money & Refunds, and Reconciliation & Recovery.

Every non-Overview tab includes these visible parts, in this order:

1. Provider differences and the architecture challenge.
2. One diagram that teaches before any scenario action.
3. Two or three approach cards.
4. For every card: when it fits, exactly two pros, and exactly two cons.
5. Exactly one green recommended card. Its `Recommended` label sits above the card.
6. The recommended approach cost, a visible amber technical-debt path, and the failure prevented.
7. The relevant existing scenario action, if one exists, plus its current raw trace and review details.

The technical-debt path names the later work that the selected choice creates. It is not a defect claim. It makes the trade clear, for example: a common model reduces application branching now, but later needs mapping-version migration support.

## Lesson content

### Overview

The Overview tab uses the fictional concert to explain the reading order. EncoreTix can send a sale webhook, VenueWave can require a poll, and BoxGrid can provide a provider-scoped snapshot. The page shows that the existing lab proves safe processing; the following tabs explain why those controls exist.

### API Mapping

The challenge is to make three fictional shapes usable without treating them as the same provider contract. The lesson explains a canonical model, provider adapters, stable provider and external IDs, enum maps that retain unknown values, integer cents, UTC with source-zone retention, optional fields, capability records, mapping versions, and immutable raw-payload retention.

| Approach | When it fits | Pros | Cons |
|---|---|---|---|
| Use provider fields in product code | One short-lived provider proof | Direct field access; little initial adapter code | Provider branches spread; a provider change touches product logic |
| **Recommended: canonical model plus provider adapters** | Multiple provider contracts with shared ticket facts | Product code has one stable shape; adapters contain provider variation | The model needs careful governance; mapping versions need migration support |
| Use a user-configured mapping engine | Many similar customer-configured feeds | Some mappings avoid code releases; operators can inspect field rules | Validation becomes a product surface; complex fields still need code adapters |

The recommended cost is a durable mapping registry. Its debt path is capability and mapping-version migration work. It prevents a provider-specific field or unknown enum from silently changing Prism financial facts.

### Webhooks

The challenge is that a provider can repeat, delay, or forge a delivery. The lesson compares direct request writes, acknowledged durable intake with queued processing, and a managed webhook relay.

| Approach | When it fits | Pros | Cons |
|---|---|---|---|
| Write facts during the webhook request | Low-value non-financial notifications | Few moving parts; immediate visible result | Provider latency affects writes; retry evidence is weak |
| **Recommended: verify, save raw input, acknowledge, then queue** | Financial changes that need retry and audit | The provider gets a prompt response; workers can retry safely | Eventual consistency appears; queue health needs monitoring |
| Use a relay before the application | Many sources share one delivery edge | One edge can manage retries; provider endpoints stay simpler | A new operational dependency appears; relay semantics can hide provider details |

The recommended cost is queue operations and delay visibility. Its debt path is retained-message and retry monitoring. It prevents duplicate delivery, replay, and an outage from corrupting or losing a fact.

### Polling & Snapshots

The challenge is to recover complete provider state when no trustworthy push update exists. The lesson compares cursor polling, full snapshots, and only manual import.

| Approach | When it fits | Pros | Cons |
|---|---|---|---|
| Cursor polling only | Ordered incremental APIs with stable cursors | Small responses; Prism controls retry time | Cursor commits can skip data; rate limits add delay |
| **Recommended: durable cursor polling plus scoped snapshot reconciliation** | APIs with both changes and periodic state views | Incremental work stays cheap; snapshots find missed changes | Two paths need shared rules; snapshot scope needs explicit checks |
| Manual file import only | Rare, low-volume correction work | Simple provider integration; an operator controls timing | Data becomes stale; routine recovery depends on people |

The recommended cost is cursor and snapshot reconciliation logic. Its debt path is scheduled backfill and rate-limit capacity work. It prevents an early cursor commit or a partial snapshot from silently losing provider state.

### Ordering & Conflicts

The challenge is that arrival time can differ from provider order, and one delivery ID can carry different content. The lesson compares last-arrival-wins, provider versions with checksums, and a global ordering service.

| Approach | When it fits | Pros | Cons |
|---|---|---|---|
| Last arrival wins | Non-financial display hints | Simple comparison; no source metadata rule | Late updates overwrite newer state; retries can change totals |
| **Recommended: provider version ranking plus checksum conflict review** | Providers that expose versions or timestamps | Late state stays visible in audit; reused IDs can enter review | Provider ranks need definition; uncertain conflicts need operators |
| Global cross-provider ordering | One provider owns all change order | One central sequence; consumers compare one field | Different providers lack a shared clock; central sequencing is a new service |

The recommended cost is version rules and review work. Its debt path is provider-specific rank migration. It prevents an older sale or changed duplicate from silently replacing a newer refund.

### Money & Refunds

The challenge is that providers describe sale, refund, tax, and fee data with different names and completeness. The lesson compares provider totals, canonical integer-cent facts, and floating-point display calculations.

| Approach | When it fits | Pros | Cons |
|---|---|---|---|
| Keep provider totals only | Read-only provider reporting | Minimal transformation; source wording stays visible | Cross-provider totals cannot compare; missing fee rules stay hidden |
| **Recommended: normalized integer-cent components with raw evidence** | Shared revenue, refund, tax, and fee reporting | Arithmetic stays exact; raw input supports audit | A component taxonomy needs maintenance; unusual fees need review |
| Calculate with floating-point values in the browser | Disposable visual prototypes | Fast display work; no database conversion | Rounding differs by runtime; financial history cannot be trusted |

The recommended cost is a financial component taxonomy. Its debt path is policy changes for new fees and currency support. It prevents rounding drift or a partial refund from producing an unexplained total.

### Reconciliation & Recovery

The challenge is to correct missed or conflicting state without replacing facts outside a provider scope. The lesson compares automatic overwrite, review-gated reconciliation, and full event sourcing.

| Approach | When it fits | Pros | Cons |
|---|---|---|---|
| Automatically replace stored totals | One complete, authoritative provider scope | Fast correction; little operator work | Scope errors erase valid facts; the correction rationale is weak |
| **Recommended: compare evidence, create review, then replay safely** | Multiple provider scopes or uncertain differences | A human sees the evidence; replay keeps an audit trail | Correction takes longer; review queues need ownership |
| Rebuild all facts from an event stream | High-volume systems with many consumers | Full historical replay; independent downstream consumers | Operating cost rises; the demo does not need the complexity |

The recommended cost is a review workflow and replay controls. Its debt path is review ownership, expiry, and bulk-resolution work. It prevents a BoxGrid snapshot from replacing valid EncoreTix sales.

## Interaction and accessibility

Internal tabs preserve `organization` and `run` query values. Browser back and forward must restore the selected lesson without resetting the existing lab run.

The tab list uses keyboard arrow navigation, visible focus, correct selected-tab semantics, and semantic headings. Dynamic scenario results announce updates. At 390px, panels stack vertically and the page has no horizontal overflow.

The visual system is fixed light mode. Prism purple (`#6d28d9` or an equivalent) is the dominant accent. Active surfaces use pale lavender. Headings use deep plum. Content surfaces are white. The type stack starts with Avenir or an installed Avenir-compatible humanist sans. The page uses no gradients, glow, or colored side rails. Green is only for recommendation or success. Amber is only for debt or caution. Red is only for failures.

## Implementation boundaries

The implementation changes only the `/integration-lab` presentation layer and its presentation data. Existing provider, event, review, scenario, raw trace, query, and session interfaces remain available.

The seven scenarios remain unchanged: duplicate webhook, late update, provider outage, rate limit, uncertain event match, incomplete snapshot, and provider change. Each action stays in the lesson where it helps explain the problem.

No new package, API route, database record, worker behavior, authorization rule, or provider behavior is allowed for this rework.

## Acceptance criteria

- `/integration-lab` shows the seven fixed lesson tabs and keeps its current `organization` and `run` values.
- Overview explains the fictional concert and the lesson reading order.
- Every non-Overview lesson has a diagram before its action and two or three approaches.
- Every approach visibly has one fit statement, exactly two pros, and exactly two cons.
- Every non-Overview lesson has exactly one recommended approach, its label above the green panel, one stated cost, one debt path, and one prevented failure.
- API Mapping includes every canonical-model and data-retention topic named in this specification.
- Fictional provider names and fields remain clearly marked fictional.
- Existing safe actions, raw trace, provider, event, and review details still work.
- Focused unit tests cover lesson/query navigation and lesson data definitions.
- Component or render tests enforce approach count, recommendation count, exact pro/con count, debt path, and failure-prevention text.
- The current seven browser scenarios stay green.
- Desktop and 390px browser checks find no console error or page-level horizontal overflow.

## Risks

- A too-large lesson payload can recreate the original dense screen. The implementation must show one clear diagram and use progressive detail for the comparisons.
- A generic canonical model can hide provider differences. The API Mapping lesson must keep raw evidence, capabilities, and unknown values visible.
- Reordered UI can make existing controls difficult to find. Each relevant lesson must keep its existing action and trace in place.

## Locked decisions

- This is a presentation-only change. Existing system behavior remains unchanged.
- `/integration-lab` is the primary educational workspace.
- The seven lesson tabs use the fixed order in this specification.
- Every non-Overview lesson uses one diagram, two or three approach cards, and exactly one recommendation.
- Recommended labels sit above their green panels.
- Approach cards show exactly two pros and exactly two cons.
- The approved mock's Prism-purple light visual direction is the implementation direction.
- No new dependency is added.

## Open questions

- None. The mock is approved.
