import { Worker } from "bullmq";

import { sql } from "../../../packages/database/src/client";

import { dispatchOutboxBatch } from "./jobs/dispatch-outbox";
import { expireSessions } from "./jobs/expire-sessions";
import { processQueueJob } from "./jobs/process-message";
import { bullMqConnection, ingestionQueue } from "./queue";

type WorkerHandle = {
  close(): Promise<void>;
};

export type WorkerRuntimeDependencies = {
  closeDatabase(): Promise<void>;
  closeQueue(): Promise<void>;
  closeRedis(): Promise<void>;
  createWorker(): WorkerHandle;
  dispatch(): Promise<void>;
  expireSessions(): Promise<unknown>;
};

export type WorkerRuntime = {
  start(): void;
  stop(): Promise<void>;
};

export function createWorkerRuntime(
  dependencies: WorkerRuntimeDependencies,
): WorkerRuntime {
  let dispatchTimer: ReturnType<typeof setInterval> | undefined;
  let dispatcher: Promise<void> | undefined;
  let isStopping = false;
  let worker: WorkerHandle | undefined;

  async function dispatchPendingOutbox(): Promise<void> {
    if (isStopping || dispatcher) {
      return;
    }

    dispatcher = dependencies
      .expireSessions()
      .then(() => dependencies.dispatch())
      .catch((error: unknown) => {
        console.error("Outbox dispatch failed", error);
      })
      .finally(() => {
        dispatcher = undefined;
      });
    await dispatcher;
  }

  return {
    start() {
      if (worker) {
        return;
      }

      isStopping = false;
      worker = dependencies.createWorker();
      dispatchTimer = setInterval(() => {
        void dispatchPendingOutbox();
      }, 1_000);
      void dispatchPendingOutbox();
    },
    async stop() {
      if (isStopping) {
        return;
      }

      isStopping = true;
      if (dispatchTimer) {
        clearInterval(dispatchTimer);
        dispatchTimer = undefined;
      }
      await worker?.close();
      worker = undefined;
      await dispatcher;
      await dependencies.closeQueue();
      await dependencies.closeRedis();
      await dependencies.closeDatabase();
    },
  };
}

const runtime = createWorkerRuntime({
  closeDatabase: () => sql.end(),
  closeQueue: () => ingestionQueue.close(),
  closeRedis: async () => {
    await bullMqConnection.quit();
  },
  createWorker: () =>
    new Worker("ingestion", (job) => processQueueJob(job), {
      connection: bullMqConnection,
    }),
  dispatch: async () => {
    await dispatchOutboxBatch(ingestionQueue);
  },
  expireSessions,
});

export function startWorker(): void {
  runtime.start();
}

export function stopWorker(): Promise<void> {
  return runtime.stop();
}

process.once("SIGTERM", () => {
  void stopWorker().finally(() => process.exit(0));
});
