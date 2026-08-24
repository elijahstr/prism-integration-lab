export const FIGURES: Record<string, string> = {
  "ingestion-architecture": `
<figure class="fig" data-figure="ingestion-architecture">
  <figcaption class="figcap"><span class="fignum">FIG 1</span><span class="figtitle">Durable shared processing pipeline</span><span class="figsub">different transports, one financial model</span></figcaption>
  <div class="flow">
    <div class="flow-node good"><strong>Fictional providers</strong><span>Webhook · polling · snapshot</span></div><div class="arrow">→</div>
    <div class="flow-node accent"><strong>Fastify API</strong><span>Verify · identify tenant · save raw input</span></div><div class="arrow">→</div>
    <div class="flow-node accent"><strong>BullMQ worker</strong><span>Deduplicate · order · validate · adapt</span></div><div class="arrow">→</div>
    <div class="flow-node"><strong>PostgreSQL</strong><span>Mappings · facts · reviews · audit</span></div><div class="arrow">→</div>
    <div class="flow-node"><strong>Next.js</strong><span>Dashboard · lab · explanations</span></div>
  </div>
</figure>`,
  "provider-strategies": `
<figure class="fig" data-figure="provider-strategies">
  <figcaption class="figcap"><span class="fignum">FIG 2</span><span class="figtitle">Provider transport decisions</span><span class="figsub">the API capability selects the edge pattern</span></figcaption>
  <div class="three">
    <div class="strategy"><h4>EncoreTix · push</h4><p><b>Signed webhooks</b> for low delay.</p><p>Scheduled reconciliation finds missed delivery.</p></div>
    <div class="strategy"><h4>VenueWave · pull</h4><p><b>Cursor polling</b> for an API with no webhook.</p><p>Commit the cursor only after a durable page.</p></div>
    <div class="strategy"><h4>BoxGrid · compare</h4><p><b>Complete snapshots</b> for state correction.</p><p>Validate in staging, then apply one transaction.</p></div>
  </div>
</figure>`,
  "data-model": `
<figure class="fig" data-figure="data-model">
  <figcaption class="figcap"><span class="fignum">FIG 3</span><span class="figtitle">Audit-first data model</span><span class="figsub">source evidence stays separate from derived financial state</span></figcaption>
  <div class="entity-grid">
    <div class="entity"><strong>Organizations + sessions</strong><span>Tenant and visitor isolation</span></div>
    <div class="entity"><strong>Connections + shows</strong><span>Provider state and Prism events</span></div>
    <div class="entity"><strong>Event mappings</strong><span>External identity to Prism show</span></div>
    <div class="entity"><strong>Ingestion messages</strong><span>Immutable envelope and raw payload</span></div>
    <div class="entity"><strong>Ticket facts</strong><span>Provider-scoped current financial state</span></div>
    <div class="entity"><strong>Reviews + audit</strong><span>Differences, decisions, and replay evidence</span></div>
  </div>
</figure>`,
  "processing-states": `
<figure class="fig" data-figure="processing-states">
  <figcaption class="figcap"><span class="fignum">FIG 4</span><span class="figtitle">Message state machine</span><span class="figsub">every exit is visible and explainable</span></figcaption>
  <div class="state-row">
    <span class="state">received</span><span class="arrow">→</span><span class="state">queued</span><span class="arrow">→</span><span class="state">processing</span><span class="arrow">→</span><span class="state">applied</span>
    <span class="arrow">↘</span><span class="state alt">duplicate</span><span class="state alt">ignored_old</span><span class="state alt">needs_review</span><span class="state alt">retrying</span><span class="state alt">failed</span>
  </div>
</figure>`,
};
