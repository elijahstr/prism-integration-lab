import { beforeAll, describe, expect, test } from "bun:test";

import { migrate } from "../../../../packages/database/scripts/migrate";
import { seed } from "../../../../packages/database/scripts/seed";
import { sql } from "../../../../packages/database/src/client";
import { pollVenueWave } from "./poll-venuewave";

const connectionId = "connection-northstar-venuewave";

beforeAll(async () => {
  await migrate();
  await seed();
});

describe("VenueWave polling", () => {
  test("commits a durable page and its next cursor together", async () => {
    await sql`UPDATE provider_connections SET poll_cursor = NULL WHERE id = ${connectionId}`;
    const deliveryId = `venuewave-page-${crypto.randomUUID()}`;
    const result = await pollVenueWave({
      client: {
        getPage: () => ({
          cursor: null,
          effects: [{ amountDeltaCents: 7500, kind: "sale", ticketDelta: 3 }],
          nextCursor: "cursor-43",
        }),
      },
      connectionId,
      deliveryId,
      externalEventId: "event-fictional-summer-hall",
    });

    expect(result).toEqual({ status: "saved", nextCursor: "cursor-43" });
    expect(
      Array.from(
        await sql<{ cursor: string | null; messages: string }[]>`
          SELECT
            provider_connections.poll_cursor AS cursor,
            count(ingestion_messages.id)::text AS messages
          FROM provider_connections
          LEFT JOIN ingestion_messages
            ON ingestion_messages.connection_id = provider_connections.id
            AND ingestion_messages.delivery_id = ${deliveryId}
          WHERE provider_connections.id = ${connectionId}
          GROUP BY provider_connections.poll_cursor
        `,
      ),
    ).toEqual([{ cursor: "cursor-43", messages: "1" }]);
  });

  test("keeps the old cursor when a page fails validation", async () => {
    await sql`UPDATE provider_connections SET poll_cursor = 'cursor-safe' WHERE id = ${connectionId}`;

    await expect(
      pollVenueWave({
        client: {
          getPage: () => ({
            cursor: "cursor-safe",
            effects: [{ amountDeltaCents: 1.5, kind: "sale", ticketDelta: 1 }],
            nextCursor: "cursor-lost",
          }),
        },
        connectionId,
        deliveryId: `venuewave-invalid-${crypto.randomUUID()}`,
        externalEventId: "event-fictional-summer-hall",
      }),
    ).rejects.toThrow();

    expect(
      Array.from(
        await sql<{ pollCursor: string }[]>`
          SELECT poll_cursor AS "pollCursor"
          FROM provider_connections
          WHERE id = ${connectionId}
        `,
      ),
    ).toEqual([{ pollCursor: "cursor-safe" }]);
  });
});
