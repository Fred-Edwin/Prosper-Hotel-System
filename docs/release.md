# Release — Prosper Hotel

## Tier: direct-to-prod, per-merge

No staging environment (see `docs/architecture.md`'s "Environments and
deployment" — one host, application and database together; a solo developer
and an environment nobody looks at is cost without benefit). Every merge to
`main` is a release. There is no separate promotion step, no approval gate,
no batching.

## What happens on merge

`.github/workflows/deploy.yml` runs on every push to `main`:

1. Builds two Docker images (app, and a migrate-only image from the
   `builder` stage), tagged with the commit SHA and pushed to
   `ghcr.io/fred-edwin/prosper-hotel`.
2. Syncs `docker-compose.prod.yml` and `Caddyfile` to the droplet over SCP
   — **these files are not otherwise live** on the droplet; editing them in
   the repo without this step has no effect (see `docs/gotchas.md`).
3. SSHes in, runs `prisma migrate deploy` via the migrate image against the
   production database, then `docker compose up -d --no-deps app` to swap
   the running container.

No manual step in `/release` beyond confirming the workflow went green and
the app responds — this is the "near-no-op confirmation" tier.

## Rollback

Full procedure: `docs/architecture.md` → "Rollback". Summary: every image
is SHA-tagged, so rolling back is re-running `docker compose up -d --no-deps
app` against a prior `APP_IMAGE` — a few seconds, no database touch.
**Migrations are not rolled back** — they must be backward-compatible by
convention (old code must run against the new schema), so a plain image
rollback is expected to be enough in the overwhelming majority of cases.

## Backups

Daily `pg_dump` via cron on the droplet, 14-day local retention. Full
detail and the known gap (no off-site copy yet): `docs/architecture.md` →
"Backups".

## Observability

Sentry via `@sentry/nextjs`, wired through `instrumentation.ts` /
`instrumentation-client.ts`. Full detail: `docs/architecture.md` →
"Observability". If a release causes errors, they should appear in Sentry
before the client notices.

## Secrets

Every secret this pipeline depends on (`DEPLOY_HOST`, `DEPLOY_SSH_KEY`,
`GHCR_TOKEN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `POSTGRES_PASSWORD`) and
how to rotate it: `docs/infrastructure.md`.

## When this changes

If a staging tier or approval gate is ever introduced, this file is what
changes, and `/release` starts reading a different tier from it — see
`.claude/skills/release/SKILL.md`. Until then, `/release` should find
nothing to do beyond confirming the automatic pipeline succeeded.
