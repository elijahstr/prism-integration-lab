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
  test("rejects an old Northstar action after Northstar returns and its new load resolves", async () => {
    const oldAction = deferred<void>();
    const newNorthstarLoad = deferred<{
      organization: string;
      run: string | null;
    }>();
    const coordinator = new DashboardLoadCoordinator<{
      organization: string;
      run: string | null;
    }>();
    const state = {
      data: "initial",
      error: null as string | null,
      focus: "initial",
      loading: "initial",
      run: "initial",
      url: "?organization=initial&run=initial",
    };
    const routeHandlers = {
      error: (error: Error) => {
        state.error = error.message;
      },
      loading: (organization: string) => {
        state.loading = `loading:${organization}`;
      },
      success: (result: { organization: string; run: string | null }) => {
        state.data = result.organization;
        state.loading = `loaded:${result.organization}`;
        state.run = result.run ?? "none";
        state.url = `?organization=${result.organization}&run=${result.run ?? "none"}`;
      },
    };

    await coordinator.start(
      "northstar-presents",
      async () => ({ organization: "northstar-old", run: "run-old" }),
      routeHandlers,
    );
    const actionGeneration = coordinator.beginAction("northstar-presents");
    expect(actionGeneration).not.toBeNull();
    coordinator.commitAction(actionGeneration!, () => {
      state.loading = "old-action";
    });

    const oldActionCompletion = oldAction.promise.then(async () => {
      coordinator.commitAction(actionGeneration!, () => {
        state.run = "run-stale-action";
        state.url = "?organization=northstar-presents&run=run-stale-action";
      });
      await coordinator.refresh(
        actionGeneration!,
        async () => ({
          organization: "northstar-stale-refresh",
          run: "run-stale-refresh",
        }),
        routeHandlers,
      );
      coordinator.commitAction(actionGeneration!, () => {
        state.error = "old action overwrote the error";
        state.focus = "old-action";
        state.loading = "old-action-finished";
      });
    });

    void coordinator.start(
      "harborlight-live",
      async () => ({ organization: "harborlight-live", run: "run-harbor" }),
      routeHandlers,
    );
    void coordinator.start(
      "northstar-presents",
      () => newNorthstarLoad.promise,
      routeHandlers,
    );
    newNorthstarLoad.resolve({
      organization: "northstar-new",
      run: "run-new",
    });
    await settle();
    state.focus = "new-northstar";

    oldAction.resolve();
    await oldActionCompletion;

    expect(state).toEqual({
      data: "northstar-new",
      error: null,
      focus: "new-northstar",
      loading: "loaded:northstar-new",
      run: "run-new",
      url: "?organization=northstar-new&run=run-new",
    });
  });

  test("rejects an old Northstar action failure after Northstar returns", async () => {
    const oldAction = deferred<void>();
    const newNorthstarLoad = deferred<{
      organization: string;
      run: string | null;
    }>();
    const coordinator = new DashboardLoadCoordinator<{
      organization: string;
      run: string | null;
    }>();
    const state = {
      data: "initial",
      error: null as string | null,
      focus: "initial",
      loading: "initial",
      run: "initial",
      url: "?organization=initial&run=initial",
    };
    const routeHandlers = {
      error: (error: Error) => {
        state.error = error.message;
      },
      loading: (organization: string) => {
        state.loading = `loading:${organization}`;
      },
      success: (result: { organization: string; run: string | null }) => {
        state.data = result.organization;
        state.loading = `loaded:${result.organization}`;
        state.run = result.run ?? "none";
        state.url = `?organization=${result.organization}&run=${result.run ?? "none"}`;
      },
    };

    await coordinator.start(
      "northstar-presents",
      async () => ({ organization: "northstar-old", run: "run-old" }),
      routeHandlers,
    );
    const actionGeneration = coordinator.beginAction("northstar-presents");
    expect(actionGeneration).not.toBeNull();
    coordinator.commitAction(actionGeneration!, () => {
      state.loading = "old-action";
    });

    const oldActionFailure = oldAction.promise.catch((reason: unknown) => {
      coordinator.commitAction(actionGeneration!, () => {
        state.error =
          reason instanceof Error ? reason.message : "Old action failed.";
        state.focus = "old-action-error";
        state.loading = "old-action-finished";
        state.run = "run-stale-error";
        state.url = "?organization=northstar-presents&run=run-stale-error";
      });
    });

    void coordinator.start(
      "harborlight-live",
      async () => ({ organization: "harborlight-live", run: "run-harbor" }),
      routeHandlers,
    );
    void coordinator.start(
      "northstar-presents",
      () => newNorthstarLoad.promise,
      routeHandlers,
    );
    newNorthstarLoad.resolve({
      organization: "northstar-new",
      run: "run-new",
    });
    await settle();
    state.focus = "new-northstar";

    oldAction.reject(new Error("Old Northstar action failed"));
    await oldActionFailure;

    expect(state).toEqual({
      data: "northstar-new",
      error: null,
      focus: "new-northstar",
      loading: "loaded:northstar-new",
      run: "run-new",
      url: "?organization=northstar-new&run=run-new",
    });
  });

  test("keeps Harborlight data when a Northstar refresh finishes after the organization load", async () => {
    const northstarRefresh = deferred<{
      organization: string;
      run: string | null;
    }>();
    const harborlightLoad = deferred<{
      organization: string;
      run: string | null;
    }>();
    const coordinator = new DashboardLoadCoordinator<{
      organization: string;
      run: string | null;
    }>();
    const state: { data: string | null; error: string | null } = {
      data: "northstar-presents",
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

    coordinator.start(
      "northstar-presents",
      async () => ({ organization: "northstar-presents", run: null }),
      handlers,
    );
    await settle();
    const actionGeneration = coordinator.beginAction("northstar-presents")!;
    coordinator.refresh(
      actionGeneration,
      () => northstarRefresh.promise,
      handlers,
    );
    coordinator.start(
      "harborlight-live",
      () => harborlightLoad.promise,
      handlers,
    );

    harborlightLoad.resolve({
      organization: "harborlight-live",
      run: "run-harbor",
    });
    await settle();
    northstarRefresh.resolve({
      organization: "northstar-presents",
      run: null,
    });
    await settle();

    expect(state).toEqual({ data: "harborlight-live", error: null });
  });

  test("does not show a stale Northstar refresh error after Harborlight loads", async () => {
    const northstarRefresh = deferred<{
      organization: string;
      run: string | null;
    }>();
    const harborlightLoad = deferred<{
      organization: string;
      run: string | null;
    }>();
    const coordinator = new DashboardLoadCoordinator<{
      organization: string;
      run: string | null;
    }>();
    const state: { data: string | null; error: string | null } = {
      data: "northstar-presents",
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

    coordinator.start(
      "northstar-presents",
      async () => ({ organization: "northstar-presents", run: null }),
      handlers,
    );
    await settle();
    const actionGeneration = coordinator.beginAction("northstar-presents")!;
    coordinator.refresh(
      actionGeneration,
      () => northstarRefresh.promise,
      handlers,
    );
    coordinator.start(
      "harborlight-live",
      () => harborlightLoad.promise,
      handlers,
    );

    harborlightLoad.resolve({
      organization: "harborlight-live",
      run: "run-harbor",
    });
    await settle();
    northstarRefresh.reject(new Error("Northstar refresh failed"));
    await settle();

    expect(state).toEqual({ data: "harborlight-live", error: null });
  });

  test("keeps a Harborlight load current when an old Northstar action requests a refresh", async () => {
    const harborlightLoad = deferred<{
      organization: string;
      run: string | null;
    }>();
    const coordinator = new DashboardLoadCoordinator<{
      organization: string;
      run: string | null;
    }>();
    const state: { data: string | null; error: string | null } = {
      data: "northstar-presents",
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

    coordinator.start(
      "northstar-presents",
      async () => ({ organization: "northstar-presents", run: null }),
      handlers,
    );
    await settle();
    const actionGeneration = coordinator.beginAction("northstar-presents")!;
    coordinator.start(
      "harborlight-live",
      () => harborlightLoad.promise,
      handlers,
    );
    coordinator.refresh(
      actionGeneration,
      async () => ({ organization: "northstar-presents", run: null }),
      handlers,
    );

    harborlightLoad.resolve({
      organization: "harborlight-live",
      run: "run-harbor",
    });
    await settle();

    expect(state).toEqual({ data: "harborlight-live", error: null });
  });

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
