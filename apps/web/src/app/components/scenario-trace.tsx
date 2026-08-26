import type { ScenarioRunDto } from "@prism/contracts";

import { scenarioTitle } from "../lib/integration-lessons";

export type ScenarioTraceProps = {
  onReset: () => Promise<void>;
  pendingAction: string | null;
  run: ScenarioRunDto | null;
  status: string;
};

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export function ScenarioTrace({
  onReset,
  pendingAction,
  run,
  status,
}: ScenarioTraceProps) {
  return (
    <section className="panel trace-panel" aria-live="polite">
      <p className="sr-only">{status}</p>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Processing trace</p>
          <h2>{run ? scenarioTitle(run.scenario) : "No run selected"}</h2>
        </div>
        {run ? (
          <button
            className="button-secondary"
            disabled={pendingAction !== null}
            onClick={() => void onReset()}
          >
            Reset run
          </button>
        ) : null}
      </div>
      {run ? (
        <ol className="trace-list">
          {run.trace.map((step) => (
            <li key={step.order}>
              <span>{step.order + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.explanation}</p>
                <dl>
                  <div>
                    <dt>State</dt>
                    <dd>{statusLabel(step.state)}</dd>
                  </div>
                  <div>
                    <dt>Database</dt>
                    <dd>{step.databaseEffect}</dd>
                  </div>
                </dl>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p>
          Run a scenario to inspect its input, state changes, database effect,
          audit result, and explanation.
        </p>
      )}
    </section>
  );
}
