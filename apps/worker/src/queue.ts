import { Queue } from "bullmq";
import IORedis from "ioredis";

export const bullMqConnection = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  { maxRetriesPerRequest: null },
);

export const ingestionQueue = new Queue("ingestion", {
  connection: bullMqConnection,
});

export function getBullMqConnection() {
  return bullMqConnection;
}
