import { beforeAll, describe, expect, test } from "bun:test";

import type { ProviderEnvelope } from "@prism/contracts";

import { sql } from "./client";
import { claimOutbox, markOutboxDispatched, acceptMessage } from "./ingestion";
import { migrate } from "../scripts/migrate";
import { seed } from "../scripts/seed";
import type { Scope } from "./scope";

const scope: Scope = {
  organizationId: "organization-northstar",
  scopeId: "scope-northstar-baseline",
};

function envelopeFor(deliveryId: string): ProviderEnvelope {
  return {
    scopeId: scope.scopeId,
    organizationId: scope.organizationId,
    connectionId: "connection-northstar-encoretix",
    provider: "encoretix",
    deliveryId,
    externalEventId: "event-fictional-summer-hall",
    kind: "sale_delta",
    sourceOccurredAt: "2026-08-24T12:34:56.000Z",
    receivedAt: "2026-08-24T12:35:01.000Z",
    sourceVersion: "2026-08-24T12:34:56.000Z",
    checksum: "sha256:outbox",
    payload: { tickets: 2, currency: "USD" },
  };
}

beforeAll(async () => {
  await migrate();
  await seed();
});

describe("ingestion outbox", () => {
  test("claims and dispatches the row created with an accepted message", async () => {
    const accepted = await acceptMessage(
      scope,
      envelopeFor(`delivery-outbox-${crypto.randomUUID()}`),
    );

    expect(accepted).toEqual({
      status: "accepted",
      messageId: expect.any(String),
    });

    const claimed = await claimOutbox(100);
    const row = claimed.find(
      (candidate) => candidate.messageId === accepted.messageId,
    );

    expect(row).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        messageId: accepted.messageId,
        scopeId: scope.scopeId,
        dispatchAttempts: 1,
      }),
    );

    await markOutboxDispatched(row!.id);

    expect(
      (await claimOutbox(100)).map((candidate) => candidate.id),
    ).not.toContain(row!.id);
  });

  test("keeps one pending checksum review for repeated conflicts", async () => {
    const deliveryId = `repeated-conflict-${crypto.randomUUID()}`;
    const accepted = await acceptMessage(scope, envelopeFor(deliveryId));

    await acceptMessage(scope, {
      ...envelopeFor(deliveryId),
      checksum: "sha256:first-conflict",
    });
    await acceptMessage(scope, {
      ...envelopeFor(deliveryId),
      checksum: "sha256:second-conflict",
    });

    expect(
      Array.from(
        await sql<{ count: string }[]>`
          SELECT count(*)::text AS count
          FROM review_items
          WHERE message_id = ${accepted.messageId}
            AND kind = 'checksum_conflict'
            AND state = 'pending'
        `,
      ),
    ).toEqual([{ count: "1" }]);
  });
});
