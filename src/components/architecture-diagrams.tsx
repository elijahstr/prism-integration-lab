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

function TicketDataIntegrityDiagram({ caption }: { caption: string }) {
  const markerId = "ticket-data-integrity-arrow";
  const actors = [
    [20, "Posh (proposed)", "provider"],
    [215, "Provider adapter", "edge"],
    [410, "Durable inbox + staging", "Prism store"],
    [605, "Sync process", "Prism worker"],
    [800, "Trusted ticket facts", "published Prism view"],
  ] as const;

  return (
    <DiagramCanvas
      caption={caption}
      description="Sequence diagram. A proposed Posh sale reaches the provider adapter and durable inbox. Prism applies the first delivery once. A duplicate retry has no second effect. A later paged report returns pages one and two, then page three fails. Prism stages the incomplete report and keeps the last trusted ticket facts. After page three retries, Prism validates and publishes the complete report."
      height={1100}
      id="ticket-data-integrity"
    >
      {actors.map(([x, title, detail], index) => {
        const width = index === 2 ? 170 : 150;
        const center = x + width / 2;
        return (
          <g key={title}>
            <Node
              lines={[detail]}
              title={title}
              tone={index === 2 ? "purple" : index === 4 ? "green" : "default"}
              width={width}
              x={x}
              y={30}
            />
            <path
              className="architecture-lifeline"
              d={`M${center} 122 V1050`}
            />
          </g>
        );
      })}
      <Edge
        d="M95 175 H290"
        label="1 · sale event arrives"
        labelX={125}
        labelY={162}
        markerId={markerId}
      />
      <Edge
        d="M290 245 H495"
        label="2 · store event ID"
        labelX={325}
        labelY={232}
        markerId={markerId}
      />
      <Edge
        d="M495 315 H680"
        label="3 · first delivery"
        labelX={530}
        labelY={302}
        markerId={markerId}
      />
      <Edge
        d="M680 385 H875"
        label="4 · apply once"
        labelX={720}
        labelY={372}
        markerId={markerId}
        tone="green"
      />
      <Edge
        d="M95 465 H290"
        dashed
        label="5 · duplicate retry"
        labelX={125}
        labelY={452}
        markerId={markerId}
        tone="red"
      />
      <Edge
        d="M290 535 H495"
        dashed
        label="6 · event already complete"
        labelX={315}
        labelY={522}
        markerId={markerId}
      />
      <Edge
        d="M495 605 H95"
        dashed
        label="7 · acknowledge, no second effect"
        labelX={175}
        labelY={592}
        markerId={markerId}
        tone="green"
      />
      <Edge
        d="M95 685 H290"
        label="8 · poll report pages 1 + 2"
        labelX={120}
        labelY={672}
        markerId={markerId}
      />
      <Edge
        d="M290 755 H495"
        label="9 · stage partial report"
        labelX={325}
        labelY={742}
        markerId={markerId}
      />
      <Edge
        d="M95 825 H290"
        label="10 · page 3 fails"
        labelX={145}
        labelY={812}
        markerId={markerId}
        tone="red"
      />
      <Edge
        d="M495 895 H875"
        dashed
        label="11 · keep last trusted facts"
        labelX={575}
        labelY={882}
        markerId={markerId}
        tone="red"
      />
      <Edge
        d="M95 965 H290"
        dashed
        label="12 · retry page 3"
        labelX={140}
        labelY={952}
        markerId={markerId}
      />
      <Edge
        d="M290 1025 H495"
        label="13 · full report validates"
        labelX={315}
        labelY={1012}
        markerId={markerId}
        tone="green"
      />
      <Edge
        d="M495 1065 H875"
        label="14 · publish complete snapshot"
        labelX={590}
        labelY={1052}
        markerId={markerId}
        tone="green"
      />
    </DiagramCanvas>
  );
}

function TransactionAccuracyDiagram({ caption }: { caption: string }) {
  const markerId = "transaction-accuracy-arrow";

  return (
    <DiagramCanvas
      caption={caption}
      description="Ticket provider facts, Come and Take It Live venue costs, and Come and Take It Productions deal terms become typed Prism ledger entries. Reconciliation compares expected and actual balances. Matched entries produce final settlement. The unsupported $250 production expense enters review, and Prism resumes from the last verified checkpoint after evidence arrives."
      height={650}
      id="transaction-accuracy"
    >
      <Boundary
        height={510}
        label="Sourced show facts"
        width={250}
        x={20}
        y={70}
      />
      <Node
        lines={["refund −$45.00", "retained fee +$3.50"]}
        title="Provider ticket facts"
        width={210}
        x={40}
        y={125}
      />
      <Node
        lines={["room, staffing, and show costs"]}
        title="Come and Take It Live"
        width={210}
        x={40}
        y={285}
      />
      <Node
        lines={["guarantee · co-pro split", "unsupported expense $250.00"]}
        title="Come and Take It Productions"
        width={210}
        x={40}
        y={425}
      />
      <Node
        lines={["type · amount · owner", "reason · provider or deal source"]}
        title="Typed Prism ledger"
        tone="purple"
        width={255}
        x={315}
        y={255}
      />
      <Node
        lines={["compare expected and", "actual balances"]}
        title="Reconciliation"
        width={180}
        x={590}
        y={255}
      />
      <Decision cx={870} cy={305} lines={["matched", "facts?"]} />
      <Node
        lines={["approved balance", "complete audit trail"]}
        title="Final settlement"
        tone="green"
        width={175}
        x={805}
        y={90}
      />
      <Node
        lines={["$250 expense only", "attach evidence"]}
        title="Review queue"
        tone="red"
        width={175}
        x={805}
        y={430}
      />
      <Store
        detail="last verified step"
        title="Settlement checkpoint"
        width={230}
        x={480}
        y={510}
      />
      {[168, 328, 468].map((y) => (
        <Edge
          d={`M250 ${y} C278 ${y} 290 305 315 305`}
          key={y}
          markerId={markerId}
        />
      ))}
      <Edge d="M570 305 H590" markerId={markerId} />
      <Edge d="M770 305 H792" markerId={markerId} />
      <Edge
        d="M870 251 C870 184 865 170 805 170"
        markerId={markerId}
        tone="green"
      />
      <Edge
        d="M870 359 C870 400 875 410 875 430"
        markerId={markerId}
        tone="red"
      />
      <Edge
        d="M892 520 C892 585 735 590 710 555"
        dashed
        label="evidence approved"
        labelX={780}
        labelY={594}
        markerId={markerId}
        tone="green"
      />
      <Edge
        d="M480 555 C420 555 390 430 440 345"
        dashed
        label="resume from checkpoint"
        labelX={350}
        labelY={500}
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
    case "ordering-conflicts":
      return <OrderingDiagram caption={caption} />;
    case "ticket-data-integrity":
      return <TicketDataIntegrityDiagram caption={caption} />;
    case "transaction-accuracy":
      return <TransactionAccuracyDiagram caption={caption} />;
  }

  const unhandledLesson: never = lessonId;
  throw new Error(`No architecture diagram for ${String(unhandledLesson)}`);
}
