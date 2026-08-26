import type { LessonDiagram, LessonId } from "../lib/integration-lessons";

type LessonDiagramProps = {
  diagram: LessonDiagram;
  lessonId: LessonId;
};

export function LessonDiagram({ diagram, lessonId }: LessonDiagramProps) {
  const titleId = `${lessonId}-diagram-title`;
  const nodesById = new Map(diagram.nodes.map((node) => [node.id, node]));

  return (
    <figure className="lesson-diagram" aria-labelledby={titleId}>
      <figcaption id={titleId}>{diagram.description}</figcaption>
      <ol className="lesson-diagram-flow" aria-label="Diagram nodes">
        {diagram.nodes.map((node) => (
          <li
            className={`lesson-diagram-flow-node${node.tone === "accent" ? " lesson-diagram-flow-node-accent" : ""}`}
            key={node.id}
          >
            <strong>{node.label}</strong>
            <span>{node.detail}</span>
          </li>
        ))}
      </ol>
      <ul className="lesson-diagram-paths" aria-label="Diagram relationships">
        {diagram.edges.map((edge) => {
          const from = nodesById.get(edge.from);
          const to = nodesById.get(edge.to);

          if (!from || !to) return null;

          return (
            <li key={`${edge.from}-${edge.to}`}>
              <span>{from.label}</span>
              <span aria-label="to" className="lesson-diagram-path-arrow">
                →
              </span>
              {edge.label ? (
                <span className="lesson-diagram-path-label">{edge.label}</span>
              ) : null}
              <span aria-label="to" className="lesson-diagram-path-arrow">
                →
              </span>
              <span>{to.label}</span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
