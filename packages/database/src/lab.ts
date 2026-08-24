import { createHmac, randomBytes, randomUUID } from "node:crypto";

import type { ScenarioId, TraceStep } from "@prism/contracts";

import { sql, type TransactionSql } from "./client";
import type { Scope } from "./scope";

const labSessionDurationMs = 60 * 60 * 1_000;

type Organization = { id: string };
type BaselineScope = { scopeId: string };
type ScenarioRunRow = {
  id: string;
  scenario: ScenarioId;
  state: string;
};
type TraceRow = {
  databaseEffect: string;
  explanation: string;
  order: number;
  state: string;
  title: string;
};

export type LabSession = Scope & {
  expiresAt: Date;
  token: string;
};

export type StoredScenarioRun = ScenarioRunRow & { trace: TraceStep[] };

function hashLabToken(token: string): string {
  const pepper = process.env.LAB_TOKEN_PEPPER;

  if (!pepper) {
    throw new Error("LAB_TOKEN_PEPPER is required");
  }

  return createHmac("sha256", pepper).update(token).digest("hex");
}

async function baselineScope(
  transaction: TransactionSql,
  organizationId: string,
): Promise<string> {
  const scopes = await transaction<BaselineScope[]>`
    SELECT scope_id AS "scopeId"
    FROM data_scopes
    WHERE organization_id = ${organizationId}
      AND kind = 'baseline'
    ORDER BY scope_id
    LIMIT 1
  `;
  const scope = scopes[0];

  if (!scope) {
    throw new Error("The organization has no baseline scope");
  }

  return scope.scopeId;
}

async function copyBaseline(
  transaction: TransactionSql,
  scope: Scope,
  sourceScopeId: string,
): Promise<void> {
  await transaction`
    INSERT INTO provider_connections (
      id, scope_id, organization_id, provider, public_webhook_key_id, state,
      poll_cursor, last_successful_at, recent_error
    )
    SELECT
      ${`${scope.scopeId}:`} || id, ${scope.scopeId}, ${scope.organizationId}, provider,
      public_webhook_key_id || ':' || ${scope.scopeId}, state, poll_cursor,
      last_successful_at, recent_error
    FROM provider_connections
    WHERE scope_id = ${sourceScopeId}
  `;
  await transaction`
    INSERT INTO shows (id, scope_id, organization_id, name, venue_name, starts_at)
    SELECT ${`${scope.scopeId}:`} || id, ${scope.scopeId}, ${scope.organizationId},
      name, venue_name, starts_at
    FROM shows
    WHERE scope_id = ${sourceScopeId}
  `;
  await transaction`
    INSERT INTO event_mappings (
      id, scope_id, organization_id, connection_id, provider, external_event_id,
      show_id, state, confidence
    )
    SELECT
      ${`${scope.scopeId}:`} || id, ${scope.scopeId}, ${scope.organizationId},
      ${`${scope.scopeId}:`} || connection_id, provider, external_event_id,
      ${`${scope.scopeId}:`} || show_id, state, confidence
    FROM event_mappings
    WHERE scope_id = ${sourceScopeId}
  `;
  await transaction`
    INSERT INTO ticket_facts (
      id, scope_id, organization_id, show_id, connection_id, provider,
      sold_tickets, gross_sales_cents, refunded_tickets, refund_cents,
      inventory_tickets, fee_cents, currency, source_version, version_rank
    )
    SELECT
      ${`${scope.scopeId}:`} || id, ${scope.scopeId}, ${scope.organizationId},
      ${`${scope.scopeId}:`} || show_id, ${`${scope.scopeId}:`} || connection_id,
      provider, sold_tickets, gross_sales_cents, refunded_tickets,
      refund_cents, inventory_tickets, fee_cents, currency, source_version,
      version_rank
    FROM ticket_facts
    WHERE scope_id = ${sourceScopeId}
  `;
}

async function clearScopeData(
  transaction: TransactionSql,
  scope: Scope,
): Promise<void> {
  await transaction`DELETE FROM audit_entries WHERE scope_id = ${scope.scopeId}`;
  await transaction`DELETE FROM review_items WHERE scope_id = ${scope.scopeId}`;
  await transaction`DELETE FROM reconciliation_runs WHERE scope_id = ${scope.scopeId}`;
  await transaction`DELETE FROM trace_steps WHERE scope_id = ${scope.scopeId}`;
  await transaction`DELETE FROM scenario_runs WHERE scope_id = ${scope.scopeId}`;
  await transaction`DELETE FROM snapshot_staging WHERE scope_id = ${scope.scopeId}`;
  await transaction`DELETE FROM normalized_effects WHERE scope_id = ${scope.scopeId}`;
  await transaction`DELETE FROM ingestion_outbox WHERE scope_id = ${scope.scopeId}`;
  await transaction`DELETE FROM ingestion_messages WHERE scope_id = ${scope.scopeId}`;
  await transaction`DELETE FROM event_mappings WHERE scope_id = ${scope.scopeId}`;
  await transaction`DELETE FROM ticket_facts WHERE scope_id = ${scope.scopeId}`;
  await transaction`DELETE FROM shows WHERE scope_id = ${scope.scopeId}`;
  await transaction`DELETE FROM provider_connections WHERE scope_id = ${scope.scopeId}`;
}

export async function createLabSession(
  organizationSlug: string,
): Promise<LabSession | null> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + labSessionDurationMs);

  return sql.begin(async (transaction) => {
    const organizations = await transaction<Organization[]>`
      SELECT id
      FROM organizations
      WHERE slug = ${organizationSlug}
    `;
    const organization = organizations[0];

    if (!organization) {
      return null;
    }

    const scope: Scope = {
      organizationId: organization.id,
      scopeId: `scope-lab-${randomUUID()}`,
    };
    const sourceScopeId = await baselineScope(
      transaction,
      scope.organizationId,
    );

    await transaction`
      INSERT INTO data_scopes (scope_id, organization_id, kind)
      VALUES (${scope.scopeId}, ${scope.organizationId}, 'lab')
    `;
    await copyBaseline(transaction, scope, sourceScopeId);
    await transaction`
      INSERT INTO demo_sessions (id, scope_id, organization_id, token_hash, expires_at)
      VALUES (
        ${`session-lab-${randomUUID()}`},
        ${scope.scopeId},
        ${scope.organizationId},
        ${hashLabToken(token)},
        ${expiresAt.toISOString()}
      )
    `;

    return { ...scope, expiresAt, token };
  });
}

export async function startScenarioRun(
  scope: Scope,
  scenario: ScenarioId,
): Promise<string | null> {
  const id = `run-lab-${randomUUID()}`;

  return sql.begin(async (transaction) => {
    const sessions = await transaction`
      SELECT 1
      FROM demo_sessions
      WHERE scope_id = ${scope.scopeId}
        AND organization_id = ${scope.organizationId}
        AND state = 'active'
        AND expires_at > now()
      FOR UPDATE
    `;

    if (sessions.length !== 1) {
      return null;
    }

    await transaction`
      INSERT INTO scenario_runs (id, scope_id, organization_id, scenario, state)
      VALUES (${id}, ${scope.scopeId}, ${scope.organizationId}, ${scenario}, 'running')
    `;

    return id;
  });
}

export async function failScenarioRun(
  scope: Scope,
  runId: string,
  error: string,
): Promise<void> {
  await sql.begin(async (transaction) => {
    const runs = await transaction`
      SELECT 1 FROM scenario_runs
      WHERE id = ${runId}
        AND scope_id = ${scope.scopeId}
        AND organization_id = ${scope.organizationId}
        AND state = 'running'
      FOR UPDATE
    `;

    if (runs.length !== 1) return;

    await transaction`
      INSERT INTO audit_entries (id, scope_id, organization_id, action, details)
      VALUES (
        ${`audit-lab-${randomUUID()}`}, ${scope.scopeId},
        ${scope.organizationId}, 'scenario_failed', ${transaction.json({ error })}
      )
    `;
    await transaction`
      INSERT INTO trace_steps (
        id, scope_id, organization_id, scenario_run_id, step_order, state,
        title, explanation, database_effect
      )
      VALUES (
        ${`trace-lab-${randomUUID()}`}, ${scope.scopeId},
        ${scope.organizationId}, ${runId}, 99, 'failed',
        'Scenario failure', 'The lab stopped after a controlled scenario failure.',
        'The run is marked failed, so it no longer holds an expiry lease.'
      )
      ON CONFLICT (scope_id, scenario_run_id, step_order) DO NOTHING
    `;
    await transaction`
      UPDATE scenario_runs SET state = 'failed'
      WHERE id = ${runId}
        AND scope_id = ${scope.scopeId}
        AND organization_id = ${scope.organizationId}
    `;
  });
}

export async function saveScenarioTrace(
  scope: Scope,
  runId: string,
  state: string,
  trace: TraceStep[],
): Promise<void> {
  await sql.begin(async (transaction) => {
    const runs = await transaction`
      SELECT 1
      FROM scenario_runs
      WHERE id = ${runId}
        AND scope_id = ${scope.scopeId}
        AND organization_id = ${scope.organizationId}
      FOR UPDATE
    `;

    if (runs.length !== 1) {
      throw new Error("Scenario run does not belong to the lab scope");
    }

    for (const step of trace) {
      await transaction`
        INSERT INTO trace_steps (
          id, scope_id, organization_id, scenario_run_id, step_order, state,
          title, explanation, database_effect
        )
        VALUES (
          ${`trace-lab-${randomUUID()}`}, ${scope.scopeId},
          ${scope.organizationId}, ${runId}, ${step.order}, ${step.state},
          ${step.title}, ${step.explanation}, ${step.databaseEffect}
        )
      `;
    }
    await transaction`
      UPDATE scenario_runs
      SET state = ${state}
      WHERE id = ${runId}
        AND scope_id = ${scope.scopeId}
        AND organization_id = ${scope.organizationId}
    `;
  });
}

export async function readScenarioRun(
  scope: Scope,
  runId: string,
): Promise<StoredScenarioRun | null> {
  const runs = await sql<ScenarioRunRow[]>`
    SELECT id, scenario, state
    FROM scenario_runs
    WHERE id = ${runId}
      AND scope_id = ${scope.scopeId}
      AND organization_id = ${scope.organizationId}
  `;
  const run = runs[0];

  if (!run) {
    return null;
  }

  const trace = await sql<TraceRow[]>`
    SELECT
      step_order AS "order", state, title, explanation,
      database_effect AS "databaseEffect"
    FROM trace_steps
    WHERE scenario_run_id = ${runId}
      AND scope_id = ${scope.scopeId}
      AND organization_id = ${scope.organizationId}
    ORDER BY step_order
  `;

  return { ...run, trace };
}

export async function resetLabScope(scope: Scope): Promise<boolean> {
  return sql.begin(async (transaction) => {
    const labs = await transaction`
      SELECT 1
      FROM data_scopes
      WHERE scope_id = ${scope.scopeId}
        AND organization_id = ${scope.organizationId}
        AND kind = 'lab'
      FOR UPDATE
    `;

    if (labs.length !== 1) {
      return false;
    }

    await clearScopeData(transaction, scope);
    await copyBaseline(
      transaction,
      scope,
      await baselineScope(transaction, scope.organizationId),
    );
    return true;
  });
}

export async function resetScenarioRun(
  scope: Scope,
  runId: string,
): Promise<boolean> {
  const ownedRuns = await sql`
    SELECT 1
    FROM scenario_runs
    WHERE id = ${runId}
      AND scope_id = ${scope.scopeId}
      AND organization_id = ${scope.organizationId}
  `;

  if (ownedRuns.length !== 1) {
    return false;
  }

  return resetLabScope(scope);
}

export async function expireLabSessions(): Promise<number> {
  return sql.begin(async (transaction) => {
    await transaction`
      UPDATE demo_sessions
      SET state = 'expired'
      WHERE state = 'active'
        AND expires_at <= now()
        AND scope_id IN (
          SELECT scope_id FROM data_scopes WHERE kind = 'lab'
        )
    `;
    const expired = await transaction<Scope[]>`
      SELECT demo_sessions.scope_id AS "scopeId",
        demo_sessions.organization_id AS "organizationId"
      FROM demo_sessions
      JOIN data_scopes
        ON data_scopes.scope_id = demo_sessions.scope_id
        AND data_scopes.organization_id = demo_sessions.organization_id
      WHERE demo_sessions.state = 'expired'
        AND data_scopes.kind = 'lab'
      FOR UPDATE OF demo_sessions
    `;
    let deleted = 0;

    for (const scope of expired) {
      const activeJobs = await transaction`
        SELECT 1
        FROM ingestion_messages
        WHERE scope_id = ${scope.scopeId}
          AND state IN ('received', 'queued', 'processing')
        LIMIT 1
      `;

      if (activeJobs.length !== 0) {
        continue;
      }

      const activeRuns = await transaction`
        SELECT 1
        FROM scenario_runs
        WHERE scope_id = ${scope.scopeId}
          AND state = 'running'
        LIMIT 1
      `;

      if (activeRuns.length !== 0) {
        continue;
      }

      await transaction`DELETE FROM demo_sessions WHERE scope_id = ${scope.scopeId}`;
      await clearScopeData(transaction, scope);
      await transaction`
        DELETE FROM data_scopes
        WHERE scope_id = ${scope.scopeId}
          AND organization_id = ${scope.organizationId}
          AND kind = 'lab'
      `;
      deleted += 1;
    }

    return deleted;
  });
}
