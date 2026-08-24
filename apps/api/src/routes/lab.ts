import { randomUUID } from "node:crypto";

import type { ProviderEnvelope, ScenarioId, TraceStep } from "@prism/contracts";
import { ScenarioIdSchema } from "@prism/contracts";
import type { FastifyInstance } from "fastify";

import {
  createLabSession,
  createScenarioRun,
  readScenarioRun,
  resetScenarioRun,
  saveScenarioTrace,
} from "../../../../packages/database/src/lab";
import { sql } from "../../../../packages/database/src/client";
import { acceptMessage } from "../../../../packages/database/src/ingestion";
import type { Scope } from "../../../../packages/database/src/scope";
import {
  scenarioFixtures,
  type ScenarioFixture,
} from "../../../../packages/providers/src/fixtures/scenarios";
import { processMessage } from "../../../worker/src/jobs/process-message";
import { pollVenueWave } from "../../../worker/src/jobs/poll-venuewave";

import { HttpError } from "../http/errors";
import { resolveLabScope } from "../http/lab-scope";
import { parseRawJson } from "../http/raw-json";

type SessionBody = { organizationSlug?: unknown };
type LabResources = {
  boxgridConnectionId: string;
  encoreTixConnectionId: string;
  eventId: string;
  showId: string;
  venueWaveConnectionId: string;
};

function labBody(body: unknown): SessionBody {
  if (body instanceof Uint8Array) {
    const parsed = parseRawJson(body);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new HttpError(400, "The lab session body is invalid");
    }

    return parsed as SessionBody;
  }

  if (typeof body === "object" && body !== null && !Array.isArray(body)) {
    return body as SessionBody;
  }

  throw new HttpError(400, "The lab session body is invalid");
}

function traceFor(fixture: ScenarioFixture): TraceStep[] {
  return [
    {
      databaseEffect:
        "The original payload is available only from scoped message evidence.",
      explanation: fixture.input,
      order: 0,
      state: "received",
      title: "Original input",
    },
    {
      databaseEffect:
        "The durable message state records the processing decision.",
      explanation: fixture.processing,
      order: 1,
      state: "processing",
      title: "Processing state",
    },
    {
      databaseEffect:
        "Normalized operations remain linked to their source message.",
      explanation: fixture.normalized,
      order: 2,
      state: fixture.state,
      title: "Normalized output",
    },
    {
      databaseEffect: fixture.databaseEffect,
      explanation: fixture.explanation,
      order: 3,
      state: fixture.state,
      title: "Database effect",
    },
    {
      databaseEffect: "Audit evidence is stored with the same lab scope.",
      explanation: fixture.audit,
      order: 4,
      state: fixture.state,
      title: "Audit result",
    },
  ];
}

function envelope(
  scope: Scope,
  values: Pick<
    ProviderEnvelope,
    | "connectionId"
    | "deliveryId"
    | "externalEventId"
    | "kind"
    | "payload"
    | "provider"
    | "sourceVersion"
  >,
): ProviderEnvelope {
  return {
    ...values,
    checksum: `sha256:${values.deliveryId}`,
    organizationId: scope.organizationId,
    receivedAt: "2026-08-24T12:00:00.000Z",
    scopeId: scope.scopeId,
    sourceOccurredAt: "2026-08-24T12:00:00.000Z",
  };
}

async function acceptAndProcess(
  scope: Scope,
  values: Parameters<typeof envelope>[1],
): Promise<string> {
  const accepted = await acceptMessage(scope, envelope(scope, values));

  if (accepted.status === "accepted") {
    await processMessage(accepted.messageId);
  }

  return accepted.messageId;
}

async function addAudit(
  scope: Scope,
  action: string,
  details: Record<string, string | number>,
): Promise<void> {
  await sql`
    INSERT INTO audit_entries (id, scope_id, organization_id, action, details)
    VALUES (
      ${`audit-lab-${randomUUID()}`}, ${scope.scopeId}, ${scope.organizationId},
      ${action}, ${JSON.stringify(details)}::jsonb
    )
  `;
}

async function labResources(scope: Scope): Promise<LabResources> {
  const rows = await sql<LabResources[]>`
    SELECT
      max(provider_connections.id) FILTER (
        WHERE provider_connections.provider = 'encoretix'
      ) AS "encoreTixConnectionId",
      max(provider_connections.id) FILTER (
        WHERE provider_connections.provider = 'venuewave'
      ) AS "venueWaveConnectionId",
      max(provider_connections.id) FILTER (
        WHERE provider_connections.provider = 'boxgrid'
      ) AS "boxgridConnectionId",
      max(event_mappings.external_event_id) FILTER (
        WHERE event_mappings.provider = 'encoretix'
      ) AS "eventId",
      max(event_mappings.show_id) FILTER (
        WHERE event_mappings.provider = 'encoretix'
      ) AS "showId"
    FROM provider_connections
    LEFT JOIN event_mappings
      ON event_mappings.scope_id = provider_connections.scope_id
      AND event_mappings.connection_id = provider_connections.id
    WHERE provider_connections.scope_id = ${scope.scopeId}
      AND provider_connections.organization_id = ${scope.organizationId}
  `;
  const resources = rows[0];

  if (
    !resources?.encoreTixConnectionId ||
    !resources.venueWaveConnectionId ||
    !resources.boxgridConnectionId ||
    !resources.eventId ||
    !resources.showId
  ) {
    throw new Error("The lab scope is missing its seeded provider resources");
  }

  return resources;
}

async function runScenarioWork(
  scope: Scope,
  scenario: ScenarioId,
): Promise<void> {
  const resources = await labResources(scope);
  const deliveryId = (name: string) => `${name}-${randomUUID()}`;

  if (scenario === "duplicate_webhook") {
    const values = {
      connectionId: resources.encoreTixConnectionId,
      deliveryId: deliveryId("encore-duplicate"),
      externalEventId: resources.eventId,
      kind: "sale_delta" as const,
      payload: {
        effects: [{ amountDeltaCents: 5000, kind: "sale", ticketDelta: 2 }],
      },
      provider: "encoretix" as const,
      sourceVersion: "2026-08-24T12:00:00.000Z",
    };
    await acceptAndProcess(scope, values);
    await acceptMessage(scope, envelope(scope, values));
    return;
  }

  if (scenario === "late_update") {
    await acceptAndProcess(scope, {
      connectionId: resources.encoreTixConnectionId,
      deliveryId: deliveryId("encore-newer-sale"),
      externalEventId: resources.eventId,
      kind: "sale_delta",
      payload: {
        effects: [{ amountDeltaCents: 2500, kind: "sale", ticketDelta: 1 }],
      },
      provider: "encoretix",
      sourceVersion: "2026-08-24T12:01:00.000Z",
    });
    await acceptAndProcess(scope, {
      connectionId: resources.encoreTixConnectionId,
      deliveryId: deliveryId("encore-late-sale"),
      externalEventId: resources.eventId,
      kind: "sale_delta",
      payload: {
        effects: [{ amountDeltaCents: 5000, kind: "sale", ticketDelta: 2 }],
      },
      provider: "encoretix",
      sourceVersion: "2026-08-24T11:59:00.000Z",
    });
    return;
  }

  if (scenario === "provider_outage") {
    const outageDeliveryId = deliveryId("venuewave-outage-recovery");

    await sql`
      INSERT INTO event_mappings (
        id, scope_id, organization_id, connection_id, provider, external_event_id,
        show_id, state
      )
      VALUES (
        'mapping-lab-venuewave', ${scope.scopeId}, ${scope.organizationId},
        ${resources.venueWaveConnectionId}, 'venuewave', ${resources.eventId},
        ${resources.showId}, 'confirmed'
      )
      ON CONFLICT (scope_id, provider, external_event_id) DO UPDATE
      SET connection_id = EXCLUDED.connection_id, show_id = EXCLUDED.show_id,
        state = 'confirmed'
    `;
    await sql`
      UPDATE provider_connections
      SET recent_error = 'temporary_provider_failure', updated_at = now()
      WHERE scope_id = ${scope.scopeId}
        AND provider = 'venuewave'
    `;
    await addAudit(scope, "venuewave_retrying", { attempts: 2 });
    await pollVenueWave({
      client: {
        getPage: (cursor) => ({
          cursor,
          effects: [{ amountDeltaCents: 7500, kind: "sale", ticketDelta: 3 }],
          nextCursor: "cursor-outage-recovered",
        }),
      },
      connectionId: resources.venueWaveConnectionId,
      deliveryId: outageDeliveryId,
      externalEventId: resources.eventId,
    });
    const messages = await sql<{ id: string }[]>`
      SELECT id
      FROM ingestion_messages
      WHERE scope_id = ${scope.scopeId}
        AND provider = 'venuewave'
        AND delivery_id = ${outageDeliveryId}
    `;
    await processMessage(messages[0]!.id);
    await addAudit(scope, "venuewave_recovered", { attempts: 3 });
    return;
  }

  if (scenario === "rate_limit") {
    await sql`
      UPDATE provider_connections
      SET recent_error = 'rate_limited', updated_at = now()
      WHERE scope_id = ${scope.scopeId}
        AND provider = 'venuewave'
    `;
    await addAudit(scope, "venuewave_rate_limited", { retryAfterSeconds: 60 });
    return;
  }

  if (scenario === "uncertain_event_match") {
    const messageId = await acceptAndProcess(scope, {
      connectionId: resources.venueWaveConnectionId,
      deliveryId: deliveryId("venuewave-uncertain-match"),
      externalEventId: "event-similar-unconfirmed",
      kind: "sale_delta",
      payload: {
        effects: [{ amountDeltaCents: 7500, kind: "sale", ticketDelta: 3 }],
        nextCursor: "cursor-uncertain-match",
      },
      provider: "venuewave",
      sourceVersion: "cursor-uncertain-match",
    });
    await sql`
      INSERT INTO review_items (id, scope_id, organization_id, message_id, kind)
      VALUES (
        ${`review-lab-${randomUUID()}`}, ${scope.scopeId}, ${scope.organizationId},
        ${messageId}, 'uncertain_event_match'
      )
    `;
    return;
  }

  if (scenario === "incomplete_snapshot") {
    const messageId = await acceptAndProcess(scope, {
      connectionId: resources.boxgridConnectionId,
      deliveryId: deliveryId("boxgrid-incomplete-snapshot"),
      externalEventId: resources.eventId,
      kind: "snapshot",
      payload: {
        complete: false,
        facts: { grossSalesCents: 60000, inventory: 40, sold: 600 },
        sequence: "1",
      },
      provider: "boxgrid",
      sourceVersion: "1",
    });
    await sql`
      INSERT INTO review_items (id, scope_id, organization_id, message_id, kind)
      VALUES (
        ${`review-lab-${randomUUID()}`}, ${scope.scopeId}, ${scope.organizationId},
        ${messageId}, 'incomplete_snapshot'
      )
    `;
    return;
  }

  await sql.begin(async (transaction) => {
    await transaction`DELETE FROM ticket_facts WHERE scope_id = ${scope.scopeId}`;
    await transaction`
      INSERT INTO event_mappings (
        id, scope_id, organization_id, connection_id, provider, external_event_id,
        show_id, state
      )
      VALUES (
        'mapping-lab-boxgrid', ${scope.scopeId}, ${scope.organizationId},
        ${resources.boxgridConnectionId}, 'boxgrid', ${resources.eventId},
        ${resources.showId}, 'confirmed'
      )
      ON CONFLICT (scope_id, provider, external_event_id) DO UPDATE
      SET connection_id = EXCLUDED.connection_id, show_id = EXCLUDED.show_id,
        state = 'confirmed'
    `;
  });
  await acceptAndProcess(scope, {
    connectionId: resources.encoreTixConnectionId,
    deliveryId: deliveryId("encore-provider-change-400"),
    externalEventId: resources.eventId,
    kind: "sale_delta",
    payload: {
      effects: [{ amountDeltaCents: 1000000, kind: "sale", ticketDelta: 400 }],
    },
    provider: "encoretix",
    sourceVersion: "2026-08-24T12:00:00.000Z",
  });
  await acceptAndProcess(scope, {
    connectionId: resources.boxgridConnectionId,
    deliveryId: deliveryId("boxgrid-provider-change-600"),
    externalEventId: resources.eventId,
    kind: "snapshot",
    payload: {
      complete: true,
      facts: { grossSalesCents: 1500000, inventory: 0, sold: 600 },
      sequence: "2",
    },
    provider: "boxgrid",
    sourceVersion: "2",
  });
  await sql.begin(async (transaction) => {
    const reconciliationId = `reconciliation-lab-${randomUUID()}`;
    await transaction`
      INSERT INTO reconciliation_runs (
        id, scope_id, organization_id, state, evidence
      )
      VALUES (
        ${reconciliationId}, ${scope.scopeId}, ${scope.organizationId},
        'needs_review', ${JSON.stringify({ boxgrid: 600, encoretix: 400 })}::jsonb
      )
    `;
    await transaction`
      INSERT INTO review_items (id, scope_id, organization_id, reconciliation_run_id, kind)
      VALUES (
        ${`review-lab-${randomUUID()}`}, ${scope.scopeId}, ${scope.organizationId},
        ${reconciliationId}, 'provider_change_reconciliation'
      )
    `;
  });
  await addAudit(scope, "provider_change_reconciled", {
    boxgrid: 600,
    encoretix: 400,
  });
}

export function registerLabRoutes(server: FastifyInstance): void {
  server.post<{ Body: unknown }>(
    "/api/lab/sessions",
    async (request, reply) => {
      const body = labBody(request.body);

      if (
        typeof body.organizationSlug !== "string" ||
        body.organizationSlug.length === 0
      ) {
        throw new HttpError(400, "A seeded organization slug is required");
      }

      const session = await createLabSession(body.organizationSlug);

      if (!session) {
        throw new HttpError(404, "Organization was not found");
      }

      return reply.status(201).send({
        expiresAt: session.expiresAt.toISOString(),
        token: session.token,
      });
    },
  );

  server.post<{ Params: { scenario: string } }>(
    "/api/lab/scenarios/:scenario/run",
    async (request, reply) => {
      const parsed = ScenarioIdSchema.safeParse(request.params.scenario);

      if (!parsed.success) {
        throw new HttpError(404, "Scenario was not found");
      }

      const scope = await resolveLabScope(request);
      const runId = await createScenarioRun(scope, parsed.data);
      await runScenarioWork(scope, parsed.data);
      const fixture = scenarioFixtures[parsed.data];
      await saveScenarioTrace(scope, runId, fixture.state, traceFor(fixture));
      const run = await readScenarioRun(scope, runId);

      return reply.status(201).send(run);
    },
  );
  server.get<{ Params: { id: string } }>(
    "/api/lab/runs/:id",
    async (request) => {
      const run = await readScenarioRun(
        await resolveLabScope(request),
        request.params.id,
      );

      if (!run) {
        throw new HttpError(404, "Scenario run was not found");
      }

      return run;
    },
  );
  server.post<{ Params: { id: string } }>(
    "/api/lab/runs/:id/reset",
    async (request) => {
      const reset = await resetScenarioRun(
        await resolveLabScope(request),
        request.params.id,
      );

      if (!reset) {
        throw new HttpError(404, "Scenario run was not found");
      }

      return { status: "reset" };
    },
  );
}
