import { sql } from "../src/client";

export async function seed(): Promise<void> {
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO organizations (id, slug, name)
      VALUES
        ('organization-northstar', 'northstar-presents', 'Northstar Presents'),
        ('organization-harborlight', 'harborlight-live', 'Harborlight Live')
      ON CONFLICT (id) DO UPDATE
      SET slug = EXCLUDED.slug, name = EXCLUDED.name
    `;

    await transaction`
      INSERT INTO data_scopes (scope_id, organization_id, kind)
      VALUES
        ('scope-northstar-baseline', 'organization-northstar', 'baseline'),
        ('scope-harborlight-baseline', 'organization-harborlight', 'baseline')
      ON CONFLICT (scope_id) DO UPDATE
      SET organization_id = EXCLUDED.organization_id, kind = EXCLUDED.kind
    `;

    await transaction`
      INSERT INTO provider_connections (
        id,
        scope_id,
        organization_id,
        provider,
        public_webhook_key_id
      )
      VALUES
        ('connection-northstar-encoretix', 'scope-northstar-baseline', 'organization-northstar', 'encoretix', 'whk_northstar_encoretix'),
        ('connection-northstar-venuewave', 'scope-northstar-baseline', 'organization-northstar', 'venuewave', 'whk_northstar_venuewave'),
        ('connection-northstar-boxgrid', 'scope-northstar-baseline', 'organization-northstar', 'boxgrid', 'whk_northstar_boxgrid'),
        ('connection-harborlight-encoretix', 'scope-harborlight-baseline', 'organization-harborlight', 'encoretix', 'whk_harborlight_encoretix'),
        ('connection-harborlight-venuewave', 'scope-harborlight-baseline', 'organization-harborlight', 'venuewave', 'whk_harborlight_venuewave'),
        ('connection-harborlight-boxgrid', 'scope-harborlight-baseline', 'organization-harborlight', 'boxgrid', 'whk_harborlight_boxgrid')
      ON CONFLICT (scope_id, provider) DO UPDATE
      SET public_webhook_key_id = EXCLUDED.public_webhook_key_id,
          state = 'active',
          updated_at = now()
    `;

    await transaction`
      INSERT INTO shows (
        id,
        scope_id,
        organization_id,
        name,
        venue_name,
        starts_at
      )
      VALUES
        ('show-northstar-summer-hall', 'scope-northstar-baseline', 'organization-northstar', 'Summer Hall Signal', 'Fictional Summer Hall', '2026-09-12T20:00:00.000Z'),
        ('show-harborlight-tide-room', 'scope-harborlight-baseline', 'organization-harborlight', 'Tide Room Lanterns', 'Fictional Tide Room', '2026-10-03T20:00:00.000Z')
      ON CONFLICT (scope_id, id) DO UPDATE
      SET name = EXCLUDED.name,
          venue_name = EXCLUDED.venue_name,
          starts_at = EXCLUDED.starts_at
    `;

    await transaction`
      INSERT INTO event_mappings (
        id,
        scope_id,
        organization_id,
        connection_id,
        provider,
        external_event_id,
        show_id
      )
      VALUES
        ('mapping-northstar-encoretix', 'scope-northstar-baseline', 'organization-northstar', 'connection-northstar-encoretix', 'encoretix', 'event-fictional-summer-hall', 'show-northstar-summer-hall'),
        ('mapping-harborlight-encoretix', 'scope-harborlight-baseline', 'organization-harborlight', 'connection-harborlight-encoretix', 'encoretix', 'event-fictional-tide-room', 'show-harborlight-tide-room')
      ON CONFLICT (scope_id, provider, external_event_id) DO UPDATE
      SET show_id = EXCLUDED.show_id,
          connection_id = EXCLUDED.connection_id,
          state = 'confirmed'
    `;

    await transaction`
      INSERT INTO ticket_facts (
        id,
        scope_id,
        organization_id,
        show_id,
        connection_id,
        provider,
        sold_tickets,
        gross_sales_cents,
        refunded_tickets,
        refund_cents,
        inventory_tickets,
        fee_cents,
        currency,
        source_version,
        version_rank
      )
      VALUES
        ('fact-northstar-encoretix', 'scope-northstar-baseline', 'organization-northstar', 'show-northstar-summer-hall', 'connection-northstar-encoretix', 'encoretix', 12, 36000, 0, 0, 88, 1800, 'USD', 'seed-1', 1),
        ('fact-harborlight-encoretix', 'scope-harborlight-baseline', 'organization-harborlight', 'show-harborlight-tide-room', 'connection-harborlight-encoretix', 'encoretix', 9, 22500, 0, 0, 71, 1125, 'USD', 'seed-1', 1)
      ON CONFLICT (scope_id, show_id, provider, currency) DO UPDATE
      SET sold_tickets = EXCLUDED.sold_tickets,
          gross_sales_cents = EXCLUDED.gross_sales_cents,
          refunded_tickets = EXCLUDED.refunded_tickets,
          refund_cents = EXCLUDED.refund_cents,
          inventory_tickets = EXCLUDED.inventory_tickets,
          fee_cents = EXCLUDED.fee_cents,
          source_version = EXCLUDED.source_version,
          version_rank = EXCLUDED.version_rank,
          updated_at = now()
    `;
  });
}

if (import.meta.main) {
  await seed();
  console.log("Seeded baseline scopes.");
  await sql.end();
}
