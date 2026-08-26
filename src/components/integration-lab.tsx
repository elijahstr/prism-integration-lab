"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { ArchitectureDiagram } from "./architecture-diagrams";
import {
  isLessonId,
  LESSONS,
  type Lesson,
  type LessonId,
} from "../lib/lessons";

function Approaches({ lesson }: { lesson: Lesson }) {
  if (!lesson.approaches) return null;

  return (
    <section className="approaches" aria-labelledby="approaches-title">
      <div className="section-heading">
        <p>Architecture choices</p>
        <h2 id="approaches-title">Three ways to handle it</h2>
      </div>
      <div className="approach-grid">
        {lesson.approaches.map((approach) => (
          <div className="approach-wrap" key={approach.name}>
            {approach.recommended ? (
              <p className="recommended-label">Recommended</p>
            ) : (
              <div className="label-spacer" aria-hidden="true" />
            )}
            <article
              className={
                approach.recommended ? "approach recommended" : "approach"
              }
            >
              <h3>{approach.name}</h3>
              <p className="fit">{approach.fit}</p>
              <div className="pros-cons">
                <div>
                  <h4>Pros</h4>
                  <ul>
                    {approach.pros.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Cons</h4>
                  <ul>
                    {approach.cons.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="debt">
                <strong>Technical debt</strong>
                <span>{approach.debt}</span>
              </div>
            </article>
          </div>
        ))}
      </div>
    </section>
  );
}

function Example({ lesson }: { lesson: Lesson }) {
  if (!lesson.example) return null;

  return (
    <section className="example" aria-labelledby="example-title">
      <div>
        <p className="section-kicker">Browser-only example</p>
        <h2 id="example-title">{lesson.example.title}</h2>
        <p>{lesson.example.setup}</p>
      </div>
      <ol className="trace">
        {lesson.example.steps.map((item, index) => (
          <li key={item}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <p>{item}</p>
          </li>
        ))}
        <li className="result">
          <span>✓</span>
          <p>{lesson.example.result}</p>
        </li>
      </ol>
    </section>
  );
}

export function IntegrationLab() {
  const [activeId, setActiveId] = useState<LessonId>("overview");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = LESSONS.findIndex((lesson) => lesson.id === activeId);
  const lesson = LESSONS[activeIndex] ?? LESSONS[0];

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("lesson");
    if (isLessonId(requested)) setActiveId(requested);
  }, []);

  function selectLesson(id: LessonId, focus = false) {
    setActiveId(id);
    const url = new URL(window.location.href);
    if (id === "overview") url.searchParams.delete("lesson");
    else url.searchParams.set("lesson", id);
    window.history.replaceState({}, "", url);
    if (focus) {
      const index = LESSONS.findIndex((item) => item.id === id);
      tabRefs.current[index]?.focus();
    }
  }

  function handleTabKey(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      next = (index + 1) % LESSONS.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = (index - 1 + LESSONS.length) % LESSONS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = LESSONS.length - 1;
    else return;
    event.preventDefault();
    selectLesson(LESSONS[next].id, true);
  }

  return (
    <main>
      <header className="masthead">
        <div className="brand" aria-label="Prism Integration Lab">
          <span className="prism-mark">PRISM</span>
          <span>INTEGRATION LAB</span>
        </div>
        <p className="prototype-label">UNOFFICIAL PORTFOLIO PROTOTYPE</p>
      </header>

      <nav className="tabs" aria-label="Integration topics" role="tablist">
        {LESSONS.map((item, index) => (
          <button
            aria-controls={`panel-${item.id}`}
            aria-selected={item.id === lesson.id}
            id={`tab-${item.id}`}
            key={item.id}
            onClick={() => selectLesson(item.id)}
            onKeyDown={(event) => handleTabKey(event, index)}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            role="tab"
            tabIndex={item.id === lesson.id ? 0 : -1}
            type="button"
          >
            {item.tab}
          </button>
        ))}
      </nav>

      <article
        aria-labelledby={`tab-${lesson.id}`}
        className="lesson-panel"
        id={`panel-${lesson.id}`}
        key={lesson.id}
        role="tabpanel"
      >
        <section className="lesson-intro">
          <p className="eyebrow">{lesson.eyebrow}</p>
          <h1>{lesson.title}</h1>
          <p className="lead">{lesson.intro}</p>
          <p className="context">{lesson.context}</p>
        </section>

        {lesson.id === "overview" ? (
          <figure className="venue-image">
            <img
              alt="Come and Take It Live venue logo on a dark wood background"
              height="1000"
              src="/come-and-take-it-live.webp"
              width="1500"
            />
            <figcaption>Come and Take It Live · Austin, Texas</figcaption>
          </figure>
        ) : null}

        {lesson.id !== "overview" && lesson.diagramCaption ? (
          <ArchitectureDiagram
            caption={lesson.diagramCaption}
            lessonId={lesson.id}
          />
        ) : null}
        <Approaches lesson={lesson} />
        <Example lesson={lesson} />
      </article>

      <footer>
        <p>Static architecture explainer · No live customer or provider data</p>
        <div>
          {activeIndex > 0 ? (
            <button
              className="text-button"
              onClick={() => selectLesson(LESSONS[activeIndex - 1].id)}
              type="button"
            >
              ← {LESSONS[activeIndex - 1].tab}
            </button>
          ) : null}
          {activeIndex < LESSONS.length - 1 ? (
            <button
              className="text-button"
              onClick={() => selectLesson(LESSONS[activeIndex + 1].id)}
              type="button"
            >
              {LESSONS[activeIndex + 1].tab} →
            </button>
          ) : null}
        </div>
      </footer>
    </main>
  );
}
