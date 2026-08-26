export const PLAN_FIGURES: Record<string, string> = {
  "teaching-flow-delivery": `
<figure class="fig plan-figure" data-figure="teaching-flow-delivery">
  <figcaption class="figcap"><span class="fignum">FIG 1</span><span class="figtitle">Task dependency and verification gate</span></figcaption>
  <div class="pr-track">
    <div class="pr-item"><span>Task 1</span><strong>Lesson contract and route state</strong><small>pure data and URL tests</small></div>
    <div class="pr-link">→</div>
    <div class="pr-item"><span>Task 2</span><strong>Focused lesson modules</strong><small>static render test</small></div>
    <div class="pr-link">→</div>
    <div class="pr-item"><span>Task 3</span><strong>Dashboard history integration</strong><small>state and type checks</small></div>
    <div class="pr-link">→</div>
    <div class="pr-item"><span>Task 4</span><strong>Prism-purple layout</strong><small>responsive component check</small></div>
    <div class="pr-link">→</div>
    <div class="pr-item"><span>Task 5</span><strong>Browser proof</strong><small>seven scenarios and lesson flow</small></div>
  </div>
  <div class="topology plan-figure">
    <div class="topology-boundary"><strong>Task 6: simplify and verify</strong><div class="topology-row"><div class="topology-node accent"><strong>Focused tests</strong><span>data, state, component, browser</span></div><span class="topology-arrow">→</span><div class="topology-node accent"><strong>Full verification</strong><span>format, type, unit, build, browser</span></div><span class="topology-arrow">→</span><div class="topology-node"><strong>One independent review</strong><span>triage once, no automatic loop</span></div></div></div>
  </div>
  <p class="figfoot">Task 1 provides the contract. Tasks 2 through 5 consume it in order. Task 6 is the final verification gate.</p>
</figure>`,
};
