export const LESSON_IDS = [
  "overview",
  "api-mapping",
  "ordering-conflicts",
  "transaction-accuracy",
  "webhooks",
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
    id: "webhooks",
    tab: "Webhooks",
    eyebrow: "Challenge 04 · duplicate ticket facts",
    title: "One ticket update must change totals once",
    intro:
      "For the Come and Take It Live show, a provider can send the same sale, refund, transfer, or cancelled ticket state more than once. Prism must not double-count the event.",
    context:
      "A webhook is a provider message that arrives after a change. The proposed Posh onboarding must treat webhooks as an option, not an assumed capability. Prism must accept a retry without creating a second financial fact.",
    diagramCaption:
      "A proposed Posh event enters Prism once, then updates the Come and Take It Live sales total and the Come and Take It Productions actuals.",
    approaches: [
      {
        name: "Durable inbox + idempotency",
        fit: "Come and Take It Productions needs reliable ticket actuals before settlement.",
        pros: [
          "A sale or refund retry is safe.",
          "Prism can resume failed work from the original event.",
        ],
        cons: [
          "Prism needs storage and a worker.",
          "Each provider needs a stable event identity key.",
        ],
        debt: "The inbox needs retention, replay tools, and operational ownership.",
        recommended: true,
      },
      {
        name: "Process during the request",
        fit: "A low-volume show feed with no settlement effect.",
        pros: ["Simple request path.", "The update appears at once."],
        cons: [
          "Slow work can cause provider retries.",
          "A crash can leave a partial sale or refund update.",
        ],
        debt: "Each added side effect makes the ticket endpoint slower and harder to recover.",
      },
      {
        name: "Ignore duplicates by timestamp",
        fit: "A display-only feed with no money or settlement effect.",
        pros: ["Small implementation.", "No separate event store."],
        cons: [
          "A valid late refund can disappear.",
          "Provider clocks can order facts incorrectly.",
        ],
        debt: "Exception rules grow when ticket transfers and refunds arrive out of order.",
      },
    ],
    example: {
      title: "Receive a duplicate proposed Posh sale",
      setup:
        "A design assumption sends the same Posh sale event twice after a network timeout.",
      steps: [
        "Store the first delivery under its provider event ID.",
        "Apply the sale to the Come and Take It Live sold count and mark it complete.",
        "Acknowledge the retry without changing the Come and Take It Productions gross actuals again.",
      ],
      result:
        "The sale increases the show total once, and Prism keeps the duplicate event for audit.",
    },
  },
  {
    id: "transaction-accuracy",
    tab: "Transaction Accuracy",
    eyebrow: "Challenge 03 · accurate show settlement",
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
  "ticket-data-integrity": "webhooks",
  "polling-snapshots": "webhooks",
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
