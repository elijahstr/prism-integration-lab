import { randomUUID } from "node:crypto";

import type { ProviderEnvelope, ScenarioId, TraceStep } from "@prism/contracts";
import { ScenarioIdSchema } from "@prism/contracts";
import type { FastifyInstance } from "fastify";

import {
  createLabSession,
  failScenarioRun,
  readScenarioRun,
  resetScenarioRun,
  saveScenarioTrace,
  startScenarioRun,
} from "@prism/database/lab";
import { sql, type Scope } from "@prism/database";
import { acceptMessage } from "@prism/database/ingestion";
import {
  scenarioFixtures,
  type ScenarioFixture,
  VenueWaveSequenceClient,
} from "@prism/providers";
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
export type ScenarioObservation = {
  audit: string;
  databaseEffect: string;
  normalized: string;
  processing: string;
  state: string;
};
export type ScenarioClock = {
  elapsedMs: number;
  waits: readonly number[];
  now(): Date;
  sleep(milliseconds: number): Promise<void>;
};

export class VirtualScenarioClock implements ScenarioClock {
  elapsedMs = 0;
  waits: number[] = [];

  now(): Date {
    return new Date();
  }

  async sleep(milliseconds: number): Promise<void> {
    if (!Number.isInteger(milliseconds) || milliseconds < 0) {
      throw new Error("Scenario clock delay must be a nonnegative integer");
    }

    this.elapsedMs += milliseconds;
    this.waits.push(milliseconds);
  }
}

export type LabRouteDependencies = Partial<{
  createScenarioClock(): ScenarioClock;
  runScenarioWork(
    scope: Scope,
    scenario: ScenarioId,
    clock: ScenarioClock,
  ): Promise<ScenarioObservation | undefined>;
}>;

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

function assertNever(value: never): never {
  throw new Error(`Unhandled scenario: ${String(value)}`);
}

function traceFor(
  fixture: ScenarioFixture,
  observation?: ScenarioObservation,
): TraceStep[] {
  const details = {
    audit: observation?.audit ?? fixture.audit,
    databaseEffect: observation?.databaseEffect ?? fixture.databaseEffect,
    normalized: observation?.normalized ?? fixture.normalized,
    processing: observation?.processing ?? fixture.processing,
    state: observation?.state ?? fixture.state,
  };

  if (
    !details.audit ||
    !details.databaseEffect ||
    !details.normalized ||
    !details.processing
  ) {
    throw new Error("The scenario trace is missing observed details");
  }

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
      explanation: details.processing,
      order: 1,
      state: "processing",
      title: "Processing state",
    },
    {
      databaseEffect:
        "Normalized operations remain linked to their source message.",
      explanation: details.normalized,
      order: 2,
      state: details.state,
      title: "Normalized output",
    },
    {
      databaseEffect: details.databaseEffect,
      explanation: fixture.explanation,
      order: 3,
      state: details.state,
      title: "Database effect",
    },
    {
      databaseEffect: "Audit evidence is stored with the same lab scope.",
      explanation: details.audit,
      order: 4,
      state: details.state,
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
  clock: ScenarioClock,
): ProviderEnvelope {
  return {
    ...values,
    checksum: `sha256:${values.deliveryId}`,
    organizationId: scope.organizationId,
    receivedAt: clock.now().toISOString(),
    scopeId: scope.scopeId,
    sourceOccurredAt: "2026-08-24T12:00:00.000Z",
  };
}

async function acceptAndProcess(
  scope: Scope,
  values: Parameters<typeof envelope>[1],
  clock: ScenarioClock,
): Promise<string> {
  const accepted = await acceptMessage(scope, envelope(scope, values, clock));

  if (accepted.status === "accepted") {
    await processMessage(accepted.messageId, scope);
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
      ${action}, ${sql.json(details)}
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

async function venueWaveCursor(scope: Scope): Promise<string> {
  const cursors = await sql<{ cursor: string | null }[]>`
    SELECT poll_cursor AS cursor
    FROM provider_connections
    WHERE scope_id = ${scope.scopeId}
      AND organization_id = ${scope.organizationId}
      AND provider = 'venuewave'
  `;

  return cursors[0]?.cursor ?? "initial";
}

async function runScenarioWork(
  scope: Scope,
  scenario: ScenarioId,
  clock: ScenarioClock,
): Promise<ScenarioObservation | undefined> {
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
    await acceptAndProcess(scope, values, clock);
    await acceptMessage(scope, envelope(scope, values, clock));
    return undefined;
  }

  if (scenario === "late_update") {
    await acceptAndProcess(
      scope,
      {
        connectionId: resources.encoreTixConnectionId,
        deliveryId: deliveryId("encore-newer-sale"),
        externalEventId: resources.eventId,
        kind: "sale_delta",
        payload: {
          effects: [{ amountDeltaCents: 2500, kind: "sale", ticketDelta: 1 }],
        },
        provider: "encoretix",
        sourceVersion: "2026-08-24T12:01:00.000Z",
      },
      clock,
    );
    await acceptAndProcess(
      scope,
      {
        connectionId: resources.encoreTixConnectionId,
        deliveryId: deliveryId("encore-late-sale"),
        externalEventId: resources.eventId,
        kind: "sale_delta",
        payload: {
          effects: [{ amountDeltaCents: 5000, kind: "sale", ticketDelta: 2 }],
        },
        provider: "encoretix",
        sourceVersion: "2026-08-24T11:59:00.000Z",
      },
      clock,
    );
    return undefined;
  }

  if (scenario === "provider_outage") {
    const outageDeliveryId = deliveryId("venuewave-outage-recovery");
    const cursorBefore = await venueWaveCursor(scope);

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
    const client = new VenueWaveSequenceClient([
      { error: "temporary provider failure", type: "temporary_failure" },
      {
        cursor: cursorBefore === "initial" ? null : cursorBefore,
        effects: [{ amountDeltaCents: 7500, kind: "sale", ticketDelta: 3 }],
        nextCursor: "cursor-outage-recovered",
      },
    ]);
    const firstAttempt = await pollVenueWave({
      client,
      connectionId: resources.venueWaveConnectionId,
      deliveryId: outageDeliveryId,
      externalEventId: resources.eventId,
    });

    if (firstAttempt.status !== "temporary_failure") {
      throw new Error("The outage simulator did not fail its first poll");
    }

    const backoffMs = 1_000;
    await sql`
      UPDATE provider_connections
      SET recent_error = ${firstAttempt.error}, updated_at = now()
      WHERE scope_id = ${scope.scopeId}
        AND provider = 'venuewave'
    `;
    await addAudit(scope, "venuewave_retrying", {
      attempts: 1,
      backoffMs,
      error: firstAttempt.error,
    });
    await clock.sleep(backoffMs);
    const executedBackoffMs = clock.waits.at(-1);

    if (executedBackoffMs !== backoffMs) {
      throw new Error("The scenario clock did not execute the outage backoff");
    }
    const secondAttempt = await pollVenueWave({
      client,
      connectionId: resources.venueWaveConnectionId,
      deliveryId: outageDeliveryId,
      externalEventId: resources.eventId,
    });

    if (secondAttempt.status !== "saved") {
      throw new Error(
        "The outage simulator did not recover on its second poll",
      );
    }
    const messages = await sql<{ id: string }[]>`
      SELECT id
      FROM ingestion_messages
      WHERE scope_id = ${scope.scopeId}
        AND provider = 'venuewave'
        AND delivery_id = ${outageDeliveryId}
    `;
    await processMessage(messages[0]!.id, scope);
    const cursorAfter = await venueWaveCursor(scope);
    await addAudit(scope, "venuewave_recovered", {
      attempts: 2,
      cursorAfter,
      cursorBefore,
      cursorInputs: client.cursorInputs
        .map((cursor) => cursor ?? "initial")
        .join(","),
    });
    return {
      audit: `Audit evidence records the temporary error, ${executedBackoffMs} ms executed backoff, and recovery after 2 attempts.`,
      databaseEffect: `The cursor changed from ${cursorBefore} to ${cursorAfter} after 2 attempts and one durable message.`,
      normalized:
        "The successful second poll produced one VenueWave sale effect.",
      processing: `Attempt 1 failed with ${firstAttempt.error}. The virtual demo clock advanced ${executedBackoffMs} ms for exponential backoff. Attempt 2 used the preserved cursor and succeeded.`,
      state: "recovered",
    };
  }

  if (scenario === "rate_limit") {
    const cursorBefore = await venueWaveCursor(scope);
    const client = new VenueWaveSequenceClient([
      { retryAfterSeconds: 60, type: "rate_limited" },
      undefined,
    ]);
    const rateLimitAttempt = await pollVenueWave({
      client,
      connectionId: resources.venueWaveConnectionId,
      deliveryId: deliveryId("venuewave-rate-limit"),
      externalEventId: resources.eventId,
    });

    if (rateLimitAttempt.status !== "rate_limited") {
      throw new Error("The rate-limit simulator did not return a rate limit");
    }

    const retryAfterMs = rateLimitAttempt.retryAfterSeconds * 1_000;
    await clock.sleep(retryAfterMs);
    const executedRetryAfterMs = clock.waits.at(-1);

    if (executedRetryAfterMs !== retryAfterMs) {
      throw new Error("The scenario clock did not execute the rate-limit wait");
    }
    const retryAttempt = await pollVenueWave({
      client,
      connectionId: resources.venueWaveConnectionId,
      deliveryId: deliveryId("venuewave-rate-limit-retry"),
      externalEventId: resources.eventId,
    });

    if (retryAttempt.status !== "no_page") {
      throw new Error("The rate-limit retry did not preserve the empty page");
    }

    const cursorAfter = await venueWaveCursor(scope);
    await sql`
      UPDATE provider_connections
      SET recent_error = 'rate_limited', updated_at = now()
      WHERE scope_id = ${scope.scopeId}
        AND provider = 'venuewave'
    `;
    await addAudit(scope, "venuewave_rate_limited", {
      attempts: 2,
      cursorAfter,
      cursorBefore,
      cursorInputs: client.cursorInputs
        .map((cursor) => cursor ?? "initial")
        .join(","),
      retryAfterSeconds: rateLimitAttempt.retryAfterSeconds,
    });
    return {
      audit: `Audit evidence records the ${executedRetryAfterMs} ms executed wait and both retry cursor inputs.`,
      databaseEffect: `The cursor stayed unchanged at ${cursorAfter}; both real poll attempts used ${client.cursorInputs.map((cursor) => cursor ?? "initial").join(",")}, and no message or financial effect was stored.`,
      normalized: "The controlled rate limit emitted no financial operation.",
      processing: `Attempt 1 received a rate limit. The virtual demo clock advanced ${executedRetryAfterMs} ms. Attempt 2 used the preserved cursor and found no page.`,
      state: "retrying",
    };
  }

  if (scenario === "uncertain_event_match") {
    const messageId = await acceptAndProcess(
      scope,
      {
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
      },
      clock,
    );
    await sql`
      INSERT INTO review_items (id, scope_id, organization_id, message_id, kind)
      VALUES (
        ${`review-lab-${randomUUID()}`}, ${scope.scopeId}, ${scope.organizationId},
        ${messageId}, 'uncertain_event_match'
      )
    `;
    return undefined;
  }

  if (scenario === "incomplete_snapshot") {
    const messageId = await acceptAndProcess(
      scope,
      {
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
      },
      clock,
    );
    await sql`
      INSERT INTO review_items (id, scope_id, organization_id, message_id, kind)
      VALUES (
        ${`review-lab-${randomUUID()}`}, ${scope.scopeId}, ${scope.organizationId},
        ${messageId}, 'incomplete_snapshot'
      )
    `;
    return undefined;
  }

  if (scenario !== "provider_change") {
    return assertNever(scenario);
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
  await acceptAndProcess(
    scope,
    {
      connectionId: resources.encoreTixConnectionId,
      deliveryId: deliveryId("encore-provider-change-400"),
      externalEventId: resources.eventId,
      kind: "sale_delta",
      payload: {
        effects: [
          { amountDeltaCents: 1000000, kind: "sale", ticketDelta: 400 },
        ],
      },
      provider: "encoretix",
      sourceVersion: "2026-08-24T12:00:00.000Z",
    },
    clock,
  );
  await acceptAndProcess(
    scope,
    {
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
    },
    clock,
  );
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
  return undefined;
}

export function registerLabRoutes(
  server: FastifyInstance,
  dependencies: LabRouteDependencies = {},
): void {
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
      const runId = await startScenarioRun(scope, parsed.data);

      if (!runId) {
        throw new HttpError(401, "The lab session has expired");
      }

      try {
        const observation = await (
          dependencies.runScenarioWork ?? runScenarioWork
        )(
          scope,
          parsed.data,
          (
            dependencies.createScenarioClock ??
            (() => new VirtualScenarioClock())
          )(),
        );
        const fixture = scenarioFixtures[parsed.data];
        await saveScenarioTrace(
          scope,
          runId,
          observation?.state ?? fixture.state,
          traceFor(fixture, observation),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";

        await failScenarioRun(scope, runId, message);
        throw new HttpError(500, "Scenario execution failed");
      }
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
