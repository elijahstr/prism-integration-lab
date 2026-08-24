import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "../src/client";

const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

export async function migrate(): Promise<string[]> {
  return sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(487_202_608_24)`;

    const migrationTable = await transaction<{ exists: boolean }[]>`
      SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists
    `;

    if (!migrationTable[0]!.exists) {
      await transaction`
        CREATE TABLE schema_migrations (
          filename text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `;
    }

    const filenames = (await readdir(migrationsDirectory))
      .filter((filename) => filename.endsWith(".sql"))
      .sort();
    const appliedRows = await transaction<{ filename: string }[]>`
      SELECT filename FROM schema_migrations
    `;
    const applied = new Set(appliedRows.map((row) => row.filename));
    const pending = filenames.filter((filename) => !applied.has(filename));

    for (const filename of pending) {
      const migration = await readFile(
        join(migrationsDirectory, filename),
        "utf8",
      );

      await transaction.unsafe(migration);
      await transaction`
        INSERT INTO schema_migrations (filename)
        VALUES (${filename})
      `;
    }

    return pending;
  });
}

if (import.meta.main) {
  const applied = await migrate();
  console.log(`Applied ${applied.length} database migration(s).`);
  await sql.end();
}
