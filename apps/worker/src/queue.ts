import IORedis from "ioredis";

export function createBullMqConnection(
  redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379",
) {
  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
}
