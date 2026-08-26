import { describe, expect, test } from "bun:test";

import {
  dashboardHref,
  dashboardLocation,
  dashboardNavigation,
  switchOrganization,
  withLesson,
  withScenarioRun,
} from "./navigation";

const organizations = ["northstar-presents", "harborlight-live"];

describe("dashboard URL state", () => {
  test("parses a valid organization and scenario run from the URL", () => {
    expect(
      dashboardLocation(
        "?organization=harborlight-live&run=run-123",
        organizations,
        "northstar-presents",
      ),
    ).toEqual({
      lesson: "overview",
      organizationSlug: "harborlight-live",
      runId: "run-123",
    });
  });

  test("uses the default organization and removes invalid query values", () => {
    expect(
      dashboardLocation(
        "?organization=unknown&run=",
        organizations,
        "northstar-presents",
      ),
    ).toEqual({
      lesson: "overview",
      organizationSlug: "northstar-presents",
      runId: null,
    });
  });

  test("parses a lesson with organization and run", () => {
    expect(
      dashboardLocation(
        "?organization=harborlight-live&run=run-123&lesson=webhooks",
        organizations,
        "northstar-presents",
      ),
    ).toEqual({
      lesson: "webhooks",
      organizationSlug: "harborlight-live",
      runId: "run-123",
    });
  });

  test("uses Overview for an invalid lesson without losing the run", () => {
    expect(
      dashboardLocation(
        "?organization=northstar-presents&run=run-123&lesson=unknown",
        organizations,
        "northstar-presents",
      ),
    ).toMatchObject({ lesson: "overview", runId: "run-123" });
  });

  test("serializes the selected organization and scenario run", () => {
    expect(
      dashboardHref("/providers", {
        lesson: "webhooks",
        organizationSlug: "harborlight-live",
        runId: "run-123",
      }),
    ).toBe(
      "/providers?organization=harborlight-live&run=run-123&lesson=webhooks",
    );
  });

  test("propagates the URL state to every navigation destination", () => {
    expect(
      dashboardNavigation(["/", "/providers", "/events", "/integration-lab"], {
        lesson: "webhooks",
        organizationSlug: "northstar-presents",
        runId: "run-123",
      }),
    ).toEqual([
      "/?organization=northstar-presents&run=run-123&lesson=webhooks",
      "/providers?organization=northstar-presents&run=run-123&lesson=webhooks",
      "/events?organization=northstar-presents&run=run-123&lesson=webhooks",
      "/integration-lab?organization=northstar-presents&run=run-123&lesson=webhooks",
    ]);
  });

  test("clears the old run when the organization changes", () => {
    expect(
      switchOrganization(
        {
          lesson: "webhooks",
          organizationSlug: "northstar-presents",
          runId: "run-123",
        },
        "harborlight-live",
      ),
    ).toEqual({
      lesson: "webhooks",
      organizationSlug: "harborlight-live",
      runId: null,
    });
  });

  test("stores a completed scenario run in the URL state", () => {
    expect(
      withScenarioRun(
        {
          lesson: "webhooks",
          organizationSlug: "northstar-presents",
          runId: null,
        },
        "run-123",
      ),
    ).toEqual({
      lesson: "webhooks",
      organizationSlug: "northstar-presents",
      runId: "run-123",
    });
  });

  test("changes the selected lesson without changing the organization or run", () => {
    expect(
      withLesson(
        {
          lesson: "webhooks",
          organizationSlug: "northstar-presents",
          runId: "run-123",
        },
        "money-refunds",
      ),
    ).toEqual({
      lesson: "money-refunds",
      organizationSlug: "northstar-presents",
      runId: "run-123",
    });
  });
});
