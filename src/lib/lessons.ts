export const LESSON_IDS = [
  "overview",
  "api-mapping",
  "ordering-conflicts",
  "ticket-data-integrity",
  "transaction-accuracy",
] as const;

export type LessonId = (typeof LESSON_IDS)[number];

type Approach = {
  name: string;
  fit: string;
  pros: readonly string[];
  cons: readonly string[];
  debt: string;
  recommended?: boolean;
};

export type Lesson = {
  id: LessonId;
  tab: string;
  eyebrow: string;
  title: string;
  intro: string;
  context: string;
  diagramCaption: string | null;
  approaches?: readonly Approach[];
  example?: {
    title: string;
    setup: string;
    steps: readonly string[];
    result: string;
  };
};

const LESSONS_BY_ID: readonly Lesson[] = [
  {
    id: "overview",
    tab: "Overview",
    eyebrow: "Come and Take It Live · Austin, Texas",
    title: "One show, two operating views",
    intro:
      "This scenario follows one hypothetical headline show at Come and Take It Live. Come and Take It Productions promotes the same show, so Prism must keep the venue schedule, promoter deal, and ticket actuals aligned.",
    context:
      "The venue manages avails, holds, room operations, and show-day work. The promoter manages offers, guarantees, co-pro splits, expenses, and settlement. DICE and Tixr are established providers. Posh is the proposed new provider in this hypothetical onboarding scenario.",
    diagramCaption: null,
  },
  {
    id: "api-mapping",
    tab: "API Mapping",
    eyebrow: "Challenge 01 · shared ticket model",
    title: "Provider data must mean the same thing",
    intro:
      "For the Come and Take It Live show, DICE, Tixr, and proposed Posh can describe ticket tiers, sold count, gross, fees, refunds, and comps in different fields.",
    context:
      "Prism needs a canonical model. A canonical model is Prism’s stable internal record for a show, a ticket sale, and its money components. It lets Come and Take It Productions use one sales report and settlement process, even when provider fields differ.",
    diagramCaption:
      "Provider adapters map the Come and Take It Live show into one Prism record for the Come and Take It Productions deal.",
    approaches: [
      {
        name: "Canonical model + adapters",
        fit: "The Come and Take It Live team needs one sales and settlement workflow.",
        pros: [
          "Prism uses one definition for sold count, gross, fees, refunds, and comps.",
          "Provider changes stay at the integration boundary.",
        ],
        cons: [
          "The model needs clear ownership.",
          "Mappings need versions when a provider changes a field.",
        ],
        debt: "Prism must maintain mapping versions and provider capability records.",
        recommended: true,
      },
      {
        name: "Use provider fields everywhere",
        fit: "A short proof for one provider and one show.",
        pros: ["Fast first connection.", "Little adapter code."],
        cons: [
          "Ticket tiers and fees mean different things in each screen.",
          "A provider field change can break show reporting.",
        ],
        debt: "Each Posh or provider change adds branches to venue reports and promoter settlement.",
      },
      {
        name: "Configurable mapping rules",
        fit: "Several simple Posh fields match the existing provider model.",
        pros: [
          "Some field changes need no release.",
          "Operators can inspect simple mappings.",
        ],
        cons: [
          "Money and refund rules still need code.",
          "A bad rule can change a live sales report.",
        ],
        debt: "The mapping tool needs validation, an audit trail, and support ownership.",
      },
    ],
    example: {
      title: "Map one proposed Posh order",
      setup:
        "A proposed Posh onboarding feed supplies an order, a ticket tier, a fee, and the Come and Take It Live show reference.",
      steps: [
        "Save the original order payload as audit evidence.",
        "Map the provider show reference to the Come and Take It Live show in Prism.",
        "Map the ticket tier, sold count, gross, fee, and refund state into Prism fields.",
      ],
      result:
        "Come and Take It Productions sees the same sale facts that it sees for DICE and Tixr.",
    },
  },
  {
    id: "ordering-conflicts",
    tab: "Ordering & Conflicts",
    eyebrow: "Challenge 02 · venue and promoter state",
    title: "One show record is the source of truth",
    intro:
      "One Prism show record holds the accepted date, room, status, and version across Come and Take It Live, Come and Take It Productions, their calendars, and ticket providers. A later message does not automatically win.",
    context:
      "An avail is a date or room that can accept a show. A hold reserves that avail while the deal develops. Prism checks each update against the source-of-truth record. Stale, conflicting, or invalid updates go to review with their evidence.",
    diagramCaption:
      "One Prism show record controls the accepted venue, promoter, calendar, and ticket-provider state.",
    approaches: [
      {
        name: "One source of truth with versions",
        fit: "Show status affects avails, holds, contracts, calendars, and ticket sales.",
        pros: [
          "Every system reads the accepted show date, room, status, and version from Prism.",
          "A stale provider update fails safely instead of replacing a confirmed show.",
        ],
        cons: [
          "Prism needs transition rules and a review path.",
          "Venue, promoter, calendar, and provider updates need clear ownership.",
        ],
        debt: "The state model, ownership rules, and conflict tools need product ownership.",
        recommended: true,
      },
      {
        name: "Last write wins",
        fit: "Low-value preferences where any recent value is acceptable.",
        pros: ["Very simple.", "No conflict queue."],
        cons: [
          "Arrival order can be wrong.",
          "A confirmed show can lose its valid state.",
        ],
        debt: "Teams add exceptions when holds, offers, and confirmed dates get overwritten.",
      },
      {
        name: "One system owns every field",
        fit: "One team can control a stable set of show facts.",
        pros: ["Few write conflicts.", "Simple authority rules."],
        cons: [
          "The other team waits for synchronization.",
          "Shared show facts are hard to assign.",
        ],
        debt: "The owner system becomes a bottleneck and a migration constraint.",
      },
    ],
    example: {
      title: "Protect the confirmed Come and Take It Live show",
      setup:
        "The Prism show record confirms the Come and Take It Live room and date at version 8. A Come and Take It Productions hold at version 7 arrives with a proposed Posh update.",
      steps: [
        "Compare each incoming calendar or provider update with the current Prism show version and allowed status transition.",
        "Keep the confirmed venue state as the shared source of truth and block the stale hold transition.",
        "Send the venue, promoter, calendar, and provider evidence to conflict review when the business order is unclear.",
      ],
      result:
        "The confirmed show stays aligned across calendars and providers. The promoter can resolve the old hold without losing its audit trail.",
    },
  },
  {
    id: "ticket-data-integrity",
    tab: "Ticket Data Integrity",
    eyebrow: "Challenge 03 · complete ticket facts",
    title: "Apply events once and publish complete ticket facts",
    intro:
      "Prism applies each provider event once and publishes ticket totals only after it has a complete report. It does not prove that a provider report is true. It protects complete, traceable, and current ticket facts for the show.",
    context:
      "Idempotency means a retry has the same effect as one delivery. Webhooks provide fast updates. Polling asks a provider for a paged report. Prism keeps incomplete reports in staging, keeps the last complete facts visible, and records the provider evidence and time for each published snapshot.",
    diagramCaption:
      "Prism applies a proposed Posh sale once, then publishes the Come and Take It Live ticket total only after a complete report validates.",
    approaches: [
      {
        name: "Durable inbox + staged complete snapshots",
        fit: "Come and Take It Live and Come and Take It Productions need fresh ticket actuals without double-counts or partial totals.",
        pros: [
          "A sale or refund retry is safe and traceable.",
          "An incomplete provider report cannot replace trusted ticket facts.",
        ],
        cons: [
          "Prism needs durable intake, staging, and retry state.",
          "The newest total waits for the final page and validation.",
        ],
        debt: "Inbox retention, snapshot cleanup, stale-data alerts, and replay tools need operational ownership.",
        recommended: true,
      },
      {
        name: "Process immediately and replace by page",
        fit: "A display-only list with no settlement or operational decision.",
        pros: ["Small request path.", "Each page appears quickly."],
        cons: [
          "A duplicate can change the total twice.",
          "A failed final page can publish a false sold count.",
        ],
        debt: "Recovery becomes tied to page order, request failures, and provider-specific cursor behavior.",
      },
      {
        name: "Use periodic reports only",
        fit: "A low-frequency dashboard that does not need near-real-time ticket changes.",
        pros: ["One provider access path.", "No webhook endpoint."],
        cons: [
          "Sales, refunds, and transfers remain stale between reports.",
          "A failed report delays discovery of ticket changes.",
        ],
        debt: "Operators add manual checks and special report schedules as show volume grows.",
      },
    ],
    example: {
      title: "Keep one trustworthy sold count",
      setup:
        "A proposed Posh sale for the Come and Take It Live show arrives twice. A later three-page Posh report fails on page three before it completes.",
      steps: [
        "Store the first sale under its provider event ID and acknowledge the retry without a second sold-count change.",
        "Stage report pages one and two with the failed page-three cursor, while the last complete ticket facts stay visible.",
        "Retry page three and validate the full report scope before Prism publishes the candidate snapshot.",
      ],
      result:
        "Come and Take It Live and Come and Take It Productions see one trustworthy sold count, with evidence for the event and the completed report.",
    },
  },
  {
    id: "transaction-accuracy",
    tab: "Transaction Accuracy",
    eyebrow: "Challenge 04 · accurate show settlement",
    title: "Keep each money fact separate until settlement",
    intro:
      "Prism records each financial component, then reconciles those facts before the show closes. This keeps ticket money, venue costs, and promoter deal terms accurate and explainable.",
    context:
      "A typed financial ledger stores each amount with its type, owner, reason, and source. Reconciliation compares expected and actual balances. A review queue isolates only unmatched facts. A checkpoint is the last verified step, so Prism can resume settlement without repeating completed work.",
    diagramCaption:
      "Prism keeps refund, fee, cost, and deal facts separate, then reconciles the Come and Take It Live and Come and Take It Productions settlement.",
    approaches: [
      {
        name: "Typed ledger + automated reconciliation",
        fit: "The venue and promoter need a dependable show close across ticket providers, costs, guarantees, and co-pro splits.",
        pros: [
          "Each refund, retained fee, cost, and deal term has a source and owner.",
          "Prism sends only unmatched facts to review and resumes from a verified checkpoint.",
        ],
        cons: [
          "The team needs entry types, reconciliation rules, and review ownership.",
          "Corrections need reversal entries instead of hidden edits.",
        ],
        debt: "The ledger taxonomy, thresholds, and resolution workflow need continuing finance and product ownership.",
        recommended: true,
      },
      {
        name: "One net total + manual spreadsheet close",
        fit: "A rare internal estimate with one operator and no audit requirement.",
        pros: ["Few fields to maintain.", "Flexible for a one-off deal."],
        cons: [
          "It hides fees, refunds, and cost ownership.",
          "Evidence and formula changes live outside Prism.",
        ],
        debt: "Each operator creates a different close process that is difficult to audit or repeat.",
      },
      {
        name: "Recalculate from raw provider data",
        fit: "An audit investigation, not the primary settlement process.",
        pros: [
          "Preserves provider detail.",
          "Can replay a known rule version.",
        ],
        cons: [
          "Reports cost more to compute.",
          "A provider schema or rule change can alter old results.",
        ],
        debt: "Every settlement report remains coupled to old provider payloads and historical rules.",
      },
    ],
    example: {
      title: "Close a settlement without hiding an exception",
      setup:
        "A customer receives a $45.00 refund. The provider retains a $3.50 fee. A $250.00 Come and Take It Productions expense has no evidence.",
      steps: [
        "Record the refund reversal and retained fee as separate typed ledger entries, then verify the ticket facts.",
        "Reconcile the venue costs and promoter deal terms. Send only the unsupported $250.00 expense to review.",
        "Attach the expense evidence, approve the entry, and resume the settlement from the saved checkpoint.",
      ],
      result:
        "Prism keeps each money entry accurate and closes the Come and Take It Live and Come and Take It Productions settlement with an explainable audit trail.",
    },
  },
];

export const LESSONS: readonly Lesson[] = LESSON_IDS.map((id) => {
  const lesson = LESSONS_BY_ID.find((candidate) => candidate.id === id);
  if (!lesson) throw new Error(`No lesson found for ${id}`);
  return lesson;
});

const LEGACY_LESSON_ALIASES = {
  webhooks: "ticket-data-integrity",
  "polling-snapshots": "ticket-data-integrity",
  "money-refunds": "transaction-accuracy",
  "reconciliation-recovery": "transaction-accuracy",
} as const satisfies Record<string, LessonId>;

export function resolveLessonId(value: string | null): LessonId {
  if (isLessonId(value)) return value;
  if (value && value in LEGACY_LESSON_ALIASES)
    return LEGACY_LESSON_ALIASES[value as keyof typeof LEGACY_LESSON_ALIASES];
  return "overview";
}

export function isLessonId(value: string | null): value is LessonId {
  return LESSON_IDS.includes(value as LessonId);
}
