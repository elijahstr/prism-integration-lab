import { ScenarioIdSchema, type ScenarioId } from "@prism/contracts";

export const LESSON_IDS = [
  "overview",
  "api-mapping",
  "webhooks",
  "polling-snapshots",
  "ordering-conflicts",
  "money-refunds",
  "reconciliation-recovery",
] as const;

export type LessonId = (typeof LESSON_IDS)[number];

export type LessonDiagram = {
  description: string;
  edges: readonly { from: string; to: string; label?: string }[];
  nodes: readonly {
    detail: string;
    id: string;
    label: string;
    tone?: "accent" | "neutral";
  }[];
};

export type LessonApproach = {
  cons: readonly [string, string];
  fit: string;
  id: string;
  label: string;
  pros: readonly [string, string];
  recommended: boolean;
};

export type LessonDiscussionGroup = {
  heading: string;
  points: readonly string[];
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
  discussionGroups?: readonly [
    LessonDiscussionGroup,
    LessonDiscussionGroup,
    LessonDiscussionGroup,
  ];
  failurePrevented: string;
  kind: "challenge";
};

export type IntegrationLesson = OverviewLesson | ChallengeLesson;

export type ScenarioSummary = {
  description: string;
  title: string;
};

export const SCENARIOS_BY_ID: Record<ScenarioId, ScenarioSummary> = {
  duplicate_webhook: {
    description:
      "A second webhook delivery is acknowledged but does not duplicate sales.",
    title: "Duplicate webhook",
  },
  incomplete_snapshot: {
    description:
      "An incomplete BoxGrid snapshot cannot alter the stored facts.",
    title: "Incomplete snapshot",
  },
  late_update: {
    description:
      "An older immutable sale arrives after a newer sale and still applies once.",
    title: "Late update",
  },
  provider_change: {
    description:
      "Provider-scoped facts keep 400 EncoreTix and 600 BoxGrid tickets.",
    title: "Provider change",
  },
  provider_outage: {
    description: "VenueWave fails, records backoff, then resumes its poll.",
    title: "Provider outage",
  },
  rate_limit: {
    description: "A rate limit preserves the cursor before a scheduled retry.",
    title: "Rate limit",
  },
  uncertain_event_match: {
    description:
      "Two similar shows require a person to select the safe mapping.",
    title: "Uncertain event match",
  },
};

export const API_MAPPING_REQUIRED_TERMS = [
  "canonical model",
  "provider adapters",
  "provider and external ids",
  "unknown values",
  "integer cents",
  "utc",
  "source-zone",
  "optional fields",
  "capability records",
  "mapping versions",
  "immutable raw-payload retention",
] as const;

export const INTEGRATION_LESSONS = [
  {
    diagram: {
      description:
        "Three fictional ticket sources contribute safely to one fictional Northstar Presents concert view.",
      edges: [
        { from: "encoretix", label: "sale webhook", to: "prism" },
        { from: "venuewave", label: "poll", to: "prism" },
        { from: "boxgrid", label: "scoped snapshot", to: "prism" },
      ],
      nodes: [
        {
          detail: "Fictional sale webhook fields",
          id: "encoretix",
          label: "EncoreTix",
        },
        {
          detail: "Fictional poll fields",
          id: "venuewave",
          label: "VenueWave",
        },
        {
          detail: "Fictional snapshot fields",
          id: "boxgrid",
          label: "BoxGrid",
        },
        {
          detail: "Safe processing and lab controls",
          id: "prism",
          label: "Prism",
          tone: "accent",
        },
      ],
    },
    id: "overview",
    kind: "overview",
    readingOrder: [
      "Start with one fictional Northstar Presents concert.",
      "EncoreTix can send a fictional sale webhook, VenueWave can require a fictional poll, and BoxGrid can provide a fictional provider-scoped snapshot.",
      "Read each later tab as a problem, its choices, the selected path, its cost, and the failure that the path prevents.",
      "The existing lab proves safe processing. The later tabs explain why its controls exist.",
    ],
    scenarioIds: [],
    searchText:
      "Fictional Northstar Presents concert. Fictional EncoreTix sale webhook fields. Fictional VenueWave poll fields. Fictional BoxGrid provider-scoped snapshot fields. Safe processing reading order.",
    tabLabel: "Overview",
    title: "One fictional concert, three provider paths",
  },
  {
    approaches: [
      {
        cons: [
          "Provider branches spread.",
          "A provider change touches product logic.",
        ],
        fit: "One short-lived provider proof.",
        id: "provider-fields",
        label: "Use provider fields in product code",
        pros: ["Direct field access.", "Little initial adapter code."],
        recommended: false,
      },
      {
        cons: [
          "The model needs careful governance.",
          "Mapping versions need migration support.",
        ],
        fit: "Multiple provider contracts with shared ticket facts.",
        id: "canonical-adapters",
        label: "Canonical model plus provider adapters",
        pros: [
          "Product code has one stable shape.",
          "Adapters contain provider variation.",
        ],
        recommended: true,
      },
      {
        cons: [
          "Validation becomes a product surface.",
          "Complex fields still need code adapters.",
        ],
        fit: "Many similar customer-configured feeds.",
        id: "mapping-engine",
        label: "Use a user-configured mapping engine",
        pros: [
          "Some mappings avoid code releases.",
          "Operators can inspect field rules.",
        ],
        recommended: false,
      },
    ],
    challenge:
      "The challenge is to make three fictional shapes usable without treating them as the same provider contract. A canonical model keeps provider adapters at the boundary.",
    cost: "The recommended cost is a durable mapping registry.",
    debtPath: "Its debt path is capability and mapping-version migration work.",
    diagram: {
      description:
        "Three fictional provider shapes map into one explicit Prism model.",
      edges: [
        { from: "encoretix", label: "adapter", to: "prism" },
        { from: "venuewave", label: "adapter", to: "prism" },
        { from: "boxgrid", label: "adapter", to: "prism" },
      ],
      nodes: [
        {
          detail: "Fictional saleWebhook.sale_id field",
          id: "encoretix",
          label: "EncoreTix",
        },
        {
          detail: "Fictional poll.ticketCode field",
          id: "venuewave",
          label: "VenueWave",
        },
        {
          detail: "Fictional snapshot.order_ref field",
          id: "boxgrid",
          label: "BoxGrid",
        },
        {
          detail: "Canonical ticket fact",
          id: "prism",
          label: "Prism model",
          tone: "accent",
        },
      ],
    },
    discussionGroups: [
      {
        heading: "Identity and status",
        points: [
          "Use stable provider and external IDs to keep facts distinct.",
          "Enum maps retain unknown values.",
          "Optional fields remain explicit.",
        ],
      },
      {
        heading: "Money and time",
        points: [
          "Use integer cents to keep arithmetic exact.",
          "UTC keeps source-zone retention available for audit.",
        ],
      },
      {
        heading: "Change and proof",
        points: [
          "Use capability records to make provider limits explicit.",
          "Mapping versions support controlled migration.",
          "Use immutable raw-payload retention to preserve evidence.",
        ],
      },
    ],
    failurePrevented:
      "It prevents a provider-specific field or unknown enum from silently changing Prism financial facts.",
    id: "api-mapping",
    kind: "challenge",
    scenarioIds: ["uncertain_event_match"],
    searchText:
      "Fictional EncoreTix saleWebhook.sale_id fields, fictional VenueWave poll.ticketCode fields, and fictional BoxGrid snapshot.order_ref fields map through a canonical model with provider adapters. Preserve stable provider and external IDs, unknown values, integer cents, UTC with source-zone retention, optional fields, capability records, mapping versions, and immutable raw-payload retention.",
    tabLabel: "API Mapping",
    title: "Map provider facts without erasing differences",
  },
  {
    approaches: [
      {
        cons: ["Provider latency affects writes.", "Retry evidence is weak."],
        fit: "Low-value non-financial notifications.",
        id: "request-write",
        label: "Write facts during the webhook request",
        pros: ["Few moving parts.", "Immediate visible result."],
        recommended: false,
      },
      {
        cons: [
          "Eventual consistency appears.",
          "Queue health needs monitoring.",
        ],
        fit: "Financial changes that need retry and audit.",
        id: "durable-intake",
        label: "Verify, save raw input, acknowledge, then queue",
        pros: [
          "The provider gets a prompt response.",
          "Workers can retry safely.",
        ],
        recommended: true,
      },
      {
        cons: [
          "A new operational dependency appears.",
          "Relay semantics can hide provider details.",
        ],
        fit: "Many sources share one delivery edge.",
        id: "webhook-relay",
        label: "Use a relay before the application",
        pros: [
          "One edge can manage retries.",
          "Provider endpoints stay simpler.",
        ],
        recommended: false,
      },
    ],
    challenge:
      "The challenge is that a provider can repeat, delay, or forge a delivery.",
    cost: "The recommended cost is queue operations and delay visibility.",
    debtPath: "Its debt path is retained-message and retry monitoring.",
    diagram: {
      description:
        "A fictional provider webhook becomes durable evidence before Prism processes it.",
      edges: [
        { from: "provider", label: "signed delivery", to: "intake" },
        { from: "intake", label: "acknowledge", to: "provider" },
        { from: "intake", label: "queue", to: "worker" },
      ],
      nodes: [
        {
          detail: "Fictional EncoreTix delivery fields",
          id: "provider",
          label: "EncoreTix",
        },
        {
          detail: "Verify and save raw input",
          id: "intake",
          label: "Durable intake",
          tone: "accent",
        },
        { detail: "Retry-safe processing", id: "worker", label: "Worker" },
      ],
    },
    failurePrevented:
      "It prevents duplicate delivery, replay, and an outage from corrupting or losing a fact.",
    id: "webhooks",
    kind: "challenge",
    scenarioIds: ["duplicate_webhook"],
    searchText:
      "Fictional EncoreTix webhook fields can repeat, delay, or be forged. Durable intake preserves raw input, acknowledges safely, and queues processing.",
    tabLabel: "Webhooks",
    title: "Accept deliveries without trusting arrival",
  },
  {
    approaches: [
      {
        cons: ["Cursor commits can skip data.", "Rate limits add delay."],
        fit: "Ordered incremental APIs with stable cursors.",
        id: "cursor-only",
        label: "Cursor polling only",
        pros: ["Small responses.", "Prism controls retry time."],
        recommended: false,
      },
      {
        cons: [
          "Two paths need shared rules.",
          "Snapshot scope needs explicit checks.",
        ],
        fit: "APIs with both changes and periodic state views.",
        id: "cursor-snapshot",
        label: "Durable cursor polling plus scoped snapshot reconciliation",
        pros: [
          "Incremental work stays cheap.",
          "Snapshots find missed changes.",
        ],
        recommended: true,
      },
      {
        cons: ["Data becomes stale.", "Routine recovery depends on people."],
        fit: "Rare, low-volume correction work.",
        id: "manual-import",
        label: "Manual file import only",
        pros: ["Simple provider integration.", "An operator controls timing."],
        recommended: false,
      },
    ],
    challenge:
      "The challenge is to recover complete provider state when no trustworthy push update exists.",
    cost: "The recommended cost is cursor and snapshot reconciliation logic.",
    debtPath:
      "Its debt path is scheduled backfill and rate-limit capacity work.",
    diagram: {
      description:
        "Fictional VenueWave changes advance a durable cursor, while a scoped snapshot checks for missed state.",
      edges: [
        { from: "venuewave", label: "page", to: "cursor" },
        { from: "venuewave", label: "snapshot", to: "reconcile" },
        { from: "cursor", label: "facts", to: "reconcile" },
      ],
      nodes: [
        {
          detail: "Fictional poll cursor fields",
          id: "venuewave",
          label: "VenueWave",
        },
        { detail: "Commit after durable work", id: "cursor", label: "Cursor" },
        {
          detail: "Compare provider scope",
          id: "reconcile",
          label: "Reconcile",
          tone: "accent",
        },
      ],
    },
    failurePrevented:
      "It prevents an early cursor commit or a partial snapshot from silently losing provider state.",
    id: "polling-snapshots",
    kind: "challenge",
    scenarioIds: ["provider_outage", "rate_limit", "incomplete_snapshot"],
    searchText:
      "Fictional VenueWave poll cursor fields and fictional BoxGrid snapshot fields recover complete provider state with durable cursors and scoped reconciliation.",
    tabLabel: "Polling & Snapshots",
    title: "Recover provider state in two safe paths",
  },
  {
    approaches: [
      {
        cons: [
          "Late updates overwrite newer state.",
          "Retries can change totals.",
        ],
        fit: "Non-financial display hints.",
        id: "last-arrival",
        label: "Last arrival wins",
        pros: ["Simple comparison.", "No source metadata rule."],
        recommended: false,
      },
      {
        cons: [
          "Provider ranks need definition.",
          "Uncertain conflicts need operators.",
        ],
        fit: "Providers that expose versions or timestamps.",
        id: "version-checksum",
        label: "Provider version ranking plus checksum conflict review",
        pros: [
          "Late state stays visible in audit.",
          "Reused IDs can enter review.",
        ],
        recommended: true,
      },
      {
        cons: [
          "Different providers lack a shared clock.",
          "Central sequencing is a new service.",
        ],
        fit: "One provider owns all change order.",
        id: "global-ordering",
        label: "Global cross-provider ordering",
        pros: ["One central sequence.", "Consumers compare one field."],
        recommended: false,
      },
    ],
    challenge:
      "The challenge is that arrival time can differ from provider order, and one delivery ID can carry different content.",
    cost: "The recommended cost is version rules and review work.",
    debtPath: "Its debt path is provider-specific rank migration.",
    diagram: {
      description:
        "Provider version order and checksums separate a late update from a changed duplicate.",
      edges: [
        { from: "delivery", label: "version and checksum", to: "rank" },
        { from: "rank", label: "apply or review", to: "facts" },
      ],
      nodes: [
        {
          detail: "Fictional provider version fields",
          id: "delivery",
          label: "Delivery",
        },
        {
          detail: "Rank and conflict rules",
          id: "rank",
          label: "Compare",
          tone: "accent",
        },
        { detail: "Audited ticket facts", id: "facts", label: "Facts" },
      ],
    },
    failurePrevented:
      "It prevents an older sale or changed duplicate from silently replacing a newer refund.",
    id: "ordering-conflicts",
    kind: "challenge",
    scenarioIds: ["late_update"],
    searchText:
      "Fictional EncoreTix version fields and fictional VenueWave update fields can arrive late or reuse an ID with changed content.",
    tabLabel: "Ordering & Conflicts",
    title: "Keep provider order separate from arrival time",
  },
  {
    approaches: [
      {
        cons: [
          "Cross-provider totals cannot compare.",
          "Missing fee rules stay hidden.",
        ],
        fit: "Read-only provider reporting.",
        id: "provider-totals",
        label: "Keep provider totals only",
        pros: ["Minimal transformation.", "Source wording stays visible."],
        recommended: false,
      },
      {
        cons: [
          "A component taxonomy needs maintenance.",
          "Unusual fees need review.",
        ],
        fit: "Shared revenue, refund, tax, and fee reporting.",
        id: "integer-components",
        label: "Normalized integer-cent components with raw evidence",
        pros: ["Arithmetic stays exact.", "Raw input supports audit."],
        recommended: true,
      },
      {
        cons: [
          "Rounding differs by runtime.",
          "Financial history cannot be trusted.",
        ],
        fit: "Disposable visual prototypes.",
        id: "browser-floats",
        label: "Calculate with floating-point values in the browser",
        pros: ["Fast display work.", "No database conversion."],
        recommended: false,
      },
    ],
    challenge:
      "The challenge is that providers describe sale, refund, tax, and fee data with different names and completeness.",
    cost: "The recommended cost is a financial component taxonomy.",
    debtPath:
      "Its debt path is policy changes for new fees and currency support.",
    diagram: {
      description:
        "Fictional provider amounts become named integer-cent components with retained raw evidence.",
      edges: [
        { from: "provider", label: "raw amount fields", to: "components" },
        { from: "components", label: "exact facts", to: "report" },
      ],
      nodes: [
        {
          detail: "Fictional sale, refund, tax, and fee fields",
          id: "provider",
          label: "Provider input",
        },
        {
          detail: "Integer-cent components",
          id: "components",
          label: "Prism facts",
          tone: "accent",
        },
        { detail: "Auditable totals", id: "report", label: "Report" },
      ],
    },
    failurePrevented:
      "It prevents rounding drift or a partial refund from producing an unexplained total.",
    id: "money-refunds",
    kind: "challenge",
    scenarioIds: [],
    searchText:
      "Fictional EncoreTix sale and refund amount fields, fictional VenueWave tax fields, and fictional BoxGrid fee fields become integer-cent components with raw evidence.",
    tabLabel: "Money & Refunds",
    title: "Make financial facts exact and explainable",
  },
  {
    approaches: [
      {
        cons: [
          "Scope errors erase valid facts.",
          "The correction rationale is weak.",
        ],
        fit: "One complete, authoritative provider scope.",
        id: "automatic-overwrite",
        label: "Automatically replace stored totals",
        pros: ["Fast correction.", "Little operator work."],
        recommended: false,
      },
      {
        cons: ["Correction takes longer.", "Review queues need ownership."],
        fit: "Multiple provider scopes or uncertain differences.",
        id: "review-replay",
        label: "Compare evidence, create review, then replay safely",
        pros: ["A human sees the evidence.", "Replay keeps an audit trail."],
        recommended: true,
      },
      {
        cons: [
          "Operating cost rises.",
          "The demo does not need the complexity.",
        ],
        fit: "High-volume systems with many consumers.",
        id: "event-sourcing",
        label: "Rebuild all facts from an event stream",
        pros: ["Full historical replay.", "Independent downstream consumers."],
        recommended: false,
      },
    ],
    challenge:
      "The challenge is to correct missed or conflicting state without replacing facts outside a provider scope.",
    cost: "The recommended cost is a review workflow and replay controls.",
    debtPath:
      "Its debt path is review ownership, expiry, and bulk-resolution work.",
    diagram: {
      description:
        "A fictional BoxGrid snapshot compares scoped evidence before a reviewed replay changes Prism facts.",
      edges: [
        { from: "snapshot", label: "compare", to: "review" },
        { from: "review", label: "approved replay", to: "facts" },
      ],
      nodes: [
        {
          detail: "Fictional BoxGrid snapshot fields",
          id: "snapshot",
          label: "BoxGrid snapshot",
        },
        {
          detail: "Evidence and decision",
          id: "review",
          label: "Review",
          tone: "accent",
        },
        { detail: "Provider-scoped facts", id: "facts", label: "Prism facts" },
      ],
    },
    failurePrevented:
      "It prevents a BoxGrid snapshot from replacing valid EncoreTix sales.",
    id: "reconciliation-recovery",
    kind: "challenge",
    scenarioIds: ["provider_change"],
    searchText:
      "Fictional BoxGrid snapshot fields compare only BoxGrid provider scope. Fictional EncoreTix sale fields remain valid evidence during review and safe replay.",
    tabLabel: "Reconciliation & Recovery",
    title: "Repair only the facts that evidence can support",
  },
] as const satisfies readonly IntegrationLesson[];

export function isLessonId(value: string | null): value is LessonId {
  return LESSON_IDS.some((id) => id === value);
}

export function scenarioTitle(id: ScenarioId): string {
  return SCENARIOS_BY_ID[id].title;
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

export function getLessonContractErrors(
  lessons: readonly IntegrationLesson[],
): string[] {
  const errors: string[] = [];
  const lessonIds = new Set(lessons.map((lesson) => lesson.id));
  const scenarioCounts = new Map<ScenarioId, number>(
    ScenarioIdSchema.options.map((id) => [id, 0]),
  );

  if (lessons.length !== LESSON_IDS.length) {
    errors.push(
      `Expected ${LESSON_IDS.length} lessons, found ${lessons.length}.`,
    );
  }

  for (const id of LESSON_IDS) {
    if (!lessonIds.has(id)) errors.push(`Missing lesson: ${id}.`);
  }

  for (const lesson of lessons) {
    const textFields: ReadonlyArray<readonly [string, string]> = [
      ["tab label", lesson.tabLabel],
      ["title", lesson.title],
      ["search text", lesson.searchText],
      ["diagram description", lesson.diagram.description],
    ];

    for (const [label, value] of textFields) {
      if (!hasText(value)) errors.push(`${lesson.id} has no ${label}.`);
    }

    for (const scenarioId of lesson.scenarioIds) {
      scenarioCounts.set(scenarioId, (scenarioCounts.get(scenarioId) ?? 0) + 1);
    }

    if (lesson.kind === "overview") continue;

    const challengeTextFields: ReadonlyArray<readonly [string, string]> = [
      ["challenge", lesson.challenge],
      ["cost", lesson.cost],
      ["debt path", lesson.debtPath],
      ["failure prevented", lesson.failurePrevented],
    ];

    for (const [label, value] of challengeTextFields) {
      if (!hasText(value)) errors.push(`${lesson.id} has no ${label}.`);
    }

    if (lesson.approaches.length < 2 || lesson.approaches.length > 3) {
      errors.push(`${lesson.id} needs two or three approaches.`);
    }

    if (
      lesson.approaches.filter(({ recommended }) => recommended).length !== 1
    ) {
      errors.push(`${lesson.id} needs exactly one recommended approach.`);
    }

    for (const approach of lesson.approaches) {
      if (!hasText(approach.id))
        errors.push(`${lesson.id} has an approach without an ID.`);
      if (!hasText(approach.label)) {
        errors.push(`${lesson.id} has an approach without a label.`);
      }
      if (!hasText(approach.fit))
        errors.push(`${lesson.id} has an approach without a fit.`);
      if (approach.pros.length !== 2) {
        errors.push(
          `${lesson.id} approach ${approach.id} needs exactly two pros.`,
        );
      }
      if (approach.cons.length !== 2) {
        errors.push(
          `${lesson.id} approach ${approach.id} needs exactly two cons.`,
        );
      }
      for (const pro of approach.pros) {
        if (!hasText(pro))
          errors.push(`${lesson.id} approach ${approach.id} has an empty pro.`);
      }
      for (const con of approach.cons) {
        if (!hasText(con))
          errors.push(`${lesson.id} approach ${approach.id} has an empty con.`);
      }
    }
  }

  for (const id of ScenarioIdSchema.options) {
    const count = scenarioCounts.get(id) ?? 0;
    if (count === 0) errors.push(`Scenario ${id} is not mapped to a lesson.`);
    if (count > 1) errors.push(`Scenario ${id} is mapped ${count} times.`);
  }

  return errors;
}
