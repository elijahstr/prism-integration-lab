CREATE TABLE organizations (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE data_scopes (
  scope_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id),
  kind text NOT NULL CHECK (kind IN ('baseline', 'lab')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_id, organization_id)
);

CREATE TABLE demo_sessions (
  id text PRIMARY KEY,
  scope_id text NOT NULL,
  organization_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (scope_id, organization_id)
    REFERENCES data_scopes(scope_id, organization_id)
);

CREATE TABLE provider_connections (
  id text NOT NULL,
  scope_id text NOT NULL,
  organization_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('encoretix', 'venuewave', 'boxgrid')),
  public_webhook_key_id text NOT NULL,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'disabled')),
  poll_cursor text,
  last_successful_at timestamptz,
  recent_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_id, id),
  UNIQUE (scope_id, provider),
  FOREIGN KEY (scope_id, organization_id)
    REFERENCES data_scopes(scope_id, organization_id)
);

CREATE TABLE shows (
  id text NOT NULL,
  scope_id text NOT NULL,
  organization_id text NOT NULL,
  name text NOT NULL,
  venue_name text NOT NULL,
  starts_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_id, id),
  FOREIGN KEY (scope_id, organization_id)
    REFERENCES data_scopes(scope_id, organization_id)
);

CREATE TABLE event_mappings (
  id text NOT NULL,
  scope_id text NOT NULL,
  organization_id text NOT NULL,
  connection_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('encoretix', 'venuewave', 'boxgrid')),
  external_event_id text NOT NULL,
  show_id text NOT NULL,
  state text NOT NULL DEFAULT 'confirmed' CHECK (state IN ('confirmed', 'needs_review')),
  confidence numeric(5, 4),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_id, id),
  UNIQUE (scope_id, provider, external_event_id),
  FOREIGN KEY (scope_id, organization_id)
    REFERENCES data_scopes(scope_id, organization_id),
  FOREIGN KEY (scope_id, connection_id)
    REFERENCES provider_connections(scope_id, id),
  FOREIGN KEY (scope_id, show_id)
    REFERENCES shows(scope_id, id)
);

CREATE TABLE ingestion_messages (
  id text NOT NULL,
  scope_id text NOT NULL,
  organization_id text NOT NULL,
  connection_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('encoretix', 'venuewave', 'boxgrid')),
  delivery_id text NOT NULL,
  external_event_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('sale_delta', 'refund_delta', 'inventory_delta', 'snapshot')),
  source_occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  source_version text NOT NULL,
  version_rank bigint,
  checksum text NOT NULL,
  payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'received',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_id, id),
  UNIQUE (id),
  UNIQUE (scope_id, provider, delivery_id),
  FOREIGN KEY (scope_id, organization_id)
    REFERENCES data_scopes(scope_id, organization_id),
  FOREIGN KEY (scope_id, connection_id)
    REFERENCES provider_connections(scope_id, id)
);

CREATE TABLE ingestion_outbox (
  id text PRIMARY KEY,
  scope_id text NOT NULL,
  organization_id text NOT NULL,
  message_id text NOT NULL,
  dispatch_attempts integer NOT NULL DEFAULT 0 CHECK (dispatch_attempts >= 0),
  last_claimed_at timestamptz,
  dispatched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id),
  FOREIGN KEY (scope_id, organization_id)
    REFERENCES data_scopes(scope_id, organization_id),
  FOREIGN KEY (scope_id, message_id)
    REFERENCES ingestion_messages(scope_id, id)
);

CREATE TABLE normalized_effects (
  id text NOT NULL,
  scope_id text NOT NULL,
  organization_id text NOT NULL,
  message_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('encoretix', 'venuewave', 'boxgrid')),
  operation_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('sale', 'refund', 'fee', 'inventory')),
  ticket_delta integer NOT NULL DEFAULT 0,
  amount_delta_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL CHECK (currency = 'USD'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_id, id),
  UNIQUE (scope_id, provider, operation_key),
  FOREIGN KEY (scope_id, organization_id)
    REFERENCES data_scopes(scope_id, organization_id),
  FOREIGN KEY (scope_id, message_id)
    REFERENCES ingestion_messages(scope_id, id)
);

CREATE TABLE ticket_facts (
  id text NOT NULL,
  scope_id text NOT NULL,
  organization_id text NOT NULL,
  show_id text NOT NULL,
  connection_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('encoretix', 'venuewave', 'boxgrid')),
  sold_tickets integer NOT NULL DEFAULT 0 CHECK (sold_tickets >= 0),
  gross_sales_cents bigint NOT NULL DEFAULT 0,
  refunded_tickets integer NOT NULL DEFAULT 0 CHECK (refunded_tickets >= 0),
  refund_cents bigint NOT NULL DEFAULT 0,
  inventory_tickets integer NOT NULL DEFAULT 0 CHECK (inventory_tickets >= 0),
  fee_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL CHECK (currency = 'USD'),
  source_version text NOT NULL,
  version_rank bigint,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_id, id),
  UNIQUE (scope_id, show_id, provider, currency),
  FOREIGN KEY (scope_id, organization_id)
    REFERENCES data_scopes(scope_id, organization_id),
  FOREIGN KEY (scope_id, show_id)
    REFERENCES shows(scope_id, id),
  FOREIGN KEY (scope_id, connection_id)
    REFERENCES provider_connections(scope_id, id)
);

CREATE TABLE snapshot_staging (
  id text NOT NULL,
  scope_id text NOT NULL,
  organization_id text NOT NULL,
  message_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('encoretix', 'venuewave', 'boxgrid')),
  external_event_id text NOT NULL,
  version_rank bigint NOT NULL,
  payload jsonb NOT NULL,
  complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_id, id),
  UNIQUE (scope_id, message_id),
  FOREIGN KEY (scope_id, organization_id)
    REFERENCES data_scopes(scope_id, organization_id),
  FOREIGN KEY (scope_id, message_id)
    REFERENCES ingestion_messages(scope_id, id)
);

CREATE TABLE reconciliation_runs (
  id text NOT NULL,
  scope_id text NOT NULL,
  organization_id text NOT NULL,
  message_id text,
  state text NOT NULL CHECK (state IN ('pending', 'completed', 'needs_review')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_id, id),
  FOREIGN KEY (scope_id, organization_id)
    REFERENCES data_scopes(scope_id, organization_id),
  FOREIGN KEY (scope_id, message_id)
    REFERENCES ingestion_messages(scope_id, id)
);

CREATE TABLE review_items (
  id text NOT NULL,
  scope_id text NOT NULL,
  organization_id text NOT NULL,
  message_id text,
  reconciliation_run_id text,
  kind text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'approved', 'rejected')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  PRIMARY KEY (scope_id, id),
  FOREIGN KEY (scope_id, organization_id)
    REFERENCES data_scopes(scope_id, organization_id),
  FOREIGN KEY (scope_id, message_id)
    REFERENCES ingestion_messages(scope_id, id),
  FOREIGN KEY (scope_id, reconciliation_run_id)
    REFERENCES reconciliation_runs(scope_id, id)
);

CREATE TABLE scenario_runs (
  id text NOT NULL,
  scope_id text NOT NULL,
  organization_id text NOT NULL,
  scenario text NOT NULL CHECK (scenario IN ('duplicate_webhook', 'late_update', 'provider_outage', 'rate_limit', 'uncertain_event_match', 'incomplete_snapshot', 'provider_change')),
  state text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_id, id),
  FOREIGN KEY (scope_id, organization_id)
    REFERENCES data_scopes(scope_id, organization_id)
);

CREATE TABLE trace_steps (
  id text NOT NULL,
  scope_id text NOT NULL,
  organization_id text NOT NULL,
  scenario_run_id text NOT NULL,
  step_order integer NOT NULL CHECK (step_order >= 0),
  state text NOT NULL,
  title text NOT NULL,
  explanation text NOT NULL,
  database_effect text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_id, id),
  UNIQUE (scope_id, scenario_run_id, step_order),
  FOREIGN KEY (scope_id, organization_id)
    REFERENCES data_scopes(scope_id, organization_id),
  FOREIGN KEY (scope_id, scenario_run_id)
    REFERENCES scenario_runs(scope_id, id)
);

CREATE TABLE audit_entries (
  id text NOT NULL,
  scope_id text NOT NULL,
  organization_id text NOT NULL,
  message_id text,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_id, id),
  FOREIGN KEY (scope_id, organization_id)
    REFERENCES data_scopes(scope_id, organization_id),
  FOREIGN KEY (scope_id, message_id)
    REFERENCES ingestion_messages(scope_id, id)
);

CREATE INDEX ingestion_outbox_pending_idx
  ON ingestion_outbox (created_at)
  WHERE dispatched_at IS NULL;

CREATE INDEX demo_sessions_active_idx
  ON demo_sessions (scope_id, expires_at)
  WHERE state = 'active';

CREATE INDEX provider_connections_cursor_idx
  ON provider_connections (scope_id, provider, poll_cursor)
  WHERE poll_cursor IS NOT NULL;

CREATE INDEX audit_entries_recent_idx
  ON audit_entries (scope_id, created_at DESC);

CREATE INDEX review_items_pending_idx
  ON review_items (scope_id, created_at)
  WHERE state = 'pending';
