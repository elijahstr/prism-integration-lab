# Prism Integration Lab

## Live demo

Provisioning has not started. The future public service will use the Render
`onrender.com` address. Wait for the first page before you start the demo.
Free Render web services sleep after inactivity. Open the page one minute
before a presentation to warm the process.

## Five-minute walkthrough

1. Open the Integration Lab page.
2. Run Duplicate webhook to show one immutable effect.
3. Run Provider outage to show preserved work and retry evidence.
4. Run Uncertain event match to show the human-review boundary.
5. Run Incomplete snapshot to show safe staging.
6. Run Provider change to show the 400 plus 600 provider-scoped total.

Each browser receives a separate temporary data scope. The trace shows the
input, processing decision, normalized result, database effect, and audit
evidence for its selected scenario.

## Local use

Create `.env` from `.env.example`. Use local values only. Do not commit the
file or production secrets.

```sh
docker compose up -d postgres redis
bun run db:migrate
bun run db:seed
bun run verify
bun run build
bun run test:e2e
```

The public entry point runs idempotent migrations and baseline seeding before
it accepts traffic. Start it locally with `bun run scripts/start-public.ts`.
Use `/health` for process liveness. Use `/ready` to check PostgreSQL and Redis.

## Render provisioning

The Blueprint declares one free Node web service. Set these values in Render
before the first deployment: `DATABASE_URL`, `REDIS_URL`, `LAB_TOKEN_PEPPER`,
and `PROVIDER_KEY_MASTER_SECRET`. The Blueprint does not store their values.

The public process serves the static dashboard and API from one origin. It
also runs one BullMQ worker. It catches up on outbox and expiry work at startup
and every 15 seconds. The worker uses a 30-second idle delay to reduce Redis
commands.

This service is a demonstration. Free service sleep, shared-process failure,
and managed-service quota limits reduce availability. The durable PostgreSQL
outbox prevents accepted work from depending only on Redis publication.
