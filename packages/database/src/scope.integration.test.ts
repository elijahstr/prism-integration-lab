import { beforeAll, describe, expect, test } from "bun:test";

import type { ProviderEnvelope } from "@prism/contracts";

import { sql } from "./client";
import { acceptMessage, markOutboxDispatched } from "./ingestion";
import { migrate } from "../scripts/migrate";
import { seed } from "../scripts/seed";
import { readMessageEvidence, readMessages, readReviews } from "./reads";
import type { Scope } from "./scope";

const scopeA: Scope = {
  organizationId: "organization-northstar",
  scopeId: "scope-northstar-baseline",
};

const scopeB: Scope = {
  organizationId: "organization-harborlight",
  scopeId: "scope-harborlight-baseline",
};

function envelopeFor(scope: Scope, deliveryId: string): ProviderEnvelope {
  return {
    scopeId: scope.scopeId,
    organizationId: scope.organizationId,
    connectionId:
      scope.scopeId === scopeA.scopeId
        ? "connection-northstar-encoretix"
        : "connection-harborlight-encoretix",
    provider: "encoretix",
    deliveryId,
    externalEventId: "event-fictional-summer-hall",
    kind: "sale_delta",
    sourceOccurredAt: "2026-08-24T12:34:56.000Z",
    receivedAt: "2026-08-24T12:35:01.000Z",
    sourceVersion: "2026-08-24T12:34:56.000Z",
    checksum: "sha256:scope-isolation",
    payload: { tickets: 2, currency: "USD" },
  };
}

async function dispatchMessage(messageId: string): Promise<void> {
  const rows = await sql<{ id: string }[]>`
    SELECT id
    FROM ingestion_outbox
    WHERE message_id = ${messageId}
  `;

  await markOutboxDispatched(rows[0]!.id);
}

beforeAll(async () => {
  await migrate();
  await seed();
});

describe("scoped ingestion storage", () => {
  test("accepts the same provider delivery in separate scopes", async () => {
    const deliveryId = `delivery-scope-isolation-${crypto.randomUUID()}`;

    const acceptedA = await acceptMessage(
      scopeA,
      envelopeFor(scopeA, deliveryId),
    );
    const acceptedB = await acceptMessage(
      scopeB,
      envelopeFor(scopeB, deliveryId),
    );

    expect(acceptedA).toEqual({
      status: "accepted",
      messageId: expect.any(String),
    });
    expect(acceptedB).toEqual({
      status: "accepted",
      messageId: expect.any(String),
    });
    expect(
      await acceptMessage(scopeA, envelopeFor(scopeA, deliveryId)),
    ).toEqual({
      status: "duplicate",
      messageId: expect.any(String),
    });

    await Promise.all([
      dispatchMessage(acceptedA.messageId),
      dispatchMessage(acceptedB.messageId),
    ]);
  });

  test("does not return another scope's messages", async () => {
    const deliveryId = `delivery-private-${crypto.randomUUID()}`;
    const accepted = await acceptMessage(
      scopeA,
      envelopeFor(scopeA, deliveryId),
    );

    expect(await readMessageEvidence(scopeB, accepted.messageId)).toBeNull();
    expect(
      await readMessageEvidence(scopeA, accepted.messageId),
    ).not.toBeNull();

    await dispatchMessage(accepted.messageId);
  });

  test("returns and pages the newest 50 messages first", async () => {
    const testScope = await createReadTestScope();
    const prefix = `message-${crypto.randomUUID()}`;
    for (let index = 0; index < 55; index += 1) {
      const suffix = String(index).padStart(2, "0");
      const id = `${prefix}-${suffix}`;
      const receivedAt = new Date(
        Date.UTC(2026, 7, 24, 12, 0, Math.min(index, 53)),
      ).toISOString();
      await sql`
        INSERT INTO ingestion_messages (
          id, scope_id, organization_id, connection_id, provider, delivery_id,
          external_event_id, kind, source_occurred_at, received_at,
          source_version, checksum, payload
        )
        VALUES (
          ${id}, ${testScope.scopeId}, ${testScope.organizationId},
          ${`connection-${testScope.scopeId}`}, 'encoretix', ${`delivery-${suffix}`},
          'event-read-order', 'sale_delta', ${receivedAt}, ${receivedAt},
          ${receivedAt}, ${`sha256:${id}`}, '{}'::jsonb
        )
      `;
    }

    const firstPage = await readMessages(testScope);

    expect(firstPage).toHaveLength(50);
    expect(firstPage.slice(0, 5).map((message) => message.id)).toEqual([
      `${prefix}-54`,
      `${prefix}-53`,
      `${prefix}-52`,
      `${prefix}-51`,
      `${prefix}-50`,
    ]);
    expect(firstPage.at(-1)?.id).toBe(`${prefix}-05`);
    expect(
      (await readMessages(testScope, `${prefix}-05`)).map(
        (message) => message.id,
      ),
    ).toEqual([
      `${prefix}-04`,
      `${prefix}-03`,
      `${prefix}-02`,
      `${prefix}-01`,
      `${prefix}-00`,
    ]);
  });

  test("returns and pages the newest 50 reviews first", async () => {
    const testScope = await createReadTestScope();
    const prefix = `review-${crypto.randomUUID()}`;
    for (let index = 0; index < 55; index += 1) {
      const suffix = String(index).padStart(2, "0");
      const id = `${prefix}-${suffix}`;
      const createdAt = new Date(
        Date.UTC(2026, 7, 24, 12, 0, Math.min(index, 53)),
      ).toISOString();
      await sql`
        INSERT INTO review_items (
          id, scope_id, organization_id, kind, created_at
        )
        VALUES (
          ${id}, ${testScope.scopeId}, ${testScope.organizationId},
          'read_order', ${createdAt}
        )
      `;
    }

    const firstPage = await readReviews(testScope);

    expect(firstPage).toHaveLength(50);
    expect(firstPage.slice(0, 5).map((review) => review.id)).toEqual([
      `${prefix}-54`,
      `${prefix}-53`,
      `${prefix}-52`,
      `${prefix}-51`,
      `${prefix}-50`,
    ]);
    expect(firstPage.at(-1)?.id).toBe(`${prefix}-05`);
    expect(
      (await readReviews(testScope, `${prefix}-05`)).map((review) => review.id),
    ).toEqual([
      `${prefix}-04`,
      `${prefix}-03`,
      `${prefix}-02`,
      `${prefix}-01`,
      `${prefix}-00`,
    ]);
  });

  test("rejects a webhook key identifier used by another scope", async () => {
    const sharedWebhookKey = `shared-webhook-${crypto.randomUUID()}`;
    const firstScope = await createReadTestScope(sharedWebhookKey);
    const secondScope = await createReadTestScope();

    let databaseError: { code?: string; constraint_name?: string } | undefined;
    try {
      await sql`
        UPDATE provider_connections
        SET public_webhook_key_id = ${sharedWebhookKey}
        WHERE scope_id = ${secondScope.scopeId}
      `;
    } catch (error) {
      databaseError = error as {
        code?: string;
        constraint_name?: string;
      };
    }

    expect(databaseError).toEqual(
      expect.objectContaining({
        code: "23505",
        constraint_name: "provider_connections_public_webhook_key_id_key",
      }),
    );
    expect(firstScope.scopeId).not.toBe(secondScope.scopeId);
  });
});

async function createReadTestScope(
  publicWebhookKeyId = `webhook-${crypto.randomUUID()}`,
): Promise<Scope> {
  const scope: Scope = {
    organizationId: "organization-northstar",
    scopeId: `scope-read-${crypto.randomUUID()}`,
  };

  await sql`
    INSERT INTO data_scopes (scope_id, organization_id, kind)
    VALUES (${scope.scopeId}, ${scope.organizationId}, 'lab')
  `;
  await sql`
    INSERT INTO provider_connections (
      id, scope_id, organization_id, provider, public_webhook_key_id
    )
    VALUES (
      ${`connection-${scope.scopeId}`}, ${scope.scopeId},
      ${scope.organizationId}, 'encoretix', ${publicWebhookKeyId}
    )
  `;

  return scope;
}
