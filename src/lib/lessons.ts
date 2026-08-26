export const LESSON_IDS = [
  "overview",
  "api-mapping",
  "webhooks",
  "ordering-conflicts",
  "money-refunds",
  "reconciliation-recovery",
  "polling-snapshots",
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
    id: "webhooks",
    tab: "Webhooks",
    eyebrow: "Challenge 02 · duplicate ticket facts",
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
    id: "polling-snapshots",
    tab: "Polling & Snapshots",
    eyebrow: "Challenge 03 · complete sales scope",
    title: "Do not publish a partial ticket report",
    intro:
      "Prism can ask a provider for a ticket report in pages. A snapshot is the complete sales picture for one show at one time. An incomplete report must not replace the last trusted sales total.",
    context:
      "The provider adapter handles pagination, cursors, completion signals, rate limits, and provider errors. It returns normalized records plus completeness metadata. The adapter says what the provider sent. The Prism synchronization workflow decides if the snapshot is safe to publish.",
    diagramCaption:
      "Prism stages a three-page ticket report, then publishes it only after every page arrives and validation succeeds.",
    approaches: [
      {
        name: "Stage, validate, then publish",
        fit: "The show sales total affects the promoter’s ticket scaling and settlement.",
        pros: [
          "Users keep one complete, consistent sales view.",
          "An incomplete candidate cannot change ticket actuals or settlement.",
        ],
        cons: [
          "Prism needs staging and retry state.",
          "Freshness waits for the final page and validation.",
        ],
        debt: "Staging cleanup, retry limits, and stale-data alerts need operational ownership.",
        recommended: true,
      },
      {
        name: "Replace after every page",
        fit: "A small inventory list with no page cursor.",
        pros: ["Fresh data appears quickly.", "Little temporary storage."],
        cons: [
          "A failed page creates a false sold count.",
          "The promoter sees changing intermediate gross.",
        ],
        debt: "Recovery becomes tied to page order and provider-specific cursor behavior.",
      },
      {
        name: "Append every observed order",
        fit: "A provider feed gives immutable transactions only.",
        pros: ["Preserves history.", "Partial batches remain useful."],
        cons: [
          "Prism cannot infer cancelled tickets.",
          "Corrections need explicit events.",
        ],
        debt: "Prism must build projection and correction rules for each ticket report.",
      },
    ],
    example: {
      title: "Hold a partial three-page ticket report",
      setup:
        "For the Come and Take It Live show, pages one and two of a proposed Posh ticket report arrive. Page three fails before the report completes.",
      steps: [
        "Store pages one and two as an incomplete candidate in staging, with the failed page and cursor.",
        "Keep the last complete snapshot published for the venue calendar, promoter actuals, and settlement.",
        "Retry from the failed page or cursor. Publish only after page three arrives and full-scope validation succeeds.",
      ],
      result:
        "If retries fail, Prism marks the data stale, preserves the evidence, alerts an operator after the retry limit, and never calculates settlement from the incomplete report.",
    },
  },
  {
    id: "ordering-conflicts",
    tab: "Ordering & Conflicts",
    eyebrow: "Challenge 04 · venue and promoter state",
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
    id: "money-refunds",
    tab: "Money & Refunds",
    eyebrow: "Challenge 05 · settlement components",
    title: "A refund and a fee need separate entries",
    intro:
      "A customer receives a $45.00 ticket refund, while a $3.50 provider fee remains. One net or gross value cannot show who owes what in the Come and Take It Live and Come and Take It Productions settlement.",
    context:
      "Prism stores ticket revenue, fees, refunds, venue costs, the guarantee, and the co-pro split as sourced entries. Each entry has an amount, owner, reason, and source. This makes the settlement explainable when a provider keeps a fee after a refund.",
    diagramCaption:
      "Prism separates a $45.00 refund from a $3.50 retained provider fee before it calculates the show settlement.",
    approaches: [
      {
        name: "Typed financial ledger",
        fit: "The venue and promoter need a defendable show settlement.",
        pros: [
          "Each sale, fee, refund, venue cost, guarantee, and split has a source and owner.",
          "The settlement can show why $45.00 returns to the customer while $3.50 remains a provider fee.",
        ],
        cons: [
          "The team needs accounting discipline.",
          "Corrections need reversal entries.",
        ],
        debt: "The entry taxonomy and settlement projections need governance.",
        recommended: true,
      },
      {
        name: "Store one net total",
        fit: "A temporary dashboard with no settlement use.",
        pros: ["Easy to display.", "Few fields."],
        cons: [
          "It hides fees, refunds, comps, and affiliate commissions.",
          "It cannot explain the guarantee or co-pro split.",
        ],
        debt: "Later reconciliation needs raw ticket data that the model did not preserve.",
      },
      {
        name: "Recalculate from raw payloads",
        fit: "An audit tool, not the primary settlement path.",
        pros: ["Preserves provider detail.", "Rules can replay history."],
        cons: [
          "Reports cost more to compute.",
          "Rule changes can alter past results.",
        ],
        debt: "Every report depends on old provider schemas and code versions.",
      },
    ],
    example: {
      title: "Apply a refund without hiding the provider fee",
      setup:
        "A proposed Posh ticket refund returns $45.00 for the Come and Take It Live show, but a $3.50 fee remains under the provider policy.",
      steps: [
        "Record a -$45.00 ticket-revenue reversal against the original sale, with the provider report as its source.",
        "Keep the $3.50 provider-fee entry, owner, and policy source as a separate fact.",
        "Calculate the venue cost, guarantee, and co-pro split from the sourced entries, not from one net total.",
      ],
      result:
        "The settlement shows the refund, retained fee, and each party’s balance as separate, explainable facts.",
    },
  },
  {
    id: "reconciliation-recovery",
    tab: "Reconciliation & Recovery",
    eyebrow: "Challenge 06 · close the show with proof",
    title: "Settlement must explain each difference",
    intro:
      "Before the hypothetical show closes, Come and Take It Live and Come and Take It Productions compare the offer, guarantee, ticket actuals, payments, expenses, and co-pro split.",
    context:
      "Reconciliation compares independent records and explains a difference. Recovery resumes failed work from a checkpoint without deleting evidence. A proposed Posh payout or commission can enter this same close process after Prism maps it.",
    diagramCaption:
      "Prism compares the Come and Take It Productions offer with Come and Take It Live actuals, including existing providers and the proposed Posh onboarding flow, before settlement.",
    approaches: [
      {
        name: "Automated checks + review queue",
        fit: "Regular venue and promoter settlement with multiple ticket providers.",
        pros: [
          "Common differences resolve automatically.",
          "People focus on a missing payout, receipt, or commission.",
        ],
        cons: [
          "Rules need thresholds and owners.",
          "The review queue needs clear resolution states.",
        ],
        debt: "Unowned exceptions can become an operational backlog.",
        recommended: true,
      },
      {
        name: "Manual spreadsheet close",
        fit: "Rare shows with one operator and few sources.",
        pros: ["Flexible for unusual deals.", "No new product workflow."],
        cons: [
          "An operator can copy the wrong gross or expense.",
          "Evidence lives outside Prism.",
        ],
        debt: "Each operator creates a different settlement process that is hard to audit.",
      },
      {
        name: "Block until every source matches",
        fit: "A close process with strict source equality.",
        pros: [
          "No unresolved difference passes.",
          "A strong control boundary.",
        ],
        cons: [
          "One delayed payout blocks settlement.",
          "Minor rounding differences stop the close.",
        ],
        debt: "Teams create bypasses when the strict gate does not fit real show operations.",
      },
    ],
    example: {
      title: "Recover a Posh settlement check",
      setup:
        "Ticket totals match, but a proposed Posh affiliate commission and a $250 production expense need evidence before the Come and Take It Productions settlement.",
      steps: [
        "Mark the DICE, Tixr, and Posh ticket comparison complete at its checkpoint.",
        "Route only the unmatched commission and expense to the promoter review queue.",
        "Attach evidence, approve the entries, and resume the settlement from the checkpoint.",
      ],
      result:
        "The show closes without repeating verified work or hiding the exception from the audit trail.",
    },
  },
];

export const LESSONS: readonly Lesson[] = LESSON_IDS.map((id) => {
  const lesson = LESSONS_BY_ID.find((candidate) => candidate.id === id);
  if (!lesson) throw new Error(`No lesson found for ${id}`);
  return lesson;
});

export function isLessonId(value: string | null): value is LessonId {
  return LESSON_IDS.includes(value as LessonId);
}
