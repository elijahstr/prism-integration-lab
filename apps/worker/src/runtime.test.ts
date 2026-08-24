import { describe, expect, test } from "bun:test";

import { createWorkerRuntime } from "./runtime";

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe("worker shutdown", () => {
  test("closes the worker before it waits for the active dispatcher", async () => {
    const events: string[] = [];
    const activeDispatch = deferred();
    const runtime = createWorkerRuntime({
      closeDatabase: async () => {
        events.push("database.close");
      },
      closeQueue: async () => {
        events.push("queue.close");
      },
      closeRedis: async () => {
        events.push("redis.close");
      },
      createWorker: () => ({
        close: async () => {
          events.push("worker.close");
        },
      }),
      dispatch: async () => {
        events.push("dispatch.start");
        await activeDispatch.promise;
        events.push("dispatch.finish");
      },
    });

    runtime.start();
    const stopping = runtime.stop();

    expect(events).toEqual(["dispatch.start", "worker.close"]);

    activeDispatch.resolve();
    await stopping;

    expect(events).toEqual([
      "dispatch.start",
      "worker.close",
      "dispatch.finish",
      "queue.close",
      "redis.close",
      "database.close",
    ]);
  });
});
