import type {
  ChallengeLesson,
  LessonApproach,
} from "../lib/integration-lessons";

function ApproachCard({ approach }: { approach: LessonApproach }) {
  return (
    <article
      className={`lesson-approach${approach.recommended ? " lesson-approach-recommended" : ""}`}
      data-approach={approach.id}
    >
      <h3>{approach.label}</h3>
      <p>
        <strong>When it fits:</strong> {approach.fit}
      </p>
      <h4>Pros</h4>
      <ul>
        {approach.pros.map((pro) => (
          <li data-approach-kind="pro" key={pro}>
            {pro}
          </li>
        ))}
      </ul>
      <h4>Cons</h4>
      <ul>
        {approach.cons.map((con) => (
          <li data-approach-kind="con" key={con}>
            {con}
          </li>
        ))}
      </ul>
    </article>
  );
}

export function LessonApproachCards({ lesson }: { lesson: ChallengeLesson }) {
  return (
    <>
      <div className="lesson-approach-grid">
        {lesson.approaches.map((approach) => (
          <div key={approach.id}>
            {approach.recommended ? (
              <p className="lesson-recommended-label">Recommended</p>
            ) : null}
            <ApproachCard approach={approach} />
          </div>
        ))}
      </div>
      <dl className="lesson-tradeoff">
        <div>
          <dt>Cost</dt>
          <dd>{lesson.cost}</dd>
        </div>
        <div className="lesson-debt">
          <dt>Technical debt path</dt>
          <dd>{lesson.debtPath}</dd>
        </div>
        <div className="lesson-prevention">
          <dt>Failure prevented</dt>
          <dd>{lesson.failurePrevented}</dd>
        </div>
      </dl>
    </>
  );
}
