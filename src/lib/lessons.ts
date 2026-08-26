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

const PROVIDER_CONTEXT =
  "Prism supports DICE and Tixr as established providers. Posh is the proposed new provider in this hypothetical onboarding scenario.";

export const LESSONS: readonly Lesson[] = [
  {
    id: "overview",
    tab: "Overview",
    eyebrow: "Come and Take It Live · Austin, Texas",
    title: "One show, two operating views",
    intro:
      "This scenario follows one hypothetical headline show at Come and Take It Live. Come and Take It Productions promotes the same show, so Prism must keep the venue schedule, promoter deal, and ticket actuals aligned.",
    context:
      "The venue manages avails, holds, room operations, and show-day work. The promoter manages offers, guarantees, co-pro splits, expenses, and settlement. Each tab shows how a proposed Posh onboarding can use the same Prism operating model as the established ticket providers. " +
      PROVIDER_CONTEXT,
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
      "Prism needs a canonical model. A canonical model is Prism’s stable internal record for a show, a ticket sale, and its money components. It lets Come and Take It Productions use one sales report and settlement process, even when provider fields differ. " +
      PROVIDER_CONTEXT,
    diagramCaption:
      "Provider adapters map the Come and Take It Live show into one Prism record for the Come and Take It Productions deal.",
    approaches: [
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
      "A webhook is a provider message that arrives after a change. The proposed Posh onboarding must treat webhooks as an option, not an assumed capability. Prism must accept a retry without creating a second financial fact. " +
      PROVIDER_CONTEXT,
    diagramCaption:
      "A proposed Posh event enters Prism once, then updates the Come and Take It Live sales total and the Come and Take It Productions actuals.",
    approaches: [
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
    title: "A partial sales snapshot must not replace actuals",
    intro:
      "For the Come and Take It Live show, Prism may need to request orders and attendees from proposed Posh if the onboarding design does not use push events. A partial response must not erase valid sales.",
    context:
      "Polling asks a provider for changes. A snapshot describes the show at one time. Prism must validate all ticket pages before it replaces the sold count or gross that Come and Take It Productions uses for actuals. " +
      PROVIDER_CONTEXT,
    diagramCaption:
      "A proposed Posh ticket snapshot becomes the Come and Take It Live sales view only after Prism confirms the complete show scope for Come and Take It Productions.",
    approaches: [
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
        name: "Stage, validate, then publish",
        fit: "The show sales total affects the promoter’s ticket scaling and settlement.",
        pros: [
          "Users see one consistent sales view.",
          "An incomplete snapshot cannot erase ticket actuals.",
        ],
        cons: [
          "Prism needs staging space.",
          "Freshness waits for the final page.",
        ],
        debt: "Staging cleanup and snapshot monitoring become permanent operations.",
        recommended: true,
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
      title: "Reject an incomplete proposed Posh snapshot",
      setup:
        "Pages one and two of the hypothetical Posh order list arrive, but the final page fails before the show settlement.",
      steps: [
        "Keep the published Come and Take It Live sold count active.",
        "Mark the staged Posh snapshot incomplete and preserve its cursor.",
        "Retry the final page, validate the full scope, then publish the new actuals once.",
      ],
      result:
        "Come and Take It Productions does not see a temporary drop in ticket scaling or gross.",
    },
  },
  {
    id: "ordering-conflicts",
    tab: "Ordering & Conflicts",
    eyebrow: "Challenge 04 · venue and promoter state",
    title: "A stale hold must not replace a confirmed show",
    intro:
      "Come and Take It Live can confirm the hypothetical show while Come and Take It Productions still has an older hold or offer open. A later provider update does not prove the business state is newer.",
    context:
      "An avail is a date or room that can accept a show. A hold reserves that avail while the deal develops. Prism needs version and transition rules before a proposed Posh update can change the show record. " +
      PROVIDER_CONTEXT,
    diagramCaption:
      "Prism protects the confirmed Come and Take It Live show, preserves the Come and Take It Productions hold, and reviews a proposed Posh update when the business order is unclear.",
    approaches: [
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
        name: "Versions + transition rules",
        fit: "Show status affects avails, holds, contracts, and ticket sales.",
        pros: [
          "A stale Posh update fails safely.",
          "Rules describe valid changes from hold to confirmed show.",
        ],
        cons: [
          "Conflicts need an operator path.",
          "Versions must cross venue, promoter, and provider boundaries.",
        ],
        debt: "The state model and conflict tools need product ownership.",
        recommended: true,
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
        "The venue confirms version 8. A Come and Take It Productions hold based on version 7 arrives with a proposed Posh event update.",
      steps: [
        "Compare the update with the current Prism show version.",
        "Keep the confirmed venue state and reject the stale hold transition.",
        "Show the venue, promoter, and provider evidence in a conflict review.",
      ],
      result:
        "The confirmed show stays protected, and the promoter can resolve the old hold without losing its audit trail.",
    },
  },
  {
    id: "money-refunds",
    tab: "Money & Refunds",
    eyebrow: "Challenge 05 · settlement components",
    title: "One gross total cannot explain the settlement",
    intro:
      "For the Come and Take It Live show, ticket tiers, provider fees, refunds, comps, venue costs, the guarantee, and a co-pro split have different owners. One gross total hides those terms.",
    context:
      "Prism should store each money component in integer cents with its source, owner, and reason. A proposed Posh onboarding can map orders, fees, refunds or chargebacks, and affiliate or Kickback commissions without changing the Come and Take It Productions settlement rules. " +
      PROVIDER_CONTEXT,
    diagramCaption:
      "DICE, Tixr, and proposed Posh ticket facts join Come and Take It Live costs and the Come and Take It Productions deal in the Prism settlement ledger.",
    approaches: [
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
        name: "Typed financial ledger",
        fit: "The venue and promoter need a defendable show settlement.",
        pros: [
          "Each sale, fee, refund, and expense has a reason.",
          "Reports can separate venue, promoter, and co-pro owners.",
        ],
        cons: [
          "The team needs accounting discipline.",
          "Corrections need reversal entries.",
        ],
        debt: "The entry taxonomy and settlement projections need governance.",
        recommended: true,
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
        "Record a -4500 cent ticket-revenue entry against the original sale.",
        "Keep the 350 cent provider-fee entry with its policy source.",
        "Recalculate the Come and Take It Productions balance from typed entries and the co-pro split.",
      ],
      result:
        "The settlement shows the refund and retained fee as separate, explainable facts.",
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
      "Reconciliation compares independent records and explains a difference. Recovery resumes failed work from a checkpoint without deleting evidence. A proposed Posh payout or commission can enter this same close process after Prism maps it. " +
      PROVIDER_CONTEXT,
    diagramCaption:
      "Prism compares the Come and Take It Productions offer with Come and Take It Live actuals, including existing providers and the proposed Posh onboarding flow, before settlement.",
    approaches: [
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

export function isLessonId(value: string | null): value is LessonId {
  return LESSON_IDS.includes(value as LessonId);
}
