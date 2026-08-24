import { beforeAll, describe, expect, test } from "bun:test";

import type { ProviderEnvelope } from "@prism/contracts";

import { sql } from "./client";
import { acceptMessage, markOutboxDispatched } from "./ingestion";
import { migrate } from "../scripts/migrate";
import { seed } from "../scripts/seed";
import { listMessages, type Scope, withScope } from "./scope";

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

    expect(await listMessages(scopeB, deliveryId)).toEqual([]);
    expect(
      await withScope(scopeA, (repository) =>
        repository.listMessages(deliveryId),
      ),
    ).toEqual([
      expect.objectContaining({
        deliveryId,
        provider: "encoretix",
        scopeId: scopeA.scopeId,
      }),
    ]);

    await dispatchMessage(accepted.messageId);
  });
});
