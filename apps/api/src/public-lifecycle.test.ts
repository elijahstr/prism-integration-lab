import { expect, test } from "bun:test";
import Fastify from "fastify";

import { createPublicLifecycle } from "./public-lifecycle";

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
  const firstShutdown = lifecycle.shutdown();
  const secondShutdown = lifecycle.shutdown();

  expect(secondShutdown).toBe(firstShutdown);
  await Bun.sleep(10);
  expect(events).toEqual(["request.started", "http.close.started"]);

  requestMayFinish.resolve();
  expect((await activeRequest).status).toBe(200);
  await firstShutdown;

  expect(events).toEqual([
    "request.started",
    "http.close.started",
    "request.finished",
    "http.close.finished",
    "worker.stopped",
  ]);
});
