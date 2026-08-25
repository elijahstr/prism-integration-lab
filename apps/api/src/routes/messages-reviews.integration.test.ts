import { beforeAll, describe, expect, test } from "bun:test";
import { createHmac, randomUUID } from "node:crypto";

import type { ProviderEnvelope } from "@prism/contracts";

import { sql } from "@prism/database";
import { acceptMessage } from "@prism/database/ingestion";
import { migrate } from "@prism/database/migrate";
import { seed } from "@prism/database/seed";
import { buildServer } from "../server";

process.env.LAB_TOKEN_PEPPER = "test-lab-token-pepper";

const scope = {
  organizationId: "organization-northstar",
  scopeId: "scope-northstar-baseline",
};

const otherScope = {
  organizationId: "organization-harborlight",
  scopeId: "scope-harborlight-baseline",
};

const token = "test-lab-token";

function tokenHash(value: string): string {
  return createHmac("sha256", process.env.LAB_TOKEN_PEPPER!)
    .update(value)
    .digest("hex");
}

function envelopeFor(deliveryId: string): ProviderEnvelope {
  return {
    checksum: "sha256:replay",
    connectionId: "connection-northstar-encoretix",
    deliveryId,
    externalEventId: "event-fictional-summer-hall",
    kind: "sale_delta",
    organizationId: scope.organizationId,
    payload: {
      effects: [{ amountDeltaCents: 5000, kind: "sale", ticketDelta: 2 }],
    },
    provider: "encoretix",
    receivedAt: "2026-08-24T12:35:01.000Z",
    scopeId: scope.scopeId,
    sourceOccurredAt: "2026-08-24T12:34:56.000Z",
    sourceVersion: "2026-08-24T12:34:56.000Z",
  };
}

async function createNeedsReviewMessage(
  externalEventId = "event-fictional-summer-hall",
): Promise<string> {
  const accepted = await acceptMessage(scope, {
    ...envelopeFor(`review-replay-${randomUUID()}`),
    externalEventId,
  });
  await sql`
    UPDATE ingestion_messages
    SET state = 'needs_review'
    WHERE id = ${accepted.messageId}
  `;

  return accepted.messageId;
}

beforeAll(async () => {
  await migrate();
  await seed();
  await sql`
    INSERT INTO demo_sessions (id, scope_id, organization_id, token_hash, expires_at)
    VALUES (
      'session-route-tests',
      ${scope.scopeId},
      ${scope.organizationId},
      ${tokenHash(token)},
      now() + interval '1 hour'
    )
    ON CONFLICT (id) DO UPDATE
    SET token_hash = EXCLUDED.token_hash, state = 'active', expires_at = EXCLUDED.expires_at
  `;
});

describe("scoped message and review mutations", () => {
  test("replays an exhausted message after BullMQ removes its failed job", async () => {
    const accepted = await acceptMessage(
      scope,
      envelopeFor(`replay-${randomUUID()}`),
    );
    await sql`
      UPDATE ingestion_messages
      SET state = 'failed'
      WHERE id = ${accepted.messageId}
    `;
    await sql`
      UPDATE ingestion_outbox
      SET dispatched_at = now()
      WHERE message_id = ${accepted.messageId}
    `;
    const server = buildServer();
    const response = await server.inject({
      method: "POST",
      url: `/api/messages/${accepted.messageId}/replay`,
      headers: { authorization: `Lab ${token}` },
    });

    expect(response.statusCode).toBe(202);
    expect(
      Array.from(
        await sql<{ state: string; dispatched: boolean }[]>`
          SELECT state, dispatched_at IS NOT NULL AS dispatched
          FROM ingestion_messages
          JOIN ingestion_outbox ON ingestion_outbox.message_id = ingestion_messages.id
          WHERE ingestion_messages.id = ${accepted.messageId}
        `,
      ),
    ).toEqual([{ state: "received", dispatched: false }]);
    await server.close();
  });

  test("returns not found for a replay target outside the token scope", async () => {
    const accepted = await acceptMessage(otherScope, {
      ...envelopeFor(`cross-scope-replay-${randomUUID()}`),
      connectionId: "connection-harborlight-encoretix",
      organizationId: otherScope.organizationId,
      scopeId: otherScope.scopeId,
    });
    const server = buildServer();
    const response = await server.inject({
      method: "POST",
      url: `/api/messages/${accepted.messageId}/replay`,
      headers: { authorization: `Lab ${token}` },
    });

    expect(response.statusCode).toBe(404);
    await server.close();
  });

  test("denies replay while a linked review is pending or rejected", async () => {
    const pendingId = await createNeedsReviewMessage();
    const rejectedId = await createNeedsReviewMessage();
    await sql`
      INSERT INTO review_items (id, scope_id, organization_id, message_id, kind)
      VALUES
        (${`review-${randomUUID()}`}, ${scope.scopeId}, ${scope.organizationId}, ${pendingId}, 'checksum_conflict'),
        (${`review-${randomUUID()}`}, ${scope.scopeId}, ${scope.organizationId}, ${rejectedId}, 'checksum_conflict')
    `;
    await sql`
      UPDATE review_items
      SET state = 'rejected', resolved_at = now()
      WHERE message_id = ${rejectedId}
    `;
    const server = buildServer();

    const pendingResponse = await server.inject({
      method: "POST",
      url: `/api/messages/${pendingId}/replay`,
      headers: { authorization: `Lab ${token}` },
    });
    const rejectedResponse = await server.inject({
      method: "POST",
      url: `/api/messages/${rejectedId}/replay`,
      headers: { authorization: `Lab ${token}` },
    });

    expect(pendingResponse.statusCode).toBe(409);
    expect(rejectedResponse.statusCode).toBe(409);
    expect(
      Array.from(
        await sql<{ id: string; state: string }[]>`
          SELECT id, state
          FROM ingestion_messages
          WHERE id IN (${pendingId}, ${rejectedId})
          ORDER BY id
        `,
      ).map((message) => message.state),
    ).toEqual(["needs_review", "needs_review"]);
    await server.close();
  });

  test("denies a needs-review message with no linked review despite its mapping", async () => {
    const messageId = await createNeedsReviewMessage();
    await sql`
      UPDATE ingestion_outbox
      SET dispatched_at = now()
      WHERE message_id = ${messageId}
    `;
    const server = buildServer();
    const response = await server.inject({
      method: "POST",
      url: `/api/messages/${messageId}/replay`,
      headers: { authorization: `Lab ${token}` },
    });

    expect(response.statusCode).toBe(409);
    expect(
      Array.from(
        await sql<{ state: string; dispatched: boolean }[]>`
          SELECT
            ingestion_messages.state,
            ingestion_outbox.dispatched_at IS NOT NULL AS dispatched
          FROM ingestion_messages
          JOIN ingestion_outbox ON ingestion_outbox.message_id = ingestion_messages.id
          WHERE ingestion_messages.id = ${messageId}
        `,
      ),
    ).toEqual([{ state: "needs_review", dispatched: true }]);
    await server.close();
  });

  test("replays a needs-review message after every review approval and mapping check", async () => {
    const messageId = await createNeedsReviewMessage();
    await sql`
      INSERT INTO review_items (id, scope_id, organization_id, message_id, kind, state, resolved_at)
      VALUES (
        ${`review-${randomUUID()}`},
        ${scope.scopeId},
        ${scope.organizationId},
        ${messageId},
        'checksum_conflict',
        'approved',
        now()
      )
    `;
    const server = buildServer();
    const response = await server.inject({
      method: "POST",
      url: `/api/messages/${messageId}/replay`,
      headers: { authorization: `Lab ${token}` },
    });

    expect(response.statusCode).toBe(202);
    expect(
      Array.from(
        await sql<{ state: string }[]>`
          SELECT state FROM ingestion_messages WHERE id = ${messageId}
        `,
      ),
    ).toEqual([{ state: "received" }]);
    await server.close();
  });

  test("denies an approved review message when its mapping is still absent", async () => {
    const messageId = await createNeedsReviewMessage(
      `unmapped-${randomUUID()}`,
    );
    await sql`
      INSERT INTO review_items (id, scope_id, organization_id, message_id, kind, state, resolved_at)
      VALUES (
        ${`review-${randomUUID()}`},
        ${scope.scopeId},
        ${scope.organizationId},
        ${messageId},
        'event_mapping',
        'approved',
        now()
      )
    `;
    const server = buildServer();
    const response = await server.inject({
      method: "POST",
      url: `/api/messages/${messageId}/replay`,
      headers: { authorization: `Lab ${token}` },
    });

    expect(response.statusCode).toBe(409);
    await server.close();
  });

  test("approves only a review item in the token scope", async () => {
    const id = `review-${randomUUID()}`;
    await sql`
      INSERT INTO review_items (id, scope_id, organization_id, kind)
      VALUES (${id}, ${scope.scopeId}, ${scope.organizationId}, 'checksum_conflict')
    `;
    const server = buildServer();
    const response = await server.inject({
      method: "POST",
      url: `/api/reviews/${id}/approve`,
      headers: { authorization: `Lab ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(
      Array.from(
        await sql<
          { state: string }[]
        >`SELECT state FROM review_items WHERE id = ${id}`,
      ),
    ).toEqual([{ state: "approved" }]);
    await server.close();
  });

  test("returns not found when a review item belongs to another scope", async () => {
    const id = `review-${randomUUID()}`;
    await sql`
      INSERT INTO review_items (id, scope_id, organization_id, kind)
      VALUES (${id}, ${otherScope.scopeId}, ${otherScope.organizationId}, 'checksum_conflict')
    `;
    const server = buildServer();
    const response = await server.inject({
      method: "POST",
      url: `/api/reviews/${id}/reject`,
      headers: { authorization: `Lab ${token}` },
    });

    expect(response.statusCode).toBe(404);
    expect(
      Array.from(
        await sql<
          { state: string }[]
        >`SELECT state FROM review_items WHERE id = ${id}`,
      ),
    ).toEqual([{ state: "pending" }]);
    await server.close();
  });
});
