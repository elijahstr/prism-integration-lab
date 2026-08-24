import { describe, expect, test } from "bun:test";

import { loadDashboardSession } from "./dashboard-session";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("dashboard session restore", () => {
  test("reuses the selected organization token and restores its scenario trace", async () => {
    const storage = memoryStorage({
      "prism.integration-lab.session.v1.harborlight-live": "harbor-token",
      "prism.integration-lab.session.v1.northstar-presents": "northstar-token",
    });
    let created = 0;
    const requestedRuns: Array<{ runId: string; token: string }> = [];

    await expect(
      loadDashboardSession({
        createToken: async () => {
          created += 1;
          return "new-token";
        },
        loadDashboard: async (token) => ({ token }),
        loadRun: async (token, runId) => {
          requestedRuns.push({ runId, token });
          return { id: runId };
        },
        organizationSlug: "harborlight-live",
        runId: "run-123",
        storage,
      }),
    ).resolves.toEqual({
      dashboard: { token: "harbor-token" },
      run: { id: "run-123" },
    });

    expect(created).toBe(0);
    expect(requestedRuns).toEqual([
      { runId: "run-123", token: "harbor-token" },
    ]);
  });
});
