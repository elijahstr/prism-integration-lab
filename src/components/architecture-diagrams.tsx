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
      description="Prism requests a proposed Posh order and attendee snapshot for the hypothetical Come and Take It Live show. Only a complete scope can change venue sales and Come and Take It Productions actuals. Polling is a design option, not a stated Posh capability."
      height={540}
      id="polling-snapshots"
    >
      <Node
        lines={["cursor · retry budget"]}
        title="Prism poll"
        width={170}
        x={35}
        y={205}
      />
      <Boundary
        height={360}
        label="Proposed Posh pages"
        width={270}
        x={255}
        y={75}
      />
      <Node
        lines={["orders 1–100"]}
        title="Posh page 1"
        width={190}
        x={295}
        y={125}
      />
      <Node
        lines={["orders 101–200"]}
        title="Posh page 2"
        width={190}
        x={295}
        y={235}
      />
      <Node
        lines={["final cursor"]}
        title="Posh page 3"
        width={190}
        x={295}
        y={345}
      />
      <Store
        detail="isolated candidate"
        title="Snapshot staging"
        width={175}
        x={550}
        y={205}
      />
      <Decision cx={850} cy={245} lines={["scope", "complete?"]} />
      <Node
        lines={["venue sales", "Productions actuals"]}
        title="Come and Take It Live"
        tone="green"
        width={195}
        x={785}
        y={385}
      />
      <Node
        lines={["keep prior snapshot", "Productions reviews"]}
        title="Safe failure"
        tone="red"
        width={170}
        x={790}
        y={70}
      />
      <Edge
        d="M205 248 H255"
        label="request"
        labelX={207}
        labelY={235}
        markerId={markerId}
      />
      <Edge
        d="M525 245 H550"
        label="stage"
        labelX={525}
        labelY={232}
        markerId={markerId}
      />
      <Edge
        d="M725 245 H772"
        label="validate"
        labelX={726}
        labelY={232}
        markerId={markerId}
      />
      <Edge
        d="M850 299 V385"
        label="yes"
        labelX={860}
        labelY={340}
        markerId={markerId}
        tone="green"
      />
      <Edge
        d="M850 191 V158"
        label="no"
        labelX={860}
        labelY={180}
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
      description="A Come and Take It Live confirmation and a Come and Take It Productions hold meet at Prism transition rules. A proposed Posh onboarding update can change the show only when its version and business state are safe."
      height={520}
      id="ordering-conflicts"
    >
      <Node
        lines={["confirmed · version 8"]}
        title="Come and Take It Live"
        width={230}
        x={25}
        y={105}
      />
      <Node
        lines={["hold · based on v7"]}
        title="Come and Take It Productions"
        width={255}
        x={25}
        y={315}
      />
      <Node
        lines={["proposed Posh update", "check allowed transition"]}
        title="Onboarding conflict rule"
        tone="purple"
        width={225}
        x={335}
        y={205}
      />
      <Decision cx={690} cy={255} lines={["safe to", "apply?"]} />
      <Node
        lines={["write next version", "publish new state"]}
        title="Show record"
        tone="green"
        width={180}
        x={790}
        y={105}
      />
      <Node
        lines={["preserve evidence", "assign operator"]}
        title="Needs review"
        tone="red"
        width={180}
        x={790}
        y={315}
      />
      <Edge
        d="M255 148 C290 148 290 230 335 240"
        label="new fact"
        labelX={260}
        labelY={145}
        markerId={markerId}
      />
      <Edge
        d="M280 358 C300 358 300 285 335 275"
        label="stale fact"
        labelX={255}
        labelY={375}
        markerId={markerId}
      />
      <Edge d="M560 255 H612" markerId={markerId} />
      <Edge
        d="M690 201 C690 148 740 148 790 148"
        label="yes"
        labelX={700}
        labelY={160}
        markerId={markerId}
        tone="green"
      />
      <Edge
        d="M690 309 C690 358 740 358 790 358"
        label="no"
        labelX={700}
        labelY={350}
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
      description="DICE, Tixr, and proposed Posh ticket facts join the hypothetical Come and Take It Live venue costs and the Come and Take It Productions deal. Prism classifies each amount before settlement and reconciliation."
      height={560}
      id="money-refunds"
    >
      <Boundary
        height={430}
        label="Financial sources"
        width={270}
        x={15}
        y={60}
      />
      <Node
        lines={["sales · fees · refunds"]}
        title="DICE"
        width={220}
        x={40}
        y={120}
      />
      <Node
        lines={["ticket tiers · comps"]}
        title="Tixr"
        width={220}
        x={40}
        y={245}
      />
      <Node
        lines={["fees · refunds · Kickback"]}
        title="Posh (proposed)"
        width={220}
        x={40}
        y={370}
      />
      <Node
        lines={["Come and Take It Live costs", "Productions deal + split"]}
        title="Classify entry"
        tone="purple"
        width={225}
        x={350}
        y={230}
      />
      <Store
        detail="append-only entries"
        title="Prism ledger"
        width={205}
        x={650}
        y={230}
      />
      <Node
        lines={["deal terms · splits"]}
        title="Settlement"
        tone="green"
        width={170}
        x={800}
        y={80}
      />
      <Node
        lines={["source totals · audit"]}
        title="Reconciliation"
        width={170}
        x={800}
        y={385}
      />
      {[163, 288, 413].map((y) => (
        <Edge
          d={`M245 ${y} C305 ${y} 305 273 350 273`}
          key={y}
          markerId={markerId}
        />
      ))}
      <Edge
        d="M575 273 H650"
        label="typed cents"
        labelX={583}
        labelY={260}
        markerId={markerId}
      />
      <Edge
        d="M752 230 C752 165 770 130 800 123"
        label="calculate"
        labelX={715}
        labelY={170}
        markerId={markerId}
        tone="green"
      />
      <Edge
        d="M752 304 C752 370 770 415 800 428"
        label="compare"
        labelX={720}
        labelY={360}
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
        title="Posh onboarding"
        width={185}
        x={580}
        y={445}
      />
      <Edge
        d="M245 148 C295 148 295 255 335 265"
        label="expected"
        labelX={260}
        labelY={145}
        markerId={markerId}
      />
      <Edge
        d="M245 393 C295 393 295 315 335 300"
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
