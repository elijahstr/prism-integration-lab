"use client";

import type { KeyboardEvent } from "react";
import { useRef } from "react";
import type { ScenarioId, ScenarioRunDto } from "@prism/contracts";

import {
  type IntegrationLesson,
  type LessonId,
  INTEGRATION_LESSONS,
  SCENARIOS_BY_ID,
} from "../lib/integration-lessons";
import { LessonApproachCards } from "./lesson-approach-cards";
import { LessonDiagram } from "./lesson-diagram";
import { ScenarioTrace } from "./scenario-trace";

export type IntegrationLessonsProps = {
  activeLessonId: LessonId;
  onReset: () => Promise<void>;
  onRun: (scenario: ScenarioId) => Promise<void>;
  onSelectLesson: (lesson: LessonId) => void;
  pendingAction: string | null;
  run: ScenarioRunDto | null;
  status: string;
};

export function IntegrationLessons({
  activeLessonId,
  onReset,
  onRun,
  onSelectLesson,
  pendingAction,
  run,
  status,
}: IntegrationLessonsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeLesson: IntegrationLesson | undefined = INTEGRATION_LESSONS.find(
    ({ id }) => id === activeLessonId,
  );
  const sourceLesson = run
    ? INTEGRATION_LESSONS.find((lesson) =>
        lesson.scenarioIds.some((scenarioId) => scenarioId === run.scenario),
      )
    : undefined;

  if (!activeLesson) return null;

  function selectLessonAt(index: number) {
    const lesson = INTEGRATION_LESSONS[index];
    onSelectLesson(lesson.id);
    tabRefs.current[index]?.focus();
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % INTEGRATION_LESSONS.length;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex =
        (index - 1 + INTEGRATION_LESSONS.length) % INTEGRATION_LESSONS.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = INTEGRATION_LESSONS.length - 1;

    if (nextIndex === null) return;

    event.preventDefault();
    selectLessonAt(nextIndex);
  }

  return (
    <section className="integration-lessons" aria-label="Integration lessons">
      <div
        aria-label="Integration lessons"
        className="lesson-tabs"
        role="tablist"
      >
        {INTEGRATION_LESSONS.map((lesson, index) => {
          const selected = lesson.id === activeLesson.id;
          const tabId = `integration-lesson-tab-${lesson.id}`;
          const panelId = `integration-lesson-panel-${lesson.id}`;

          return (
            <button
              aria-controls={panelId}
              aria-selected={selected}
              data-lesson-id={lesson.id}
              id={tabId}
              key={lesson.id}
              onClick={() => onSelectLesson(lesson.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {lesson.tabLabel}
            </button>
          );
        })}
      </div>

      <div
        aria-labelledby={`integration-lesson-tab-${activeLesson.id}`}
        id={`integration-lesson-panel-${activeLesson.id}`}
        role="tabpanel"
      >
        <section data-lesson-section="challenge">
          <p className="eyebrow">Fictional provider lesson</p>
          <h2>{activeLesson.title}</h2>
          {activeLesson.kind === "overview" ? (
            <>
              <p>
                Northstar Presents uses three fictional ticket sources for one
                fictional concert.
              </p>
              <ol>
                {activeLesson.readingOrder.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </>
          ) : (
            <p>{activeLesson.challenge}</p>
          )}
        </section>

        <section data-lesson-section="diagram">
          <LessonDiagram
            diagram={activeLesson.diagram}
            lessonId={activeLesson.id}
          />
        </section>

        {activeLesson.kind === "challenge" && activeLesson.discussionGroups ? (
          <section data-lesson-section="discussion">
            <div className="lesson-discussion-grid">
              {activeLesson.discussionGroups.map((group) => (
                <section key={group.heading}>
                  <h3>{group.heading}</h3>
                  <ul>
                    {group.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        ) : null}

        {activeLesson.kind === "challenge" ? (
          <section data-lesson-section="approaches">
            <LessonApproachCards lesson={activeLesson} />
          </section>
        ) : null}

        {activeLesson.scenarioIds.length > 0 ? (
          <section data-lesson-section="actions">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Controlled practice</p>
                <h2>Scenario actions</h2>
              </div>
            </div>
            <div className="scenario-list">
              {activeLesson.scenarioIds.map((scenarioId) => {
                const scenario = SCENARIOS_BY_ID[scenarioId];

                return (
                  <article className="scenario" key={scenarioId}>
                    <div>
                      <h3>{scenario.title}</h3>
                      <p>{scenario.description}</p>
                    </div>
                    <button
                      data-scenario-id={scenarioId}
                      disabled={pendingAction !== null}
                      onClick={() => void onRun(scenarioId)}
                      type="button"
                    >
                      Run scenario
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {run && sourceLesson?.id === activeLesson.id ? (
          <section data-lesson-section="trace">
            <ScenarioTrace
              onReset={onReset}
              pendingAction={pendingAction}
              run={run}
              status={status}
            />
          </section>
        ) : null}

        {run && sourceLesson && sourceLesson.id !== activeLesson.id ? (
          <section data-lesson-section="trace">
            <button
              className="button-secondary"
              onClick={() => onSelectLesson(sourceLesson.id)}
              type="button"
            >
              View the current trace in {sourceLesson.tabLabel}
            </button>
          </section>
        ) : null}
      </div>
    </section>
  );
}
