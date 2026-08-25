import { expect, test } from "bun:test";
import Fastify from "fastify";

import {
  createPublicLifecycle,
  installPublicSignalHandlers,
} from "./public-lifecycle";

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

test("drains an active HTTP request before it stops the embedded worker", async () => {
  const events: string[] = [];
  const requestStarted = deferred();
  const requestMayFinish = deferred();
  const server = Fastify();
  server.get("/slow", async () => {
    events.push("request.started");
    requestStarted.resolve();
    await requestMayFinish.promise;
    events.push("request.finished");
    return { status: "ok" };
  });
  await server.listen({ host: "127.0.0.1", port: 0 });
  const address = server.server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected a local HTTP address");
  }

  const activeRequest = fetch(`http://127.0.0.1:${address.port}/slow`);
  await requestStarted.promise;
  const lifecycle = createPublicLifecycle({
    closeHttp: async () => {
      events.push("http.close.started");
      await server.close();
      events.push("http.close.finished");
    },
    stopWorker: async () => {
      events.push("worker.stopped");
    },
  });
  const handlers: Record<"SIGINT" | "SIGTERM", Array<() => void>> = {
    SIGINT: [],
    SIGTERM: [],
  };
  const signalProcess = {
    on(signal: "SIGINT" | "SIGTERM", listener: () => void) {
      handlers[signal].push(listener);
    },
    off(signal: "SIGINT" | "SIGTERM", listener: () => void) {
      handlers[signal] = handlers[signal].filter(
        (candidate) => candidate !== listener,
      );
    },
  };

  installPublicSignalHandlers(lifecycle, signalProcess);
  handlers.SIGTERM[0]!();
  handlers.SIGTERM[0]!();

  await Bun.sleep(10);
  expect(events).toEqual(["request.started", "http.close.started"]);
  expect(handlers.SIGTERM).toHaveLength(1);

  requestMayFinish.resolve();
  expect((await activeRequest).status).toBe(200);
  while (events.length < 5) {
    await Bun.sleep(1);
  }

  expect(events).toEqual([
    "request.started",
    "http.close.started",
    "request.finished",
    "http.close.finished",
    "worker.stopped",
  ]);
  expect(handlers.SIGTERM).toHaveLength(0);
  expect(handlers.SIGINT).toHaveLength(0);
});
