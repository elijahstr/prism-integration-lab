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

  test("orders and pages messages by received time and identifier", async () => {
    const testScope = await createReadTestScope();
    const prefix = `message-${crypto.randomUUID()}`;
    const values = [
      [`${prefix}-c`, "delivery-c", "2026-08-24T11:59:00.000Z"],
      [`${prefix}-b`, "delivery-b", "2026-08-24T12:00:00.000Z"],
      [`${prefix}-a`, "delivery-a", "2026-08-24T12:00:00.000Z"],
    ] as const;

    for (const [id, deliveryId, receivedAt] of values) {
      await sql`
        INSERT INTO ingestion_messages (
          id, scope_id, organization_id, connection_id, provider, delivery_id,
          external_event_id, kind, source_occurred_at, received_at,
          source_version, checksum, payload
        )
        VALUES (
          ${id}, ${testScope.scopeId}, ${testScope.organizationId},
          ${`connection-${testScope.scopeId}`}, 'encoretix', ${deliveryId},
          'event-read-order', 'sale_delta', ${receivedAt}, ${receivedAt},
          ${receivedAt}, ${`sha256:${id}`}, '{}'::jsonb
        )
      `;
    }

    expect(
      (await readMessages(testScope)).map((message) => message.id),
    ).toEqual([`${prefix}-c`, `${prefix}-a`, `${prefix}-b`]);
    expect(
      (await readMessages(testScope, `${prefix}-a`)).map(
        (message) => message.id,
      ),
    ).toEqual([`${prefix}-b`]);
  });

  test("orders and pages reviews by creation time and identifier", async () => {
    const testScope = await createReadTestScope();
    const values = [
      ["review-c", "2026-08-24T11:59:00.000Z"],
      ["review-b", "2026-08-24T12:00:00.000Z"],
      ["review-a", "2026-08-24T12:00:00.000Z"],
    ] as const;

    for (const [id, createdAt] of values) {
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

    expect((await readReviews(testScope)).map((review) => review.id)).toEqual([
      "review-c",
      "review-a",
      "review-b",
    ]);
    expect(
      (await readReviews(testScope, "review-a")).map((review) => review.id),
    ).toEqual(["review-b"]);
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
