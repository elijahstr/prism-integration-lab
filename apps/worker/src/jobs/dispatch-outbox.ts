import { claimOutbox, markOutboxDispatched } from "@prism/database/ingestion";

export type MessageQueue = {
  add(
    name: string,
    data: { messageId: string; organizationId: string; scopeId: string },
    options: {
      attempts: 5;
      backoff: { delay: 1000; type: "exponential" };
      jobId: string;
      removeOnComplete: { age: 3600; count: 1000 };
      removeOnFail: true;
    },
  ): Promise<unknown>;
};

export const processMessageJobOptions = {
  attempts: 5,
  backoff: { delay: 1000, type: "exponential" },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: true,
} as const;

export async function dispatchOutboxBatch(
  queue: MessageQueue,
  limit = 100,
): Promise<number> {
  const outboxRows = await claimOutbox(limit);

  for (const outboxRow of outboxRows) {
    await queue.add(
      "process-message",
      {
        messageId: outboxRow.messageId,
        organizationId: outboxRow.organizationId,
        scopeId: outboxRow.scopeId,
      },
      {
        jobId: `${outboxRow.messageId}-${outboxRow.dispatchAttempts}`,
        ...processMessageJobOptions,
      },
    );
    await markOutboxDispatched(outboxRow.id);
  }

  return outboxRows.length;
}
