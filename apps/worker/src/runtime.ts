import { Worker } from "bullmq";

import { sql } from "../../../packages/database/src/client";

import { dispatchOutboxBatch } from "./jobs/dispatch-outbox";
import { processMessage } from "./jobs/process-message";
import { bullMqConnection, ingestionQueue } from "./queue";

let dispatchTimer: ReturnType<typeof setInterval> | undefined;
let dispatcher: Promise<void> | undefined;
let isStopping = false;
let worker: Worker<{ messageId: string }> | undefined;

async function dispatchPendingOutbox(): Promise<void> {
  if (isStopping || dispatcher) {
    return;
  }

  dispatcher = dispatchOutboxBatch(ingestionQueue)
    .then(() => undefined)
    .catch((error: unknown) => {
      console.error("Outbox dispatch failed", error);
    })
    .finally(() => {
      dispatcher = undefined;
    });
  await dispatcher;
}

export function startWorker(): void {
  if (worker) {
    return;
  }

  isStopping = false;
  worker = new Worker(
    "ingestion",
    async (job) => processMessage(job.data.messageId),
    { connection: bullMqConnection },
  );
  dispatchTimer = setInterval(() => {
    void dispatchPendingOutbox();
  }, 1_000);
  void dispatchPendingOutbox();
}

export async function stopWorker(): Promise<void> {
  if (isStopping) {
    return;
  }

  isStopping = true;
  if (dispatchTimer) {
    clearInterval(dispatchTimer);
    dispatchTimer = undefined;
  }
  await dispatcher;
  await worker?.close();
  worker = undefined;
  await ingestionQueue.close();
  await bullMqConnection.quit();
  await sql.end();
}

process.once("SIGTERM", () => {
  void stopWorker().finally(() => process.exit(0));
});
