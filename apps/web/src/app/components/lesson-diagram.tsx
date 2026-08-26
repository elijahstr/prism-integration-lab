import type { LessonDiagram, LessonId } from "../lib/integration-lessons";

type LessonDiagramProps = {
  diagram: LessonDiagram;
  lessonId: LessonId;
};

export function LessonDiagram({ diagram, lessonId }: LessonDiagramProps) {
  const titleId = `${lessonId}-diagram-title`;
  const svgTitleId = `${lessonId}-diagram-svg-title`;
  const arrowId = `${lessonId}-arrow`;
  const nodes = diagram.nodes.map((node, index) => ({
    ...node,
    x: ((index + 0.5) * 720) / diagram.nodes.length,
    y: 110,
  }));
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  return (
    <figure className="lesson-diagram" aria-labelledby={titleId}>
      <figcaption id={titleId}>{diagram.description}</figcaption>
      <svg
        viewBox="0 0 720 220"
        role="img"
        aria-labelledby={`${titleId} ${svgTitleId}`}
      >
        <title id={svgTitleId}>{diagram.description}</title>
        <defs>
          <marker
            id={arrowId}
            markerHeight="8"
            markerWidth="8"
            orient="auto"
            refX="7"
            refY="4"
            viewBox="0 0 8 8"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" />
          </marker>
        </defs>
        {diagram.edges.map((edge) => {
          const from = nodesById.get(edge.from);
          const to = nodesById.get(edge.to);

          if (!from || !to) return null;

          const midpointX = (from.x + to.x) / 2;
          const midpointY = (from.y + to.y) / 2;

          return (
            <g className="lesson-diagram-edge" key={`${edge.from}-${edge.to}`}>
              <line
                markerEnd={`url(#${arrowId})`}
                x1={from.x + (from.x < to.x ? 92 : -92)}
                x2={to.x + (from.x < to.x ? -92 : 92)}
                y1={from.y}
                y2={to.y}
              />
              {edge.label ? (
                <text x={midpointX} y={midpointY - 18} textAnchor="middle">
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}
        {nodes.map((node) => (
          <g
            className={`lesson-diagram-node${node.tone === "accent" ? " lesson-diagram-node-accent" : ""}`}
            key={node.id}
            transform={`translate(${node.x} ${node.y})`}
          >
            <rect height="86" rx="10" width="172" x="-86" y="-43" />
            <text className="lesson-diagram-node-label" textAnchor="middle" y="-8">
              {node.label}
            </text>
            <text className="lesson-diagram-node-detail" textAnchor="middle" y="16">
              {node.detail}
            </text>
          </g>
        ))}
      </svg>
      <div className="lesson-diagram-mobile">
        <ol>
          {diagram.nodes.map((node) => (
            <li
              className={`lesson-diagram-mobile-node${node.tone === "accent" ? " lesson-diagram-node-accent" : ""}`}
              key={node.id}
            >
              <strong>{node.label}</strong>
              <span>{node.detail}</span>
            </li>
          ))}
        </ol>
        <ul className="lesson-diagram-mobile-edges">
          {diagram.edges.map((edge) => {
            const from = nodesById.get(edge.from);
            const to = nodesById.get(edge.to);

            if (!from || !to) return null;

            return (
              <li key={`${edge.from}-${edge.to}`}>
                <span>{from.label}</span>
                {edge.label ? <span>{edge.label}</span> : null}
                <span>{to.label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </figure>
  );
}
