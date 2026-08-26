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

export const LESSONS: readonly Lesson[] = [
  {
    id: "overview",
    tab: "Overview",
    eyebrow: "Austin venue + promoter scenario",
    title: "One business group, two operating views",
    intro:
      "Come and Take It Live is an Austin music venue. Come and Take It Productions promotes and produces shows. Prism must support both workflows without mixing venue operations, promoter deals, or settlement facts.",
    context:
      "This portfolio prototype explores architecture problems that can appear when Prism connects those workflows to different ticket providers. The providers and transport examples are hypothetical.",
    diagramCaption: null,
  },
  {
    id: "api-mapping",
    tab: "API Mapping",
    eyebrow: "Challenge 01 · shared language",
    title: "Different provider fields must mean the same thing",
    intro:
      "One provider can call a show an event, another can call it a performance, and a third can split one ticket price into several fields.",
    context:
      "Prism needs one canonical model. A canonical model is the stable internal language that each provider maps into.",
    diagramCaption:
      "Provider adapters translate different shapes before product logic uses them.",
    approaches: [
      {
        name: "Use provider fields everywhere",
        fit: "A disposable proof with one provider.",
        pros: ["Fast first connection.", "Little adapter code."],
        cons: [
          "Provider rules leak into every screen.",
          "A field change can break product logic.",
        ],
        debt: "Each new provider multiplies branches and makes reports harder to trust.",
      },
      {
        name: "Canonical model + adapters",
        fit: "Several providers must support the same Prism workflow.",
        pros: [
          "Product code uses one stable shape.",
          "Provider changes stay at the boundary.",
        ],
        cons: [
          "The model needs careful ownership.",
          "Mappings need versions and migrations.",
        ],
        debt: "The team must maintain mapping versions and explicit provider capabilities.",
        recommended: true,
      },
      {
        name: "Configurable mapping rules",
        fit: "Many simple feeds use similar fields.",
        pros: [
          "Some changes need no release.",
          "Operators can inspect simple rules.",
        ],
        cons: [
          "Complex mappings still need code.",
          "Bad configuration becomes a runtime risk.",
        ],
        debt: "The mapping tool becomes a product with validation, audit, and support needs.",
      },
    ],
    example: {
      title: "Map one ticket sale",
      setup: "A provider sends event_ref, paid_total, and local_time.",
      steps: [
        "Validate the provider payload and save the original value.",
        "Resolve event_ref to the Prism show for Come and Take It Live.",
        "Convert paid_total to integer cents and local_time to UTC.",
      ],
      result:
        "Prism receives one typed sale fact without losing the provider evidence.",
    },
  },
  {
    id: "webhooks",
    tab: "Webhooks",
    eyebrow: "Challenge 02 · repeated messages",
    title: "The same ticket update can arrive more than once",
    intro:
      "A hypothetical provider can retry a webhook when Prism replies slowly. Two deliveries must not create two sales or refunds.",
    context:
      "A webhook is a provider message that arrives when something changes. Delivery is usually at least once, not exactly once.",
    diagramCaption:
      "The receiver accepts repeats, then applies each provider event once.",
    approaches: [
      {
        name: "Process during the request",
        fit: "Low volume and non-critical updates.",
        pros: ["Simple request path.", "The result appears immediately."],
        cons: [
          "Slow work causes retries.",
          "A crash can leave partial updates.",
        ],
        debt: "Each new side effect makes the request slower and harder to recover.",
      },
      {
        name: "Durable inbox + idempotency",
        fit: "Ticket and money facts need reliable processing.",
        pros: ["Retries are safe.", "Failed work can resume from evidence."],
        cons: [
          "Needs storage and a processor.",
          "Teams must define stable identity keys.",
        ],
        debt: "The inbox needs retention, replay tools, and operational ownership.",
        recommended: true,
      },
      {
        name: "Ignore duplicates by timestamp",
        fit: "A display-only feed with no financial effect.",
        pros: ["Small implementation.", "No extra message store."],
        cons: [
          "Valid late updates can disappear.",
          "Clock differences cause wrong decisions.",
        ],
        debt: "Exceptions accumulate when provider time does not match business order.",
      },
    ],
    example: {
      title: "Receive a duplicate sale",
      setup: "The provider sends sale_481 twice after a network timeout.",
      steps: [
        "Store the first delivery under its provider event ID.",
        "Apply the sale and mark the inbox record complete.",
        "Acknowledge the second delivery without applying the sale again.",
      ],
      result:
        "The venue sales total increases once, and the retry stays visible for audit.",
    },
  },
  {
    id: "polling-snapshots",
    tab: "Polling & Snapshots",
    eyebrow: "Challenge 03 · providers without push updates",
    title: "A snapshot can be useful without being complete",
    intro:
      "A hypothetical provider might require Prism to request current sales. A partial response must not erase valid ticket facts.",
    context:
      "Polling asks a provider for changes. A snapshot describes state at one time. Prism must know its scope before it replaces anything.",
    diagramCaption:
      "A scoped snapshot becomes authoritative only after validation completes.",
    approaches: [
      {
        name: "Replace after every page",
        fit: "A small, non-paginated inventory list.",
        pros: ["Fresh data appears quickly.", "Little temporary storage."],
        cons: [
          "A failed page creates a false total.",
          "Users see changing intermediate states.",
        ],
        debt: "Recovery rules become tied to page order and provider quirks.",
      },
      {
        name: "Stage, validate, then publish",
        fit: "Settlement and sales totals need a complete scope.",
        pros: [
          "Readers see one consistent state.",
          "Incomplete snapshots cannot erase facts.",
        ],
        cons: ["Needs staging space.", "Freshness waits for the final page."],
        debt: "Staging cleanup and snapshot monitoring become permanent operations.",
        recommended: true,
      },
      {
        name: "Append every observed record",
        fit: "Providers offer immutable transactions.",
        pros: ["Preserves history.", "Partial batches remain useful."],
        cons: ["Cannot infer deletions.", "Corrections need explicit events."],
        debt: "Prism must build projection and correction logic for every report.",
      },
    ],
    example: {
      title: "Reject an incomplete snapshot",
      setup:
        "Pages one and two arrive, but page three fails before settlement.",
      steps: [
        "Keep the last published snapshot active.",
        "Mark the staged snapshot incomplete and preserve its cursor.",
        "Retry page three, validate the full scope, then publish once.",
      ],
      result: "The promoter never sees a temporary drop in ticket sales.",
    },
  },
  {
    id: "ordering-conflicts",
    tab: "Ordering & Conflicts",
    eyebrow: "Challenge 04 · concurrent venue and promoter work",
    title: "A stale update must not replace a confirmed show",
    intro:
      "The venue can confirm a show while the promoter still has an older hold open. Arrival order does not prove business order.",
    context:
      "Prism needs a version rule and an explicit conflict path when two systems change the same business fact.",
    diagramCaption:
      "Version checks protect the confirmed record and route uncertain conflicts for review.",
    approaches: [
      {
        name: "Last write wins",
        fit: "Low-value preferences where any recent value is acceptable.",
        pros: ["Very simple.", "No conflict queue."],
        cons: [
          "Arrival order can be wrong.",
          "Valid work disappears silently.",
        ],
        debt: "Teams add exceptions when important states get overwritten.",
      },
      {
        name: "Versions + transition rules",
        fit: "Show status affects holds, contracts, and work.",
        pros: [
          "Stale writes fail safely.",
          "Rules express valid business changes.",
        ],
        cons: [
          "Conflicts need a user path.",
          "Versions must cross system boundaries.",
        ],
        debt: "The state machine and conflict tools require product ownership.",
        recommended: true,
      },
      {
        name: "One system owns every field",
        fit: "Ownership is stable and clear.",
        pros: ["Few write conflicts.", "Simple authority rules."],
        cons: [
          "Other teams wait for synchronization.",
          "Shared fields are hard to assign.",
        ],
        debt: "The owner system becomes a bottleneck and a migration constraint.",
      },
    ],
    example: {
      title: "Protect a confirmed show",
      setup:
        "The venue confirms version 8. A promoter hold based on version 7 arrives later.",
      steps: [
        "Compare the promoter update with the current record version.",
        "Reject the stale status change and keep the confirmed state.",
        "Show both values and their sources in a conflict notice.",
      ],
      result:
        "The confirmed date stays protected, and the promoter can resolve the stale hold.",
    },
  },
  {
    id: "money-refunds",
    tab: "Money & Refunds",
    eyebrow: "Challenge 05 · financial meaning",
    title: "One gross total cannot explain who owes what",
    intro:
      "Ticket revenue, fees, refunds, venue rental income, bar sales, expenses, and co-promoter splits have different owners and rules.",
    context:
      "Prism should store money as explicit components in integer cents. It should never infer settlement from one provider total.",
    diagramCaption:
      "A financial ledger keeps amount, owner, source, and reason together.",
    approaches: [
      {
        name: "Store one net total",
        fit: "A temporary dashboard with no settlement use.",
        pros: ["Easy to display.", "Few fields."],
        cons: [
          "Hides fees and refunds.",
          "Cannot explain ownership or timing.",
        ],
        debt: "Later reconciliation needs raw data that the model did not preserve.",
      },
      {
        name: "Typed financial ledger",
        fit: "Venue and promoter settlement needs an audit trail.",
        pros: [
          "Every change has a reason.",
          "Reports can separate owners and categories.",
        ],
        cons: [
          "Needs accounting discipline.",
          "Corrections require reversal entries.",
        ],
        debt: "The entry taxonomy and settlement projections need careful governance.",
        recommended: true,
      },
      {
        name: "Recalculate from raw payloads",
        fit: "A backup audit tool, not the primary product path.",
        pros: ["Preserves provider detail.", "Rules can replay history."],
        cons: [
          "Reports are expensive to compute.",
          "Rule changes alter past results.",
        ],
        debt: "Every report depends on old schemas and reproducible code versions.",
      },
    ],
    example: {
      title: "Apply a refund without hiding fees",
      setup:
        "A ticket refund returns $45.00, but a $3.50 provider fee remains.",
      steps: [
        "Record a -4500 cent ticket-revenue entry against the original sale.",
        "Keep the 350 cent provider-fee entry with its policy source.",
        "Recalculate the promoter balance from typed entries.",
      ],
      result:
        "The settlement shows the refund and the retained fee as separate facts.",
    },
  },
  {
    id: "reconciliation-recovery",
    tab: "Reconciliation & Recovery",
    eyebrow: "Challenge 06 · close the show with proof",
    title: "Settlement must explain every difference",
    intro:
      "Before a show closes, the venue and promoter need to compare the offer, ticket totals, payments, expenses, and co-promoter splits.",
    context:
      "Reconciliation compares independent records. Recovery resumes failed work without deleting the evidence that explains a difference.",
    diagramCaption:
      "Prism compares source totals, isolates differences, and resumes from checkpoints.",
    approaches: [
      {
        name: "Manual spreadsheet close",
        fit: "Rare shows with one operator and few sources.",
        pros: ["Flexible for unusual deals.", "No new product workflow."],
        cons: [
          "Easy to copy the wrong value.",
          "Evidence lives outside Prism.",
        ],
        debt: "Each operator builds a different process that is hard to audit or repeat.",
      },
      {
        name: "Automated checks + review queue",
        fit: "Regular venue and promoter settlement.",
        pros: [
          "Common differences resolve automatically.",
          "People focus on real exceptions.",
        ],
        cons: [
          "Rules need thresholds and ownership.",
          "The queue needs clear resolution states.",
        ],
        debt: "Unowned exceptions can become a growing operational backlog.",
        recommended: true,
      },
      {
        name: "Block until every source matches",
        fit: "Regulated close processes with strict source equality.",
        pros: ["No unresolved difference passes.", "Strong control boundary."],
        cons: [
          "One delayed source blocks everyone.",
          "Minor rounding issues stop closure.",
        ],
        debt: "Teams create bypasses when the strict gate does not fit real operations.",
      },
    ],
    example: {
      title: "Recover a settlement check",
      setup:
        "Ticket totals match, but a $250 production expense has no linked receipt.",
      steps: [
        "Mark the ticket comparison complete at its checkpoint.",
        "Route only the unmatched expense to the promoter review queue.",
        "Attach the receipt, approve the expense, and resume from the checkpoint.",
      ],
      result:
        "The show closes without repeating verified work or hiding the exception.",
    },
  },
];

export function isLessonId(value: string | null): value is LessonId {
  return LESSON_IDS.includes(value as LessonId);
}
