import { createHmac } from "node:crypto";

import postgres from "postgres";

export type { TransactionSql } from "postgres";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://prism:prism@localhost:5432/prism_integration_lab";

export const sql = postgres(databaseUrl, { max: 10 });

export function deriveWebhookSecret(connectionId: string): string {
  const masterSecret = process.env.PROVIDER_KEY_MASTER_SECRET;

  if (!masterSecret) {
    throw new Error("PROVIDER_KEY_MASTER_SECRET is required");
  }

  return createHmac("sha256", masterSecret).update(connectionId).digest("hex");
}
