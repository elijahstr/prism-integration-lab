import type { ReactNode } from "react";

import type { LessonId } from "../lib/lessons";

type ChallengeLessonId = Exclude<LessonId, "overview">;

type NodeProps = {
  x: number;
  y: number;
  width: number;
  title: string;
  lines: readonly string[];
  tone?: "default" | "purple" | "green" | "red";
};

function Node({ x, y, width, title, lines, tone = "default" }: NodeProps) {
  const height = 54 + lines.length * 18;

  return (
    <g className={`architecture-node architecture-node-${tone}`}>
      <rect height={height} rx="12" width={width} x={x} y={y} />
      <text className="architecture-node-title" x={x + 18} y={y + 29}>
        {title}
      </text>
      <text className="architecture-node-detail" x={x + 18} y={y + 53}>
        {lines.map((line, index) => (
          <tspan dy={index === 0 ? 0 : 18} key={line} x={x + 18}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

type EdgeProps = {
  d: string;
  label?: string;
  labelX?: number;
  labelY?: number;
  markerId: string;
  tone?: "default" | "red" | "green";
  dashed?: boolean;
};

function Edge({
  d,
  label,
  labelX = 0,
  labelY = 0,
  markerId,
  tone = "default",
  dashed = false,
}: EdgeProps) {
  return (
    <g className={`architecture-edge architecture-edge-${tone}`}>
      <path
        className={dashed ? "dashed" : undefined}
        d={d}
        markerEnd={`url(#${markerId}-${tone})`}
      />
      {label ? (
        <text className="architecture-edge-label" x={labelX} y={labelY}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

function Store({
  x,
  y,
  width,
  title,
  detail,
}: {
  x: number;
  y: number;
  width: number;
  title: string;
  detail: string;
}) {
  return (
    <g className="architecture-store">
      <path d={`M${x},${y + 10} v64 c0,8 ${width},8 ${width},0 v-64`} />
      <ellipse cx={x + width / 2} cy={y + 10} rx={width / 2} ry="10" />
      <text className="architecture-node-title" x={x + 16} y={y + 39}>
        {title}
      </text>
      <text className="architecture-node-detail" x={x + 16} y={y + 60}>
        {detail}
      </text>
    </g>
  );
}

function Decision({
  cx,
  cy,
  lines,
}: {
  cx: number;
  cy: number;
  lines: readonly [string, string];
}) {
  return (
    <g className="architecture-decision">
      <path
        d={`M${cx},${cy - 54} L${cx + 78},${cy} L${cx},${cy + 54} L${cx - 78},${cy} Z`}
      />
      <text textAnchor="middle" x={cx} y={cy - 7}>
        {lines[0]}
      </text>
      <text textAnchor="middle" x={cx} y={cy + 14}>
        {lines[1]}
      </text>
    </g>
  );
}

function Boundary({
  x,
  y,
  width,
  height,
  label,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}) {
  return (
    <g className="architecture-boundary">
      <rect height={height} rx="18" width={width} x={x} y={y} />
      <text x={x + 16} y={y + 24}>
        {label}
      </text>
    </g>
  );
}

function DiagramCanvas({
  id,
  caption,
  description,
  height = 500,
  children,
}: {
  id: ChallengeLessonId;
  caption: string;
  description: string;
  height?: number;
  children: ReactNode;
}) {
  const markerId = `${id}-arrow`;
  const titleId = `${id}-diagram-title`;
  const descriptionId = `${id}-diagram-description`;

  return (
    <figure className="architecture-diagram">
      <figcaption id={titleId}>{caption}</figcaption>
      <div
        aria-label={`${caption} Scrollable diagram.`}
        className="architecture-viewport"
        role="group"
        tabIndex={0}
      >
        <svg
          aria-labelledby={`${titleId} ${descriptionId}`}
          role="img"
          viewBox={`0 0 1000 ${height}`}
        >
          <desc id={descriptionId}>{description}</desc>
          <defs>
            {(["default", "red", "green"] as const).map((tone) => (
              <marker
                id={`${markerId}-${tone}`}
                key={tone}
                markerHeight="8"
                markerWidth="8"
                orient="auto"
                refX="7"
                refY="4"
                viewBox="0 0 8 8"
              >
                <path className={`marker-${tone}`} d="M0,0 L8,4 L0,8 Z" />
              </marker>
            ))}
          </defs>
          {children}
        </svg>
      </div>
    </figure>
  );
}

function ApiMappingDiagram({ caption }: { caption: string }) {
  const markerId = "api-mapping-arrow";

  return (
    <DiagramCanvas
      caption={caption}
      description="DICE, Tixr, and proposed Posh pass the hypothetical Come and Take It Live show through adapters into one Prism model. Come and Take It Productions uses the mapped facts for its deal and settlement. Raw payloads remain available for audit."
      height={540}
      id="api-mapping"
    >
      <Boundary
        height={410}
        label="Ticket provider adapters"
        width={235}
        x={25}
        y={52}
      />
      <Boundary
        height={470}
        label="Prism boundary"
        width={695}
        x={295}
        y={25}
      />
      <Node
        lines={["event ID · gross"]}
        title="DICE"
        width={175}
        x={55}
        y={105}
      />
      <Node
        lines={["ticket tier · paid"]}
        title="Tixr"
        width={175}
        x={55}
        y={225}
      />
      <Node
        lines={["proposed onboarding"]}
        title="Posh (proposed)"
        width={175}
        x={55}
        y={345}
      />
      <Node
        lines={["validate · translate"]}
        title="DICE adapter"
        width={170}
        x={335}
        y={105}
      />
      <Node
        lines={["validate · translate"]}
        title="Tixr adapter"
        width={170}
        x={335}
        y={225}
      />
      <Node
        lines={["validate · translate"]}
        title="Posh adapter"
        width={170}
        x={335}
        y={345}
      />
      <Node
        lines={["Come and Take It Live", "show, sold count, gross"]}
        title="Canonical model"
        tone="purple"
        width={240}
        x={545}
        y={205}
      />
      <Node
        lines={["venue reports", "Productions settlement"]}
        title="Prism workflows"
        tone="green"
        width={170}
        x={810}
        y={210}
      />
      <Store
        detail="original evidence"
        title="Raw payloads"
        width={170}
        x={580}
        y={365}
      />
      {[145, 265, 385].map((y) => (
        <Edge d={`M230 ${y} H335`} key={y} markerId={markerId} />
      ))}
      <Edge d="M505 145 C530 145 530 280 545 295" markerId={markerId} />
      <Edge d="M505 265 C530 265 530 290 545 295" markerId={markerId} />
      <Edge d="M505 385 C530 385 530 310 545 295" markerId={markerId} />
      <Edge d="M785 295 C800 295 800 265 810 265" markerId={markerId} />
      <Edge
        d="M675 295 V365"
        label="preserve"
        labelX={683}
        labelY={337}
        markerId={markerId}
      />
    </DiagramCanvas>
  );
}

function WebhookDiagram({ caption }: { caption: string }) {
  const markerId = "webhooks-arrow";
  const actors = [
    [40, "Posh (proposed)"],
    [285, "Webhook edge"],
    [530, "Durable inbox"],
    [775, "Worker"],
  ] as const;

  return (
    <DiagramCanvas
      caption={caption}
      description="A proposed Posh onboarding event for the hypothetical Come and Take It Live show enters the Prism durable inbox. Prism processes it once, then exposes the sale to Come and Take It Productions actuals. The diagram treats webhook delivery as a design option, not a stated Posh capability."
      height={590}
      id="webhooks"
    >
      {actors.map(([x, title], index) => (
        <g key={title}>
          <Node
            lines={[index === 0 ? "external" : "Prism component"]}
            title={title}
            tone={index === 2 ? "purple" : "default"}
            width={185}
            x={x}
            y={35}
          />
          <path className="architecture-lifeline" d={`M${x + 92} 125 V545`} />
        </g>
      ))}
      <Edge
        d="M132 170 H377"
        label="1 · proposed sale event"
        labelX={185}
        labelY={158}
        markerId={markerId}
      />
      <Edge
        d="M377 235 H622"
        label="2 · verify + record"
        labelX={420}
        labelY={223}
        markerId={markerId}
      />
      <Edge
        d="M622 300 H867"
        label="3 · process event"
        labelX={670}
        labelY={288}
        markerId={markerId}
      />
      <Edge
        d="M867 365 H622"
        label="4 · mark complete"
        labelX={680}
        labelY={353}
        markerId={markerId}
        tone="green"
      />
      <Edge
        d="M132 445 H377"
        dashed
        label="5 · retry same event"
        labelX={185}
        labelY={433}
        markerId={markerId}
        tone="red"
      />
      <Edge
        d="M377 510 H132"
        dashed
        label="6 · acknowledge duplicate"
        labelX={175}
        labelY={498}
        markerId={markerId}
        tone="green"
      />
      <Node
        lines={["sales + actuals", "one effect only"]}
        title="Come and Take It Live"
        tone="green"
        width={205}
        x={775}
        y={445}
      />
    </DiagramCanvas>
  );
}

function PollingDiagram({ caption }: { caption: string }) {
  const markerId = "polling-snapshots-arrow";

  return (
    <DiagramCanvas
      caption={caption}
      description="For the hypothetical Come and Take It Live show, a three-page proposed Posh ticket report enters a provider adapter. The adapter returns normalized records and completeness metadata. Prism stages an incomplete candidate, preserves the last complete snapshot, retries the failed page or cursor, and publishes only after every page arrives and validation succeeds."
      height={590}
      id="polling-snapshots"
    >
      <Boundary
        height={430}
        label="Proposed Posh ticket report"
        width={245}
        x={20}
        y={75}
      />
      <Node
        lines={["records arrive"]}
        title="Posh page 1"
        width={195}
        x={45}
        y={125}
      />
      <Node
        lines={["records arrive"]}
        title="Posh page 2"
        width={195}
        x={45}
        y={240}
      />
      <Node
        lines={["fails · keep cursor"]}
        title="Posh page 3"
        tone="red"
        width={195}
        x={45}
        y={355}
      />
      <Node
        lines={["pagination · cursor", "rate limit · errors"]}
        title="Provider adapter"
        width={210}
        x={315}
        y={220}
      />
      <Store
        detail="candidate + metadata"
        title="Snapshot staging"
        width={195}
        x={570}
        y={235}
      />
      <Decision cx={855} cy={285} lines={["complete and", "valid?"]} />
      <Node
        lines={["venue sales · promoter actuals", "safe for settlement"]}
        title="Complete snapshot"
        tone="green"
        width={215}
        x={755}
        y={440}
      />
      <Node
        lines={[
          "keep last complete snapshot",
          "mark stale · alert after limit",
        ]}
        title="Incomplete candidate"
        tone="red"
        width={235}
        x={735}
        y={70}
      />
      <Edge
        d="M142 197 V240"
        label="page 1"
        labelX={150}
        labelY={226}
        markerId={markerId}
      />
      <Edge
        d="M142 312 V355"
        label="page 2"
        labelX={150}
        labelY={341}
        markerId={markerId}
      />
      <Edge
        d="M240 398 C275 398 275 275 315 275"
        label="normalized records + completeness"
        labelX={165}
        labelY={420}
        markerId={markerId}
      />
      <Edge
        d="M525 275 H570"
        label="stage"
        labelX={530}
        labelY={260}
        markerId={markerId}
      />
      <Edge
        d="M765 285 H777"
        label="validate"
        labelX={765}
        labelY={270}
        markerId={markerId}
      />
      <Edge
        d="M855 339 V440"
        label="yes · publish"
        labelX={865}
        labelY={390}
        markerId={markerId}
        tone="green"
      />
      <Edge
        d="M855 231 V178"
        label="no"
        labelX={865}
        labelY={210}
        markerId={markerId}
        tone="red"
      />
      <Edge
        d="M735 125 C620 45 200 45 142 355"
        dashed
        label="retry failed page or cursor"
        labelX={375}
        labelY={53}
        markerId={markerId}
        tone="red"
      />
    </DiagramCanvas>
  );
}

function OrderingDiagram({ caption }: { caption: string }) {
  const markerId = "ordering-conflicts-arrow";

  return (
    <DiagramCanvas
      caption={caption}
      description="One Prism show record is the source of truth for the hypothetical Come and Take It Live show. It holds the accepted date, room, status, and version across venue and promoter calendars, DICE, Tixr, and proposed Posh. Prism publishes valid current updates. It sends stale, conflicting, or invalid updates to review."
      height={590}
      id="ordering-conflicts"
    >
      <Boundary
        height={455}
        label="Venue, promoter, and provider updates"
        width={270}
        x={20}
        y={65}
      />
      <Node
        lines={["Come and Take It Live", "confirmed room + date · v8"]}
        title="Venue calendar"
        width={230}
        x={40}
        y={115}
      />
      <Node
        lines={["Come and Take It Productions", "hold or offer · v7"]}
        title="Promoter calendar"
        width={230}
        x={40}
        y={245}
      />
      <Node
        lines={["DICE · Tixr · proposed Posh"]}
        title="Ticket providers"
        width={230}
        x={40}
        y={375}
      />
      <Node
        lines={["accepted date · room", "status · version 8"]}
        title="Prism show record"
        tone="purple"
        width={250}
        x={355}
        y={225}
      />
      <Decision cx={730} cy={285} lines={["valid and", "current?"]} />
      <Node
        lines={["venue + promoter calendars", "DICE · Tixr · proposed Posh"]}
        title="Publish accepted state"
        tone="green"
        width={230}
        x={745}
        y={115}
      />
      <Node
        lines={["preserve evidence", "assign venue or promoter owner"]}
        title="Needs review"
        tone="red"
        width={230}
        x={745}
        y={390}
      />
      <Edge
        d="M270 158 C320 158 315 245 355 255"
        label="calendar update"
        labelX={275}
        labelY={150}
        markerId={markerId}
      />
      <Edge
        d="M270 288 H355"
        label="hold update"
        labelX={278}
        labelY={276}
        markerId={markerId}
      />
      <Edge
        d="M270 418 C320 418 315 325 355 315"
        label="provider update"
        labelX={275}
        labelY={438}
        markerId={markerId}
      />
      <Edge d="M605 285 H652" markerId={markerId} />
      <Edge
        d="M730 231 C730 160 740 160 745 160"
        label="yes"
        labelX={740}
        labelY={205}
        markerId={markerId}
        tone="green"
      />
      <Edge
        d="M730 339 C730 433 740 433 745 433"
        label="no"
        labelX={740}
        labelY={375}
        markerId={markerId}
        tone="red"
      />
    </DiagramCanvas>
  );
}

function MoneyDiagram({ caption }: { caption: string }) {
  const markerId = "money-refunds-arrow";

  return (
    <DiagramCanvas
      caption={caption}
      description="For the hypothetical Come and Take It Live show, Prism receives a $45.00 ticket refund and a separate $3.50 retained provider fee. Prism records them as sourced ledger entries with venue costs, guarantee, and co-pro split. The settlement therefore shows each party what it owes or receives."
      height={590}
      id="money-refunds"
    >
      <Boundary
        height={455}
        label="Financial sources"
        width={285}
        x={20}
        y={60}
      />
      <Node
        lines={["ticket refund −$45.00", "retained fee +$3.50"]}
        title="Provider report"
        width={240}
        x={42}
        y={120}
      />
      <Node
        lines={["venue costs · guarantee", "co-pro split"]}
        title="Show terms"
        width={240}
        x={42}
        y={335}
      />
      <Node
        lines={["amount · owner · reason", "provider or deal source"]}
        title="Classify sourced entries"
        tone="purple"
        width={235}
        x={365}
        y={240}
      />
      <Store
        detail="revenue · fee · refund · cost"
        title="Prism ledger"
        width={220}
        x={650}
        y={240}
      />
      <Node
        lines={["refund and fee stay separate", "calculate each party balance"]}
        title="Show settlement"
        tone="green"
        width={235}
        x={740}
        y={105}
      />
      <Node
        lines={["source totals · audit trail"]}
        title="Reconciliation"
        width={220}
        x={745}
        y={395}
      />
      {[176, 391].map((y) => (
        <Edge
          d={`M282 ${y} C330 ${y} 330 283 365 283`}
          key={y}
          markerId={markerId}
        />
      ))}
      <Edge
        d="M600 283 H650"
        label="typed entries"
        labelX={607}
        labelY={268}
        markerId={markerId}
      />
      <Edge
        d="M760 240 C760 180 740 175 740 175"
        label="calculate"
        labelX={708}
        labelY={195}
        markerId={markerId}
        tone="green"
      />
      <Edge
        d="M760 326 C760 370 745 440 745 440"
        label="compare"
        labelX={708}
        labelY={375}
        markerId={markerId}
      />
    </DiagramCanvas>
  );
}

function ReconciliationDiagram({ caption }: { caption: string }) {
  const markerId = "reconciliation-recovery-arrow";

  return (
    <DiagramCanvas
      caption={caption}
      description="The Come and Take It Productions offer and the Come and Take It Live ticket actuals enter Prism reconciliation. DICE, Tixr, and proposed Posh onboarding data use the same close process. Matched facts close automatically, while differences enter review and resume from a checkpoint."
      height={570}
      id="reconciliation-recovery"
    >
      <Node
        lines={["offer · guarantee · split"]}
        title="Come and Take It Productions"
        width={260}
        x={20}
        y={105}
      />
      <Node
        lines={["DICE · Tixr · Posh", "ticket actuals + payments"]}
        title="Come and Take It Live"
        width={230}
        x={30}
        y={350}
      />
      <Node
        lines={["normalize scope", "compare typed totals"]}
        title="Reconciliation"
        tone="purple"
        width={220}
        x={335}
        y={230}
      />
      <Decision cx={690} cy={280} lines={["totals", "match?"]} />
      <Node
        lines={["approved balance", "complete audit trail"]}
        title="Final settlement"
        tone="green"
        width={185}
        x={790}
        y={90}
      />
      <Node
        lines={["explain difference", "assign owner"]}
        title="Review queue"
        tone="red"
        width={185}
        x={790}
        y={300}
      />
      <Store
        detail="last safe step"
        title="Recovery checkpoint"
        width={185}
        x={580}
        y={445}
      />
      <Edge
        d="M280 148 C295 148 295 255 335 265"
        label="expected"
        labelX={290}
        labelY={145}
        markerId={markerId}
      />
      <Edge
        d="M260 393 C295 393 295 315 335 300"
        label="actual"
        labelX={270}
        labelY={410}
        markerId={markerId}
      />
      <Edge d="M555 280 H612" markerId={markerId} />
      <Edge
        d="M690 226 C690 150 745 133 790 133"
        label="yes"
        labelX={700}
        labelY={165}
        markerId={markerId}
        tone="green"
      />
      <Edge
        d="M690 334 C690 355 745 343 790 343"
        label="no"
        labelX={710}
        labelY={330}
        markerId={markerId}
        tone="red"
      />
      <Edge
        d="M882 390 C882 505 790 505 765 482"
        dashed
        label="resume"
        labelX={825}
        labelY={515}
        markerId={markerId}
      />
      <Edge
        d="M580 482 C500 482 465 350 465 320"
        dashed
        label="retry safely"
        labelX={475}
        labelY={455}
        markerId={markerId}
      />
    </DiagramCanvas>
  );
}

export function ArchitectureDiagram({
  lessonId,
  caption,
}: {
  lessonId: ChallengeLessonId;
  caption: string;
}) {
  switch (lessonId) {
    case "api-mapping":
      return <ApiMappingDiagram caption={caption} />;
    case "webhooks":
      return <WebhookDiagram caption={caption} />;
    case "polling-snapshots":
      return <PollingDiagram caption={caption} />;
    case "ordering-conflicts":
      return <OrderingDiagram caption={caption} />;
    case "money-refunds":
      return <MoneyDiagram caption={caption} />;
    case "reconciliation-recovery":
      return <ReconciliationDiagram caption={caption} />;
  }

  const unhandledLesson: never = lessonId;
  throw new Error(`No architecture diagram for ${String(unhandledLesson)}`);
}
