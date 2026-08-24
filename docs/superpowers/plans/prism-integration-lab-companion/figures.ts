export const PLAN_FIGURES: Record<string, string> = {
  "free-public-topology": `
<figure class="fig plan-figure" data-figure="free-public-topology">
  <figcaption class="figcap"><span class="fignum">FIG 1</span><span class="figtitle">Free deployment packaging</span></figcaption>
  <div class="topology">
    <div class="topology-external">
      <div class="topology-node"><strong>Neon Free</strong><span>PostgreSQL</span></div>
      <div class="topology-node"><strong>Upstash Free</strong><span>persistent Redis-compatible storage</span></div>
    </div>
    <div class="topology-arrows"><span>↗</span><span>↖</span></div>
    <div class="topology-boundary">
      <strong>one free Render web service</strong>
      <div class="topology-row">
        <div class="topology-node accent"><strong>static web build</strong><span>Next.js static export</span></div>
        <div class="topology-arrow">→</div>
        <div class="topology-node accent"><strong>Fastify API</strong><span>one Render web process</span></div>
        <div class="topology-arrow">↔</div>
        <div class="topology-node accent"><strong>BullMQ worker</strong><span>one failure boundary</span></div>
      </div>
    </div>
  </div>
  <p class="figfoot">The public demo uses one free Render web service.</p>
</figure>`,
  "three-pr-sequence": `
<figure class="fig plan-figure" data-figure="three-pr-sequence">
  <figcaption class="figcap"><span class="fignum">FIG 2</span><span class="figtitle">PR Packaging</span></figcaption>
  <div class="pr-track">
    <div class="pr-item"><span>PR 1</span><strong>Foundation and durable ingestion core</strong><small>Tasks 1 through 4</small></div>
    <div class="pr-link">→</div>
    <div class="pr-item"><span>PR 2</span><strong>Provider transports and lab scenarios</strong><small>Tasks 5 and 6</small></div>
    <div class="pr-link">→</div>
    <div class="pr-item"><span>PR 3</span><strong>Dashboard and free public deployment</strong><small>Tasks 7 and 8</small></div>
  </div>
  <p class="figfoot">Each later branch depends on the previous branch.</p>
</figure>`,
};
