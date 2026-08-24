import { describe, expect, test } from "bun:test";

import { DashboardLoadCoordinator } from "./dashboard-load";

function deferred<T>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("dashboard load coordination", () => {
  test("keeps Harborlight data when a slow Northstar load finishes last", async () => {
    const northstar = deferred<{ organization: string; run: string | null }>();
    const harborlight = deferred<{
      organization: string;
      run: string | null;
    }>();
    const coordinator = new DashboardLoadCoordinator<{
      organization: string;
      run: string | null;
    }>();
    const state: {
      data: string | null;
      error: string | null;
      loading: string | null;
      run: string | null;
    } = { data: null, error: null, loading: null, run: null };

    coordinator.start("northstar-presents", () => northstar.promise, {
      error: (error) => {
        state.error = error.message;
      },
      loading: (organization) => {
        state.loading = organization;
      },
      success: (result) => {
        state.data = result.organization;
        state.run = result.run;
      },
    });
    coordinator.start("harborlight-live", () => harborlight.promise, {
      error: (error) => {
        state.error = error.message;
      },
      loading: (organization) => {
        state.loading = organization;
      },
      success: (result) => {
        state.data = result.organization;
        state.run = result.run;
      },
    });

    harborlight.resolve({
      organization: "harborlight-live",
      run: "run-harbor",
    });
    await settle();
    northstar.resolve({ organization: "northstar-presents", run: "run-north" });
    await settle();

    expect(state).toEqual({
      data: "harborlight-live",
      error: null,
      loading: "harborlight-live",
      run: "run-harbor",
    });
  });

  test("does not replace Harborlight success with a stale Northstar failure", async () => {
    const northstar = deferred<{ organization: string; run: string | null }>();
    const harborlight = deferred<{
      organization: string;
      run: string | null;
    }>();
    const coordinator = new DashboardLoadCoordinator<{
      organization: string;
      run: string | null;
    }>();
    const state: { data: string | null; error: string | null } = {
      data: null,
      error: null,
    };
    const handlers = {
      error: (error: Error) => {
        state.error = error.message;
      },
      loading: () => undefined,
      success: (result: { organization: string; run: string | null }) => {
        state.data = result.organization;
      },
    };

    coordinator.start("northstar-presents", () => northstar.promise, handlers);
    coordinator.start("harborlight-live", () => harborlight.promise, handlers);

    harborlight.resolve({ organization: "harborlight-live", run: null });
    await settle();
    northstar.reject(new Error("Northstar failed"));
    await settle();

    expect(state).toEqual({ data: "harborlight-live", error: null });
  });
});
