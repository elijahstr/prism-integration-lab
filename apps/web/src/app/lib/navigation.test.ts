import { describe, expect, test } from "bun:test";

import {
  dashboardHref,
  dashboardLocation,
  dashboardNavigation,
  switchOrganization,
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
    ).toEqual({ organizationSlug: "harborlight-live", runId: "run-123" });
  });

  test("uses the default organization and removes invalid query values", () => {
    expect(
      dashboardLocation(
        "?organization=unknown&run=",
        organizations,
        "northstar-presents",
      ),
    ).toEqual({ organizationSlug: "northstar-presents", runId: null });
  });

  test("serializes the selected organization and scenario run", () => {
    expect(
      dashboardHref("/providers", {
        organizationSlug: "harborlight-live",
        runId: "run-123",
      }),
    ).toBe("/providers?organization=harborlight-live&run=run-123");
  });

  test("propagates the URL state to every navigation destination", () => {
    expect(
      dashboardNavigation(["/", "/providers", "/events", "/integration-lab"], {
        organizationSlug: "northstar-presents",
        runId: "run-123",
      }),
    ).toEqual([
      "/?organization=northstar-presents&run=run-123",
      "/providers?organization=northstar-presents&run=run-123",
      "/events?organization=northstar-presents&run=run-123",
      "/integration-lab?organization=northstar-presents&run=run-123",
    ]);
  });

  test("clears the old run when the organization changes", () => {
    expect(
      switchOrganization(
        { organizationSlug: "northstar-presents", runId: "run-123" },
        "harborlight-live",
      ),
    ).toEqual({ organizationSlug: "harborlight-live", runId: null });
  });

  test("stores a completed scenario run in the URL state", () => {
    expect(
      withScenarioRun(
        { organizationSlug: "northstar-presents", runId: null },
        "run-123",
      ),
    ).toEqual({ organizationSlug: "northstar-presents", runId: "run-123" });
  });
});
