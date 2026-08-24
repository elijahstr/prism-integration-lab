import { beforeAll, describe, expect, test } from "bun:test";
import { createHash, createHmac } from "node:crypto";

import type { ProviderEnvelope } from "@prism/contracts";

import { migrate } from "../../../../packages/database/scripts/migrate";
import { seed } from "../../../../packages/database/scripts/seed";
import {
  deriveWebhookSecret,
  sql,
} from "../../../../packages/database/src/client";
import { buildServer } from "../server";

process.env.PROVIDER_KEY_MASTER_SECRET = "test-provider-master-secret";
process.env.LAB_TOKEN_PEPPER = "test-lab-token-pepper";

const northstar = {
  organizationId: "organization-northstar",
  scopeId: "scope-northstar-baseline",
};

function envelopeFor(deliveryId: string): ProviderEnvelope {
  const payload = {
    effects: [{ amountDeltaCents: 5000, kind: "sale", ticketDelta: 2 }],
  };

  return {
    checksum: `sha256:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`,
    connectionId: "connection-northstar-encoretix",
    deliveryId,
    externalEventId: "event-fictional-summer-hall",
    kind: "sale_delta",
    organizationId: northstar.organizationId,
    payload,
    provider: "encoretix",
    receivedAt: new Date().toISOString(),
    scopeId: northstar.scopeId,
    sourceOccurredAt: new Date().toISOString(),
    sourceVersion: new Date().toISOString(),
  };
}

async function sendWebhook(
  server: ReturnType<typeof buildServer>,
  envelope: ProviderEnvelope,
  options: { raw?: Uint8Array; signature?: string } = {},
) {
  const raw = options.raw ?? new TextEncoder().encode(JSON.stringify(envelope));
  const signature =
    options.signature ??
    createHmac("sha256", deriveWebhookSecret(envelope.connectionId))
      .update(raw)
      .digest("hex");

  return server.inject({
    method: "POST",
    url: "/webhooks/encoretix",
    headers: {
      "content-type": "application/json",
      "x-encoretix-key-id": "whk_northstar_encoretix",
      "x-encoretix-signature": signature,
    },
    payload: Buffer.from(raw),
  });
}

beforeAll(async () => {
  await migrate();
  await seed();
});

describe("EncoreTix webhooks", () => {
  test("accepts a valid raw signed delivery", async () => {
    const server = buildServer();
    const deliveryId = `webhook-valid-${crypto.randomUUID()}`;
    const envelope = envelopeFor(deliveryId);
    const raw = new TextEncoder().encode(JSON.stringify(envelope));
    const response = await sendWebhook(server, envelope, { raw });

    expect(response.statusCode).toBe(202);
    await server.close();
  });

  test("rejects one raw byte changed after signing", async () => {
    const server = buildServer();
    const envelope = envelopeFor(`webhook-tampered-${crypto.randomUUID()}`);
    const raw = new TextEncoder().encode(JSON.stringify(envelope));
    const tampered = Uint8Array.from(raw);
    tampered[tampered.length - 2] =
      tampered[tampered.length - 2] === 49 ? 50 : 49;
    const response = await sendWebhook(server, envelope, {
      raw: tampered,
      signature: createHmac(
        "sha256",
        deriveWebhookSecret(envelope.connectionId),
      )
        .update(raw)
        .digest("hex"),
    });

    expect(response.statusCode).toBe(401);
    expect(
      Array.from(
        await sql`SELECT id FROM ingestion_messages WHERE delivery_id = ${envelope.deliveryId}`,
      ),
    ).toEqual([]);
    await server.close();
  });

  test("rejects a stale signed source timestamp", async () => {
    const server = buildServer();
    const envelope = {
      ...envelopeFor(`webhook-stale-${crypto.randomUUID()}`),
      sourceOccurredAt: "2020-01-01T00:00:00.000Z",
    };
    const response = await sendWebhook(server, envelope);

    expect(response.statusCode).toBe(401);
    await server.close();
  });

  test("acknowledges a valid duplicate without a second durable message", async () => {
    const server = buildServer();
    const envelope = envelopeFor(`webhook-duplicate-${crypto.randomUUID()}`);

    expect((await sendWebhook(server, envelope)).statusCode).toBe(202);
    expect((await sendWebhook(server, envelope)).statusCode).toBe(200);
    expect(
      Array.from(
        await sql<{ count: string }[]>`
          SELECT count(*)::text AS count
          FROM ingestion_messages
          WHERE delivery_id = ${envelope.deliveryId}
        `,
      ),
    ).toEqual([{ count: "1" }]);
    await server.close();
  });

  test("puts a reused delivery identifier with a new checksum into review", async () => {
    const server = buildServer();
    const deliveryId = `webhook-checksum-conflict-${crypto.randomUUID()}`;
    const first = envelopeFor(deliveryId);
    const secondPayload = {
      effects: [{ amountDeltaCents: 7500, kind: "sale", ticketDelta: 3 }],
    };
    const second = {
      ...first,
      checksum: `sha256:${createHash("sha256").update(JSON.stringify(secondPayload)).digest("hex")}`,
      payload: secondPayload,
    };

    expect((await sendWebhook(server, first)).statusCode).toBe(202);
    expect((await sendWebhook(server, second)).statusCode).toBe(200);
    expect(
      Array.from(
        await sql<{ state: string }[]>`
          SELECT state
          FROM ingestion_messages
          WHERE delivery_id = ${deliveryId}
        `,
      ),
    ).toEqual([{ state: "needs_review" }]);
    expect(
      Array.from(
        await sql<
          { action: string; firstChecksum: string; repeatedChecksum: string }[]
        >`
          SELECT
            action,
            details->>'firstChecksum' AS "firstChecksum",
            details->>'repeatedChecksum' AS "repeatedChecksum"
          FROM audit_entries
          WHERE message_id = (
            SELECT id FROM ingestion_messages WHERE delivery_id = ${deliveryId}
          )
          ORDER BY created_at DESC
          LIMIT 1
        `,
      ),
    ).toEqual([
      {
        action: "checksum_conflict",
        firstChecksum: first.checksum,
        repeatedChecksum: second.checksum,
      },
    ]);
    await server.close();
  });

  test("rejects an envelope that claims another connection scope without a write", async () => {
    const server = buildServer();
    const envelope = {
      ...envelopeFor(`webhook-scope-mismatch-${crypto.randomUUID()}`),
      organizationId: "organization-harborlight",
      scopeId: "scope-harborlight-baseline",
    };
    const response = await sendWebhook(server, envelope);

    expect(response.statusCode).toBe(403);
    expect(
      Array.from(
        await sql`SELECT id FROM ingestion_messages WHERE delivery_id = ${envelope.deliveryId}`,
      ),
    ).toEqual([]);
    await server.close();
  });
});
