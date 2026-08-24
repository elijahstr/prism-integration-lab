"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  MessageDto,
  OverviewDto,
  ProviderDto,
  ReviewDto,
  ScenarioId,
  ScenarioRunDto,
  ShowDto,
} from "@prism/contracts";
import {
  MessageDtoSchema,
  OverviewDtoSchema,
  ProviderDtoSchema,
  ReviewDtoSchema,
  ScenarioRunDtoSchema,
  ShowDtoSchema,
} from "@prism/contracts";

import {
  formatCurrency,
  formatSyncDelay,
  formatTimestamp,
  sumProviderTicketFacts,
} from "../lib/format";

type PageName =
  "events" | "ingestion" | "lab" | "overview" | "providers" | "reviews";

type DashboardData = {
  messages: MessageDto[];
  overview: OverviewDto;
  providers: ProviderDto[];
  reviews: ReviewDto[];
  shows: ShowDto[];
};

type LabSession = { expiresAt: string; token: string };

const organizations = [
  { label: "Northstar Presents", slug: "northstar-presents" },
  { label: "Harborlight Live", slug: "harborlight-live" },
] as const;

const navigation: Array<{ href: string; id: PageName; label: string }> = [
  { href: "/", id: "overview", label: "Overview" },
  { href: "/providers", id: "providers", label: "Providers" },
  { href: "/events", id: "events", label: "Events" },
  { href: "/needs-review", id: "reviews", label: "Needs Review" },
  { href: "/integration-lab", id: "lab", label: "Integration Lab" },
  { href: "/how-ingestion-works", id: "ingestion", label: "How it works" },
];

const scenarios: Array<{
  description: string;
  id: ScenarioId;
  title: string;
}> = [
  {
    description:
      "A second webhook delivery is acknowledged but does not duplicate sales.",
    id: "duplicate_webhook",
    title: "Duplicate webhook",
  },
  {
    description:
      "An older sale update follows a newer refund and stays ignored.",
    id: "late_update",
    title: "Late update",
  },
  {
    description: "VenueWave fails, records backoff, then resumes its poll.",
    id: "provider_outage",
    title: "Provider outage",
  },
  {
    description: "A rate limit preserves the cursor before a scheduled retry.",
    id: "rate_limit",
    title: "Rate limit",
  },
  {
    description:
      "Two similar shows require a person to select the safe mapping.",
    id: "uncertain_event_match",
    title: "Uncertain event match",
  },
  {
    description:
      "An incomplete BoxGrid snapshot cannot alter the stored facts.",
    id: "incomplete_snapshot",
    title: "Incomplete snapshot",
  },
  {
    description:
      "Provider-scoped facts keep 400 EncoreTix and 600 BoxGrid tickets.",
    id: "provider_change",
    title: "Provider change",
  },
];

async function createLabSession(organizationSlug: string): Promise<LabSession> {
  const response = await fetch("/api/lab/sessions", {
    body: JSON.stringify({ organizationSlug }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("The demo session could not start.");
  }

  return (await response.json()) as LabSession;
}

async function dashboardRequest<T>(
  token: string,
  path: string,
  schema: { parse(value: unknown): T },
): Promise<T> {
  const response = await fetch(path, {
    headers: { authorization: `Lab ${token}` },
  });

  if (!response.ok) {
    throw new Error("The dashboard data could not load.");
  }

  return schema.parse(await response.json());
}

async function loadDashboard(token: string): Promise<DashboardData> {
  const [overview, providers, shows, messages, reviews] = await Promise.all([
    dashboardRequest(token, "/api/overview", OverviewDtoSchema),
    dashboardRequest(token, "/api/providers", ProviderDtoSchema.array()),
    dashboardRequest(token, "/api/shows", ShowDtoSchema.array()),
    dashboardRequest(token, "/api/messages", MessageDtoSchema.array()),
    dashboardRequest(token, "/api/reviews", ReviewDtoSchema.array()),
  ]);

  return { messages, overview, providers, reviews, shows };
}

function providerName(provider: string): string {
  if (provider === "encoretix") return "EncoreTix";
  if (provider === "venuewave") return "VenueWave";
  return "BoxGrid";
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

function ReportCard({
  label,
  note,
  value,
}: {
  label: string;
  note: string;
  value: string;
}) {
  return (
    <section className="report-card" aria-label={label}>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{note}</small>
    </section>
  );
}

function LoadingPanel({ error }: { error: string | null }) {
  return (
    <section className="panel state-panel" aria-live="polite">
      <h2>
        {error ? "The dashboard is unavailable" : "Loading the demo scope"}
      </h2>
      <p>
        {error ??
          "The browser creates an isolated demo session, then reads its dashboard data."}
      </p>
    </section>
  );
}

function Overview({ data }: { data: DashboardData }) {
  return (
    <>
      <div className="report-grid">
        <ReportCard
          label="Ticket revenue"
          note="Gross sales less refunds"
          value={formatCurrency(data.overview.revenueCents)}
        />
        <ReportCard
          label="Tickets"
          note="Sold less refunded"
          value={data.overview.ticketCount.toLocaleString("en-US")}
        />
        <ReportCard
          label="Sync delay"
          note="Latest applied fact"
          value={formatSyncDelay(data.overview.syncDelaySeconds)}
        />
        <ReportCard
          label="Needs review"
          note="Pending human decisions"
          value={data.overview.reviewCount.toLocaleString("en-US")}
        />
      </div>
      <div className="split-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Connection health</p>
              <h2>Provider checks</h2>
            </div>
            <a href="/providers">View providers</a>
          </div>
          <table>
            <caption>Provider health for this demo session</caption>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Status</th>
                <th>Transport</th>
              </tr>
            </thead>
            <tbody>
              {data.providers.map((provider) => (
                <tr key={provider.id}>
                  <td>{providerName(provider.provider)}</td>
                  <td>
                    <span className={`status status-${provider.status}`}>
                      {statusLabel(provider.status)}
                    </span>
                  </td>
                  <td>{provider.transport}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Immutable input</p>
              <h2>Recent activity</h2>
            </div>
            <a href="/integration-lab">Open lab</a>
          </div>
          <table>
            <caption>Latest received provider messages</caption>
            <thead>
              <tr>
                <th>Provider</th>
                <th>State</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {data.messages.slice(-5).map((message) => (
                <tr key={message.id}>
                  <td>{providerName(message.provider)}</td>
                  <td>
                    <span className="status">{statusLabel(message.state)}</span>
                  </td>
                  <td>{formatTimestamp(message.receivedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}

function Providers({ data }: { data: DashboardData }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Provider edge</p>
          <h2>Connections and safeguards</h2>
        </div>
        <span className="muted">Session-scoped data</span>
      </div>
      <table>
        <caption>Configured provider transports and their latest state</caption>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Connection</th>
            <th>Transport</th>
            <th>Last success</th>
            <th>Recent error</th>
          </tr>
        </thead>
        <tbody>
          {data.providers.map((provider) => (
            <tr key={provider.id}>
              <td>{providerName(provider.provider)}</td>
              <td>
                <span className={`status status-${provider.status}`}>
                  {statusLabel(provider.status)}
                </span>
              </td>
              <td>{provider.transport}</td>
              <td>{formatTimestamp(provider.lastSuccessfulAt)}</td>
              <td>{provider.recentError ?? "None recorded"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="table-note">
        Webhook, poll, and snapshot connections use the same normalized
        envelope. Their edge controls stay different.
      </p>
    </section>
  );
}

function Events({ data }: { data: DashboardData }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Prism events</p>
          <h2>Mapped ticket facts</h2>
        </div>
        <span className="muted">Provider-scoped totals</span>
      </div>
      <table>
        <caption>Event facts, mappings, and source versions</caption>
        <thead>
          <tr>
            <th>Show</th>
            <th>Starts</th>
            <th>Provider mapping</th>
            <th>Net tickets</th>
            <th>Revenue</th>
            <th>Source version</th>
          </tr>
        </thead>
        <tbody>
          {data.shows.flatMap((show) =>
            show.facts.map((fact) => (
              <tr key={`${show.id}-${fact.provider}`}>
                <td>
                  <strong>{show.name}</strong>
                  <br />
                  <span className="muted">
                    {formatTimestamp(show.startsAt)}
                  </span>
                </td>
                <td>{formatTimestamp(show.startsAt)}</td>
                <td>{providerName(fact.provider)} → confirmed show</td>
                <td>
                  {(fact.soldTickets - fact.refundedTickets).toLocaleString(
                    "en-US",
                  )}
                </td>
                <td>
                  {formatCurrency(fact.grossSalesCents - fact.refundCents)}
                </td>
                <td>
                  <code>{fact.sourceVersion}</code>
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
      {data.shows.map((show) => (
        <p key={show.id} className="table-note">
          <strong>{show.name} total:</strong>{" "}
          {sumProviderTicketFacts(show.facts).toLocaleString("en-US")} net
          tickets across separate provider facts.
        </p>
      ))}
    </section>
  );
}

function NeedsReview({
  data,
  onReplay,
  onReview,
  pendingAction,
}: {
  data: DashboardData;
  onReplay: (message: MessageDto) => Promise<void>;
  onReview: (review: ReviewDto, action: "approve" | "reject") => Promise<void>;
  pendingAction: string | null;
}) {
  return (
    <div className="split-grid wide-first">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Human decision</p>
            <h2>Review queue</h2>
          </div>
          <span className="muted">Actions are scoped</span>
        </div>
        <table>
          <caption>Pending and resolved review records</caption>
          <thead>
            <tr>
              <th>Type</th>
              <th>State</th>
              <th>Created</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.reviews.length === 0 ? (
              <tr>
                <td colSpan={4}>No review items exist in this session.</td>
              </tr>
            ) : (
              data.reviews.map((review) => (
                <tr key={review.id}>
                  <td>{statusLabel(review.kind)}</td>
                  <td>
                    <span className={`status status-${review.state}`}>
                      {statusLabel(review.state)}
                    </span>
                  </td>
                  <td>{formatTimestamp(review.createdAt)}</td>
                  <td>
                    {review.state === "pending" ? (
                      <div className="button-group">
                        <button
                          disabled={pendingAction === review.id}
                          onClick={() => void onReview(review, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          className="button-secondary"
                          disabled={pendingAction === review.id}
                          onClick={() => void onReview(review, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      "Resolved"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
      <aside className="panel callout">
        <p className="eyebrow">Source evidence</p>
        <h2>Keep raw data out of the list</h2>
        <p>
          The review list uses compact stable DTOs. The scoped message-evidence
          endpoint exposes the original payload, normalized effects, and audit
          records only after a selection.
        </p>
        <p>
          This protects the table from raw provider payloads and keeps review
          actions tied to the active lab session.
        </p>
      </aside>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Recovery</p>
            <h2>Message replay</h2>
          </div>
          <span className="muted">Failed records only</span>
        </div>
        <table>
          <caption>Provider messages that can be replayed after review</caption>
          <thead>
            <tr>
              <th>Provider</th>
              <th>State</th>
              <th>
                <span className="sr-only">Replay action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.messages.length === 0 ? (
              <tr>
                <td colSpan={3}>No messages exist in this session.</td>
              </tr>
            ) : (
              data.messages.map((message) => (
                <tr key={message.id}>
                  <td>{providerName(message.provider)}</td>
                  <td>
                    <span className="status">{statusLabel(message.state)}</span>
                  </td>
                  <td>
                    <button
                      className="button-secondary"
                      disabled={
                        message.state !== "failed" ||
                        pendingAction === message.id
                      }
                      onClick={() => void onReplay(message)}
                    >
                      Replay
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function IntegrationLab({
  onReset,
  onRun,
  pendingAction,
  run,
  status,
}: {
  onReset: () => Promise<void>;
  onRun: (scenario: ScenarioId) => Promise<void>;
  pendingAction: string | null;
  run: ScenarioRunDto | null;
  status: string;
}) {
  return (
    <div className="split-grid wide-first">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Controlled practice</p>
            <h2>Scenario library</h2>
          </div>
          <span className="muted">Seven isolated cases</span>
        </div>
        <div className="scenario-list">
          {scenarios.map((scenario) => (
            <article className="scenario" key={scenario.id}>
              <div>
                <h3>{scenario.title}</h3>
                <p>{scenario.description}</p>
              </div>
              <button
                disabled={pendingAction !== null}
                onClick={() => void onRun(scenario.id)}
              >
                Run scenario
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="panel trace-panel" aria-live="polite">
        <p className="sr-only">{status}</p>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Processing trace</p>
            <h2>
              {run
                ? scenarios.find((scenario) => scenario.id === run.scenario)
                    ?.title
                : "No run selected"}
            </h2>
          </div>
          {run ? (
            <button
              className="button-secondary"
              disabled={pendingAction !== null}
              onClick={() => void onReset()}
            >
              Reset run
            </button>
          ) : null}
        </div>
        {run ? (
          <ol className="trace-list">
            {run.trace.map((step) => (
              <li key={step.order}>
                <span>{step.order + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.explanation}</p>
                  <dl>
                    <div>
                      <dt>State</dt>
                      <dd>{statusLabel(step.state)}</dd>
                    </div>
                    <div>
                      <dt>Database</dt>
                      <dd>{step.databaseEffect}</dd>
                    </div>
                  </dl>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p>
            Run a scenario to inspect its input, state changes, database effect,
            audit result, and explanation.
          </p>
        )}
      </section>
    </div>
  );
}

function IngestionWorks() {
  return (
    <div className="story-grid">
      <section className="panel story-lead">
        <p className="eyebrow">One shared pipeline</p>
        <h2>Change the edge, not the safety rules.</h2>
        <p>
          Each provider creates the same envelope. Prism saves it first, then
          queues normalization. The provider transport can change without
          bypassing audit, mapping, or review.
        </p>
      </section>
      <section className="panel">
        <p className="eyebrow">1. Signed webhook</p>
        <h2>EncoreTix</h2>
        <p>
          Fast delivery supports sale and refund updates. Signature checks,
          replay windows, duplicate keys, and snapshot reconciliation control
          late or repeated messages.
        </p>
      </section>
      <section className="panel">
        <p className="eyebrow">2. Incremental poll</p>
        <h2>VenueWave</h2>
        <p>
          The worker writes a page before it advances its cursor. Rate limits
          retain that cursor, then exponential backoff schedules another safe
          attempt.
        </p>
      </section>
      <section className="panel">
        <p className="eyebrow">3. Complete snapshot</p>
        <h2>BoxGrid</h2>
        <p>
          The system validates a complete provider snapshot in staging. A
          partial snapshot does not replace current facts.
        </p>
      </section>
      <section className="panel full-width">
        <p className="eyebrow">Durable recovery</p>
        <h2>Transactional outbox and at-least-once work</h2>
        <p>
          The database stores a provider message and an outbox record in one
          transaction. A worker can retry the outbox after a process failure.
          The queue is at-least-once, which means a job can arrive more than
          once. Delivery keys and source versions make duplicate processing
          safe; the design does not claim exactly once.
        </p>
      </section>
      <section className="panel full-width callout">
        <p className="eyebrow">Provider scope matters</p>
        <h2>400 + 600 = 1,000</h2>
        <p>
          EncoreTix sells 400 tickets before a provider change. BoxGrid then
          sends a complete BoxGrid snapshot for 600 tickets. The snapshot
          applies only to BoxGrid. Prism keeps both provider facts, so the show
          total is 1,000. Replacing the full show total with 600 would delete
          the earlier EncoreTix sales.
        </p>
      </section>
    </div>
  );
}

export function DashboardPage({ page }: { page: PageName }) {
  const [organizationSlug, setOrganizationSlug] = useState<string>(
    organizations[0].slug,
  );
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [labStatus, setLabStatus] = useState("No scenario has run.");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [run, setRun] = useState<ScenarioRunDto | null>(null);
  const sessionRef = useRef<LabSession | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const refresh = useCallback(async (token: string) => {
    const nextData = await loadDashboard(token);
    setData(nextData);
  }, []);

  const startSession = useCallback(
    async (slug: string) => {
      setData(null);
      setError(null);
      setRun(null);
      try {
        const session = await createLabSession(slug);
        sessionRef.current = session;
        await refresh(session.token);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "The demo session could not start.",
        );
      }
    },
    [refresh],
  );

  useEffect(() => {
    void startSession(organizationSlug);
  }, [organizationSlug, startSession]);

  const restoreFocus = () => {
    mainRef.current?.focus();
  };

  async function reviewAction(review: ReviewDto, action: "approve" | "reject") {
    const session = sessionRef.current;
    if (!session) return;
    setPendingAction(review.id);
    try {
      await dashboardRequest(
        session.token,
        `/api/reviews/${review.id}/${action}`,
        { parse: (value) => value },
      );
      await refresh(session.token);
      restoreFocus();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The review action failed.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function runScenario(scenario: ScenarioId) {
    const session = sessionRef.current;
    if (!session) return;
    setPendingAction(scenario);
    setLabStatus(
      `Running ${scenarios.find((item) => item.id === scenario)?.title ?? "scenario"}.`,
    );
    try {
      const nextRun = await dashboardRequest(
        session.token,
        `/api/lab/scenarios/${scenario}/run`,
        ScenarioRunDtoSchema,
      );
      setRun(nextRun);
      await refresh(session.token);
      setLabStatus("Scenario completed. The processing trace is available.");
      restoreFocus();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The scenario failed.",
      );
      setLabStatus("Scenario failed. Check the dashboard message.");
    } finally {
      setPendingAction(null);
    }
  }

  async function resetRun() {
    const session = sessionRef.current;
    if (!session || !run) return;
    setPendingAction(run.id);
    setLabStatus("Resetting the scenario run.");
    try {
      await dashboardRequest(session.token, `/api/lab/runs/${run.id}/reset`, {
        parse: (value) => value,
      });
      setRun(null);
      await refresh(session.token);
      setLabStatus("Scenario reset. You can select another scenario.");
      restoreFocus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The reset failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function replayMessage(message: MessageDto) {
    const session = sessionRef.current;
    if (!session) return;
    setPendingAction(message.id);
    try {
      await dashboardRequest(
        session.token,
        `/api/messages/${message.id}/replay`,
        {
          parse: (value) => value,
        },
      );
      await refresh(session.token);
      restoreFocus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The replay failed.");
    } finally {
      setPendingAction(null);
    }
  }

  function changeOrganization(event: FormEvent<HTMLSelectElement>) {
    setOrganizationSlug(event.currentTarget.value);
  }

  const currentOrganization = organizations.find(
    (organization) => organization.slug === organizationSlug,
  )!;
  const content = !data ? (
    <LoadingPanel error={error} />
  ) : page === "overview" ? (
    <Overview data={data} />
  ) : page === "providers" ? (
    <Providers data={data} />
  ) : page === "events" ? (
    <Events data={data} />
  ) : page === "reviews" ? (
    <NeedsReview
      data={data}
      onReplay={replayMessage}
      onReview={reviewAction}
      pendingAction={pendingAction}
    />
  ) : page === "lab" ? (
    <IntegrationLab
      onReset={resetRun}
      onRun={runScenario}
      pendingAction={pendingAction}
      run={run}
      status={labStatus}
    />
  ) : (
    <IngestionWorks />
  );
  const pageTitle =
    navigation.find((item) => item.id === page)?.label ?? "Overview";

  return (
    <div className="app-shell">
      <aside className="rail">
        <a className="brand" href="/" aria-label="Prism Integration Lab home">
          <span>PRISM</span>
          <small>INTEGRATION LAB</small>
        </a>
        <nav aria-label="Dashboard navigation">
          {navigation.map((item) => (
            <a
              key={item.id}
              className={page === item.id ? "active" : ""}
              href={item.href}
              aria-current={page === item.id ? "page" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <p className="rail-note">
          Fictional provider data
          <br />
          UTC system time
        </p>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="prototype-label">Unofficial portfolio prototype</p>
            <p className="crumb">Workspace / Ticket integrations</p>
          </div>
          <label className="organization-picker">
            <span>Demo organization</span>
            <select
              value={organizationSlug}
              onChange={changeOrganization}
              aria-label="Demo organization"
            >
              <option value={organizations[0].slug}>
                {organizations[0].label}
              </option>
              <option value={organizations[1].slug}>
                {organizations[1].label}
              </option>
            </select>
          </label>
        </header>
        <main id="main-content" ref={mainRef} tabIndex={-1}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">{currentOrganization.label}</p>
              <h1>{pageTitle}</h1>
            </div>
            <p className="session-note">
              Each browser session uses its own temporary copy of seeded data.
            </p>
          </div>
          {content}
        </main>
      </div>
    </div>
  );
}
