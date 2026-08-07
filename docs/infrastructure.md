# Infrastructure

Every credential, secret, and access path this project depends on: what it's
for, where it lives, and how to rotate or recover it. `docs/architecture.md`
explains *why* the infra is shaped this way; this is the *operational*
reference — what to touch, in an emergency or a routine rotation.

Nothing here is a secret value. If you're reading this and need an actual
value, get it from the source listed, not from this file.

---

## Accounts that own this

| Account | Owns | Notes |
|---|---|---|
| GitHub — `Fred-Edwin` | Repo (`Fred-Edwin/Prosper-Hotel-System`), GHCR image registry, Actions secrets | Personal account, not an org |
| DigitalOcean | The `prosper-hotel` droplet | Billed to Lobster Technologies (the developer's own company — see below) |
| Sentry | Org "Freddie Software Solutions", project "javascript-nextjs" | Client (the user) signed up for this personally |
| Namecheap/registrar (or wherever `lobstertechnologies.co.ke` is registered) | The domain the subdomain hangs off | Owned by the developer, not the client — client's own domain is a future move, see below |

**`lobstertechnologies.co.ke` is the developer's own company domain**,
temporarily hosting this client's subdomain
(`prosper-hotel.lobstertechnologies.co.ke`) until the client buys her own.
When that happens, only the Caddyfile's domain line and the DNS record
change — nothing in the app needs to know its own hostname.

---

## Droplet

| | |
|---|---|
| Name | `prosper-hotel` |
| IP | `159.89.101.174` |
| Region | Frankfurt |
| OS | Ubuntu 24.04 |
| Provisioned | Dedicated to this client — deliberately not sharing the pre-existing `wendo-droplet` (104.248.29.42), which runs an unrelated client's stack with limited headroom. See `docs/gotchas.md`. |

### SSH access

Two aliases in `~/.ssh/config` on the developer's machine:

```
Host prosper-hotel-prod
  HostName 159.89.101.174
  User root
  IdentityFile ~/.ssh/wendo_droplet

Host prosper-hotel-deploy
  HostName 159.89.101.174
  User deploy
  IdentityFile ~/.ssh/wendo_droplet
```

**The identity file is named `wendo_droplet` but authenticates to this
(unrelated) droplet too** — it's a reused personal SSH key, not a
per-project one. If it's ever rotated or revoked for the `wendo` project,
`prosper-hotel` access breaks too, silently, until someone tries to deploy.
Worth giving `prosper-hotel` its own key pair at some point — low urgency
today, real gotcha if the shared key is ever rotated without checking who
else depends on it first.

- `prosper-hotel-prod` (root) — full box access: OS-level changes, Docker
  daemon, firewall. Use sparingly.
- `prosper-hotel-deploy` (deploy user) — what the GitHub Actions deploy step
  uses, and what you should use for anything routine (checking logs,
  running the backup script by hand, inspecting the running containers).

**Recovering access if the key is lost:** DigitalOcean's web console
(browser-based, bypasses SSH) can add a new public key to
`~/.ssh/authorized_keys` for both users. Already used once this way — see
`docs/gotchas.md`'s note on the SSH key mismatch during initial setup.

### What's on the droplet

Everything under `~/prosper-hotel` (as the `deploy` user):

| Path | What | Set by |
|---|---|---|
| `docker-compose.prod.yml` | Compose file — synced from the repo on every deploy | GitHub Actions (`scp` step) |
| `Caddyfile` | Reverse proxy / TLS config — synced on every deploy | GitHub Actions (`scp` step) |
| `.env` | `POSTGRES_PASSWORD` — set once, by hand, at initial provisioning | Manual, on the droplet only |
| `.env.deploy` | `APP_IMAGE` (this deploy's git-SHA tag), `SENTRY_DSN` — regenerated on every deploy | GitHub Actions (deploy step, each run) |
| `backup.sh` | Daily `pg_dump` cron script (03:00 UTC) | Manual, at setup — see `docs/architecture.md`'s Backups section |
| `~/backups/` | Gzipped daily dumps, 14-day local retention | `backup.sh` |

**`.env`'s `POSTGRES_PASSWORD` is the one credential that lives only on the
droplet** — it's not in GitHub secrets, not in the repo, not anywhere else.
If the droplet is lost without a note of this password, Postgres data
recovered from a backup would need a fresh password set on restore (fine —
`pg_dump` doesn't need the original password to restore into a new
instance — but worth knowing this one value has exactly one copy today).

---

## GitHub Actions secrets

Set at `github.com/Fred-Edwin/Prosper-Hotel-System` → Settings → Secrets and
variables → Actions. Current secrets (`gh secret list`):

| Secret | Used for | Rotate by |
|---|---|---|
| `DEPLOY_HOST` | The droplet IP, passed to the SSH/SCP steps | Update the secret value if the droplet is ever recreated with a new IP |
| `DEPLOY_SSH_KEY` | Private key for the `deploy` SSH `IdentitiesOnly` action steps | Generate a new keypair, add the public half to the droplet's `deploy` user `authorized_keys`, replace this secret |
| `GHCR_TOKEN` | Authenticates `docker login ghcr.io` on the droplet, to pull the image the deploy step just pushed | A GitHub PAT (classic or fine-grained) with `read:packages` — regenerate in GitHub's Developer Settings, update the secret |
| `SENTRY_DSN` | Server-side Sentry DSN, threaded through `.env.deploy` into the running container | From Sentry project "javascript-nextjs" → Settings → Client Keys (DSN) |
| `NEXT_PUBLIC_SENTRY_DSN` | Same DSN, but baked into the client JS bundle at build time (`docker build --build-arg`) — must be identical to `SENTRY_DSN` above | Same source; keep both secrets in sync if the DSN ever changes |

**`SENTRY_AUTH_TOKEN` is deliberately not set.** It would enable source-map
upload during the Docker build (`@sentry/cli`'s postinstall step — see
`docs/gotchas.md` for the `pnpm` `allowBuilds` gotcha around this
package). Its absence is silent and harmless: the build just skips the
upload, logging `sentry_auth_token= is not a valid secret` as a build
annotation on every run. That annotation is expected — **not a sign
something is broken.** To enable source maps later: generate an
"Organization Auth Token" from Sentry → Settings → Auth Tokens (needs
`project:releases` scope), add it as a new `SENTRY_AUTH_TOKEN` repo secret.
No workflow change needed — the workflow already passes it through.

**`GITHUB_TOKEN`** (used to push images to GHCR in the build job) is not a
manually-set secret — GitHub provisions it automatically per workflow run
and it needs no rotation or storage.

---

## Local development environment

`.env` (gitignored, never committed — `.env.example` is the template):

| Var | Value locally | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://prosper:prosper@localhost:5432/prosper_hotel` | Points at the `docker-compose.yml` Postgres container (`prosper`/`prosper`, not a real secret — dev-only) |
| `TEST_DATABASE_URL` | `postgresql://prosper:prosper@localhost:5432/prosper_hotel_test` | Separate database, same container. Created once by hand (`CREATE DATABASE prosper_hotel_test;`) — not created automatically by any script |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Same DSN as production | Optional locally — errors during `pnpm dev` will report to the same Sentry project as production if set. Leave blank to develop without reporting local errors |
| `SENTRY_AUTH_TOKEN` | Not needed locally | Only relevant to CI's Docker build |

Local Postgres: `docker compose up -d postgres` (repo root
`docker-compose.yml` — distinct from `docker-compose.prod.yml`, which only
runs on the droplet and doesn't include a Postgres service of its own,
since production Postgres is a separate long-lived container managed by
hand).

---

## Sentry

- Org: **Freddie Software Solutions**
- Project: **javascript-nextjs** (the default name from the Next.js
  onboarding flow — never renamed; fine to leave as-is, but confusing if a
  second Next.js project is ever added to the same org)
- The user (client-side business owner in this account, developer-facing)
  created this account and project directly — not through the developer's
  own Sentry org. Access to the Sentry dashboard itself (to view live
  errors, generate the optional auth token above) goes through whoever has
  login credentials for that Sentry account — confirm who that is if it's
  ever unclear.

---

## `gh` CLI (local developer machine)

Needs the `workflow` OAuth scope to push changes to
`.github/workflows/*.yml` — the default `gh auth login` doesn't grant it.
Already sorted (see `docs/gotchas.md`); if a fresh machine or a `gh auth
logout` ever resets this, re-run:

```
gh auth login -h github.com -s workflow -w
```

**Run this directly in your own terminal, not proxied through an
assistant tool call** — the device-code flow is fragile under a short
command timeout. See `docs/gotchas.md`'s "GitHub Actions auth" section.

---

## If a credential needs rotating, in order of how likely you are to need it

1. **Sentry DSN changes** (new project, org migration) — update both
   `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` GitHub secrets to match, and
   the local `.env` if you want local error reporting too. No droplet
   change needed — `.env.deploy` regenerates from the secret on every
   deploy.
2. **Droplet is recreated / IP changes** — update `DEPLOY_HOST`, re-add the
   deploy public key to the new droplet's `authorized_keys`, re-run
   `backup.sh` setup and the cron entry (these don't survive a droplet
   rebuild), re-provision `.env`'s `POSTGRES_PASSWORD` by hand.
3. **`DEPLOY_SSH_KEY` is compromised or rotated** — generate a new keypair,
   add the public half to the droplet's `deploy` user, update the GitHub
   secret, remove the old public key from `authorized_keys`.
4. **`GHCR_TOKEN` expires or is revoked** — regenerate a GitHub PAT with
   `read:packages`, update the secret. Deploys will fail at the `docker
   login` step on the droplet until this is done; the build/push job
   itself uses the auto-provisioned `GITHUB_TOKEN` and is unaffected.
5. **The shared `wendo_droplet` SSH key is rotated for the other project**
   — this breaks `prosper-hotel-prod`/`prosper-hotel-deploy` access too,
   since it's the same key file. Give this droplet its own key before that
   happens, if possible.
