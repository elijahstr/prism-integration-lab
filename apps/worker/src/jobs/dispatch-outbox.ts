import {
  claimOutbox,
  markOutboxDispatched,
} from "../../../../packages/database/src/ingestion";

export type MessageQueue = {
  add(
    name: string,
    data: { messageId: string },
    options: { jobId: string },
  ): Promise<unknown>;
};

export async function dispatchOutboxBatch(
  queue: MessageQueue,
  limit = 100,
): Promise<number> {
  const outboxRows = await claimOutbox(limit);

  for (const outboxRow of outboxRows) {
    await queue.add(
      "process-message",
      { messageId: outboxRow.messageId },
      { jobId: outboxRow.messageId },
    );
    await markOutboxDispatched(outboxRow.id);
  }

  return outboxRows.length;
}
