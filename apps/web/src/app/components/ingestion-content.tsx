export function IngestionContent() {
  return (
    <div className="story-grid">
      <section className="panel story-lead">
        <p className="eyebrow">One shared pipeline</p>
        <h2>Change the edge, not the safety rules.</h2>
        <p>
          Each provider creates the same envelope. Prism saves it first, then
          queues normalization. The provider transport can change without
          bypassing audit, mapping, or review.
        </p>
      </section>
      <section className="panel">
        <p className="eyebrow">1. Signed webhook</p>
        <h2>EncoreTix</h2>
        <p>
          Fast delivery supports sale and refund updates. Signature checks,
          replay windows, duplicate keys, and snapshot reconciliation control
          late or repeated messages.
        </p>
      </section>
      <section className="panel">
        <p className="eyebrow">2. Incremental poll</p>
        <h2>VenueWave</h2>
        <p>
          The worker writes a page before it advances its cursor. Rate limits
          retain that cursor, then exponential backoff schedules another safe
          attempt.
        </p>
      </section>
      <section className="panel">
        <p className="eyebrow">3. Complete snapshot</p>
        <h2>BoxGrid</h2>
        <p>
          The system validates a complete provider snapshot in staging. A
          partial snapshot does not replace current facts.
        </p>
      </section>
      <section className="panel full-width">
        <p className="eyebrow">Durable recovery</p>
        <h2>Transactional outbox and at-least-once work</h2>
        <p>
          The database stores a provider message and an outbox record in one
          transaction. A worker can retry the outbox after a process failure.
          The queue is at-least-once, which means a job can arrive more than
          once. Delivery keys and source versions make duplicate processing
          safe; the design does not claim exactly once.
        </p>
      </section>
      <section className="panel full-width callout">
        <p className="eyebrow">Provider scope matters</p>
        <h2>400 + 600 = 1,000</h2>
        <p>
          EncoreTix sells 400 tickets before a provider change. BoxGrid then
          sends a complete BoxGrid snapshot for 600 tickets. The snapshot
          applies only to BoxGrid. Prism keeps both provider facts, so the show
          total is 1,000. Replacing the full show total with 600 would delete
          the earlier EncoreTix sales.
        </p>
      </section>
    </div>
  );
}
