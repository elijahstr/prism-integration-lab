import { describe, expect, test } from "bun:test";
import { ScenarioIdSchema } from "@prism/contracts";

import {
  API_MAPPING_REQUIRED_TERMS,
  INTEGRATION_LESSONS,
  LESSON_IDS,
  getLessonContractErrors,
} from "./integration-lessons";

test("keeps the seven lesson tabs in the approved order", () => {
  expect(LESSON_IDS).toEqual([
    "overview",
    "api-mapping",
    "webhooks",
    "polling-snapshots",
    "ordering-conflicts",
    "money-refunds",
    "reconciliation-recovery",
  ]);
});

test("maps every existing scenario once", () => {
  const mapped = INTEGRATION_LESSONS.flatMap((lesson) => lesson.scenarioIds);

  expect([...mapped].sort()).toEqual([...ScenarioIdSchema.options].sort());
  expect(new Set(mapped).size).toBe(mapped.length);
});

test("maps the incomplete snapshot to polling and snapshots", () => {
  const pollingLesson = INTEGRATION_LESSONS.find(
    ({ id }) => id === "polling-snapshots",
  )!;
  const recoveryLesson = INTEGRATION_LESSONS.find(
    ({ id }) => id === "reconciliation-recovery",
  )!;

  expect(pollingLesson.scenarioIds).toContain("incomplete_snapshot");
  expect(recoveryLesson.scenarioIds).not.toContain("incomplete_snapshot");
});

test("keeps each challenge comparison complete", () => {
  expect(getLessonContractErrors(INTEGRATION_LESSONS)).toEqual([]);
});

test("keeps every challenge approach complete", () => {
  for (const lesson of INTEGRATION_LESSONS) {
    if (lesson.kind !== "challenge") continue;

    expect(lesson.approaches.length).toBeGreaterThanOrEqual(2);
    expect(lesson.approaches.length).toBeLessThanOrEqual(3);
    expect(
      lesson.approaches.filter(({ recommended }) => recommended),
    ).toHaveLength(1);
    expect(lesson.cost).not.toBe("");
    expect(lesson.debtPath).not.toBe("");
    expect(lesson.failurePrevented).not.toBe("");

    for (const approach of lesson.approaches) {
      expect(approach.pros).toHaveLength(2);
      expect(approach.cons).toHaveLength(2);
    }
  }
});

test("keeps every required API-mapping term visible", () => {
  const lesson = INTEGRATION_LESSONS.find(({ id }) => id === "api-mapping")!;

  expect(lesson.searchText).toEqual(expect.stringContaining("canonical model"));
  for (const term of API_MAPPING_REQUIRED_TERMS) {
    expect(lesson.searchText.toLowerCase()).toContain(term);
  }
});
