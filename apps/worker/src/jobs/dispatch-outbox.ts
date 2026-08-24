import {
  claimOutbox,
  markOutboxDispatched,
} from "../../../../packages/database/src/ingestion";

export type MessageQueue = {
  add(
    name: string,
    data: { messageId: string },
    options: {
      attempts: 5;
      backoff: { delay: 1000; type: "exponential" };
      jobId: string;
      removeOnFail: true;
    },
  ): Promise<unknown>;
};

export const processMessageJobOptions = {
  attempts: 5,
  backoff: { delay: 1000, type: "exponential" },
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
      { messageId: outboxRow.messageId },
      { jobId: outboxRow.messageId, ...processMessageJobOptions },
    );
    await markOutboxDispatched(outboxRow.id);
  }

  return outboxRows.length;
}
