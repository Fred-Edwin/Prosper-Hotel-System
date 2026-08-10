# Gotchas

Non-obvious things that cost real time. Add to this file, don't rediscover.

## Docker / CI

- **Image tags must be lowercase.** `${{ github.repository_owner }}` in GitHub
  Actions resolves to the GitHub account's display casing (`Fred-Edwin`), and
  `docker buildx build --tag` rejects uppercase in image refs. Fixed by
  hardcoding `ghcr.io/fred-edwin/prosper-hotel` in the workflow's `env.IMAGE`
  instead of interpolating the raw context variable.
- **The Dockerfile's runner stage always does
  `COPY --from=builder /app/public ./public`.** If there's no `public/`
  directory (no static assets yet), the build fails outright. Fixed with an
  empty `public/.gitkeep`. Don't delete that directory without checking the
  Dockerfile still has something to copy.
- **Don't validate Docker builds locally in this sandbox.** `pnpm install`
  inside a `docker build` here hits registry timeouts and can take 5+ minutes
  then fail — a sandbox network limitation, not a real problem. GitHub
  Actions' runners build the same Dockerfile in ~3.5 minutes with no issue.
  Push and let CI build; don't try to reproduce it locally first.
- **The deploy workflow only ever pulled the app image — it never synced
  `docker-compose.prod.yml` or `Caddyfile` to the droplet.** Editing either
  file in the repo (e.g. adding an env var to the `app` service) silently had
  no effect in production, because the droplet kept running its own
  original copy indefinitely. Discovered when `SENTRY_DSN` was added to the
  compose file but never reached the running container. Fixed by adding an
  `scp` step (`appleboy/scp-action`) ahead of the SSH deploy step that syncs
  both files on every push to main. If a future compose/Caddyfile edit
  "does nothing" in prod, check whether the droplet's copy is stale before
  assuming the app code is wrong.
- **pnpm's build-script allowlist (`pnpm-workspace.yaml`'s `allowBuilds`)
  blocks postinstall scripts for new dependencies by default**, including
  `@sentry/cli`'s (needed for source map upload). `pnpm add` succeeds but
  the postinstall silently doesn't run — set the package to `true` in
  `allowBuilds` and re-run `pnpm install`.

## Droplet / SSH

- **The SSH key shown as selected in DigitalOcean's droplet-creation UI isn't
  self-evidently correct.** On this droplet, only one key was selectable
  (`wendo-rms-server`) and it didn't match the laptop's actual key. Diagnosed
  via DigitalOcean's Web Console (bypasses SSH entirely), fixed by manually
  appending the laptop's public key to `authorized_keys`. Verify by
  connecting — don't assume the UI's selection is right.
- **Don't co-locate unrelated clients' stacks on one droplet to save cost.**
  An existing droplet (`wendo-droplet`) already runs a live 4-container stack
  for a different client with only ~1GB of real headroom on a 2GB box. A
  fresh dedicated droplet was provisioned for Prosper Hotel instead, to avoid
  cross-client resource contention on someone else's production box.

## Testing / Playwright

- **Real E2E specs (`e2e/*.spec.ts`) use `@playwright/test` as configured
  in `playwright.config.ts`** — the `webServer` block auto-starts the app,
  the `setup` project logs in once and saves `e2e/.auth/staff.json`, every
  other spec reuses it via `storageState`. Don't hand-roll a browser launch
  inside a spec file; extend the existing config instead.
- **Ad hoc visual checks (screenshots, manually driving a page, verifying
  something live) prefer the Playwright MCP server** (`.mcp.json`, once
  approved) — direct tool calls (navigate/click/screenshot) instead of
  writing a throwaway script each time. It runs over stdio (spawned per
  session, no listening port), so it doesn't collide with `next dev` or
  Storybook's per-worktree ports across parallel builds — but it does
  launch its own headless browser process, a real RAM/CPU cost same as
  any other resource-intensive process (`.claude/skills/build/SKILL.md`
  step 0a's approval gate covers it). **Fall back to the throwaway-script
  approach below if the MCP server isn't available or approved for this
  session** — import `chromium` from `playwright` directly
  (`import { chromium } from "playwright"`), launch with
  `chromium.launch({ args: ["--no-sandbox"] })`, and drive it with
  `page.goto()` / `page.fill()` / `page.click()` / `page.screenshot()` in a
  plain throwaway script — no Playwright test runner needed for this.
- **The single most common failure running such a script: launching it
  from outside the project directory.** `playwright` is a project
  dependency in `node_modules`, resolved the same way any other npm
  package is — `node /tmp/scratch/my-script.mjs` fails with
  `ERR_MODULE_NOT_FOUND` even though the exact same script works when run
  as `node my-script.mjs` from the repo root (or an absolute path *into*
  the repo). If a script needs to live outside the repo (e.g. a session
  scratchpad), either run it via `cd` into the repo first, or copy it into
  the repo temporarily and delete it after.
- **"Chromium isn't installed" — check the shared cache before installing
  anything.** `~/.cache/ms-playwright/` is a home-directory cache, shared
  by every git worktree on the machine (they share one home directory).
  Run `ls ~/.cache/ms-playwright/` before assuming a fresh install is
  needed — if `chromium-<version>` is already there, it's visible from
  every worktree with no extra setup. **Never install system Google
  Chrome as a fix** (`apt`/a downloaded `.deb`) — the MCP server and
  `@playwright/test` both use Playwright's own bundled `chromium`, not
  system Chrome, so a system install is redundant, needs `sudo`, and
  doesn't fix anything. If the bundled binary is genuinely missing (rare
  — only in a truly isolated sandbox that can't see the shared cache),
  the correct fix is `npx playwright install chromium`, not a system
  package manager. This happened for real: a worktree session
  misdiagnosed a slow MCP connection as a missing browser and installed
  a redundant system Chrome before the mistake was caught.
- **A slow first MCP connection can look like a missing dependency.**
  `.mcp.json`'s `playwright` server resolves via `npx`; pin the version
  (`@playwright/mcp@<version>`, not `@latest`) so it uses the local npm
  cache instead of re-resolving against the registry every session —
  that resolution delay is what caused the misdiagnosis above.
- **Prefer handing the user a live URL over a screenshot when they can
  reach one.** A screenshot is one frame of one state; a running
  `pnpm storybook` (or `pnpm dev`) URL is every state, interactive, at
  whatever size they resize the window to. Screenshots are the fallback
  for when a local URL genuinely isn't reachable (a remote/headless
  session), not the default.
- **Added:** 2026-08-07

## A leftover `pnpm dev` from an earlier session serves a stale Prisma client

**Symptom:** A new write (e.g. `db.sale.create`) throws `TypeError: Cannot
read properties of undefined (reading 'create')` in the running dev
server's log, even though `pnpm exec tsc --noEmit` is clean and the model
clearly exists in `schema.prisma`.

**Cause:** A `next dev` process left running from a previous session (or
`ScheduleWakeup`/background shell) has the old generated `@prisma/client`
loaded in memory. Running `prisma migrate dev` / `prisma generate` in the
current session regenerates the files on disk, but Turbopack's dev server
doesn't reload the Prisma client module — it keeps serving the pre-migration
shape, so any new model or field is `undefined` at runtime while typechecking
against the fresh generated types passes fine. A second `next dev` attempt
in the same session doesn't fail loudly either — Next just prints "Another
next dev server is already running" and points at the stale PID, easy to
miss in scrollback.
**Fix:** Before the manual browser check on a ticket that adds a Prisma
model or field, check for a stale server first: `ps aux | grep "next dev"`.
Kill any pre-existing PID and start a fresh `pnpm dev` after migrating and
generating, rather than assuming the currently-running one picked up the
schema change.
**Added:** 2026-08-07

## Login redirect is not role-aware yet

- **`login/page.tsx` originally hardcoded `router.push("/staff")`** after
  every successful login, a leftover from the tracer slice when `/staff`
  was the only page that existed. Owners logging in had no way to reach an
  admin destination without typing the URL by hand. Fixed on ticket 03
  (Catalogue) to route by `staff.role` from the login response — owner to
  `/catalogue`, everyone else to `/staff` — but `/catalogue` is a stopgap
  target, the same shape as the tracer slice's `toShellRole` "broadest
  existing list" stopgap (architecture.md's tracer-slice section): it's
  simply the only admin-shell page that exists yet. **When `/dashboard`
  is built, update this redirect to point there instead.**

## GitHub Actions auth

- **Pushing changes to `.github/workflows/*` requires the `workflow` OAuth
  scope on the local `gh` CLI**, which the default install doesn't have. The
  device-code flow (`gh auth refresh -s workflow`) is fragile under a tool
  with a short command timeout — it can get cut off mid-flow. The fix that
  actually worked: have the user run
  `gh auth login -h github.com -s workflow -w` directly in their own
  terminal, not proxied through a tool call.

## Prisma migrations, non-interactively

- **`prisma migrate dev` refuses to run at all in a non-interactive shell**
  (no TTY), even with `--create-only`. There's no flag to force it. Fixed by
  generating the SQL with `prisma migrate diff --from-config-datasource
  prisma.config.ts --to-schema prisma/schema.prisma --script`, hand-writing
  it into a new `prisma/migrations/<timestamp>_<name>/migration.sql` folder
  (timestamp format `YYYYMMDDHHMMSS`, matching existing folders), then
  `prisma migrate deploy` to apply it to the dev database.
- **`prisma.config.ts` hardcodes `datasource.url` to `process.env.DATABASE_URL`
  via `dotenv/config`**, so `prisma migrate deploy` always targeted the dev
  database — setting `DATABASE_URL=$TEST_DATABASE_URL` in the shell before
  the command did nothing, because `dotenv/config` reloads `.env` and
  overwrites it. There's no `--datasource-url` flag on `migrate deploy` in
  this Prisma version. **Fixed**: `prisma.config.ts`'s `datasource.url` now
  reads `TEST_DATABASE_URL` when `NODE_ENV=test`, else `DATABASE_URL`, and
  `pnpm test:migrate` runs `NODE_ENV=test prisma migrate deploy`. Run it
  after adding a new migration so the test database picks it up before
  `pnpm test`.
  (Historical note, first hit on the catalogue ticket: before this fix, a
  migration was applied to the test DB by hand — a throwaway Node script
  run from inside the repo, needed for `node_modules` resolution per the
  Testing/Playwright section above — that connected via `pg` directly and
  inserted a matching `_prisma_migrations` row. `pnpm test:migrate` replaces
  that entirely; no need to repeat it.)
- **Added:** 2026-08-07
