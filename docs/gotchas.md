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
- **"Chromium is cached but the MCP server still fails to launch a
  browser" — check what browser it's actually asking for, not just
  whether chromium exists.** `@playwright/mcp` defaults to **system
  Chrome**, not Playwright's bundled chromium — the opposite of
  `@playwright/test`'s default. If system Chrome isn't installed, the
  MCP server fails even with a fully-populated `~/.cache/ms-playwright/`.
  `.mcp.json` is gitignored (local machine config, not shared) — each
  session sets it up independently, so this can recur on a fresh
  machine.
- **`--browser chromium` (this doc's old advice) is not a valid value
  for `@playwright/mcp@0.0.79`.** That version's `--browser` flag only
  accepts `chrome`/`firefox`/`webkit`/`msedge` — passing `chromium`
  is silently ignored and it falls back to resolving a **Chrome-for-
  Testing** binary (a third, separate download, distinct from both
  Playwright's bundled chromium and system Chrome), which usually isn't
  cached, so the server fails with `Browser "chrome-for-testing" is not
  installed`. Confirmed 2026-08-12: a manual `npx @playwright/mcp
  install-browser chrome-for-testing` was attempted as the error message
  suggests, and was OOM-killed on a 7.7GB machine — don't rely on that
  path. **The actual fix is `--executable-path`, pointed straight at the
  already-cached bundled chromium** (the same binary
  `@playwright/test` uses, so no extra download): resolve it with
  `node -e "console.log(require('playwright').chromium.executablePath())"`
  from the repo root, and put that path in `.mcp.json`'s `args` as
  `"--executable-path", "<resolved path>"` in place of `--browser
  chromium`. **`.mcp.json.example` is the tracked template with this fix
  applied** — if `.mcp.json` doesn't exist yet, copy it from there; if it
  predates this fix, diff against the example, and re-resolve the path
  above since the version-numbered cache directory
  (`chromium-<build>`) changes across `pnpm install`s — don't assume the
  example's literal path is still correct on a different machine or
  after a dependency bump. Restart the MCP connection after editing
  `.mcp.json` — an already-running MCP server process doesn't pick up
  the file change. Don't install system Chrome as a workaround either
  way. If you don't want to touch `.mcp.json`, the throwaway-script
  fallback below already launches bundled chromium explicitly via the
  `playwright` package directly and is unaffected by any of this.
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

## The first hit to a freshly-added API route can silently no-op in `next dev`

**Symptom:** A POST route returns `200 {ok: true}` — the client sees success
and updates its UI — but the write never happened. The dev server log shows
a `SyntaxError: Unexpected end of JSON input` at `request.json()` logged
*after* the 200 line for the same route, with no second request line
before it. Retrying the exact same action (same button, same data)
immediately afterward works correctly and the write persists.

**Cause:** Turbopack compiles a route handler on demand, the first time
it's hit. On that first hit, hitting the route while it's still compiling
raced the module reload against reading the request body — the body
stream is single-use, so the second (module-reload-triggered) read got a
consumed stream and threw. This only affects the very first request to a
brand-new route file in a given `next dev` session; every request after
is served by the already-compiled module and behaves correctly. Confirmed
by re-running the identical action after the route had already been hit
once — it wrote to the database correctly the second time.

**Fix:** Not a code bug — production builds compile ahead of time, so
this can't happen there. During a manual dev-server check, don't trust
the very first hit to a newly-added route as proof of correctness if
something looks off; hit it a second time before concluding the logic is
wrong. Worth remembering before sinking time re-reading logic that
already has passing integration tests.
**Added:** 2026-08-10

## Turning a zero-substituted figure into a genuine `null` can crash a UI that never expected `null`

**Symptom:** After fixing a backend `logic.ts` function to return `null`
for a genuinely uncomputable figure (instead of the old wrong default of
`0`), a chart or card that consumed that figure crashed at runtime with
`Cannot read properties of null (reading 'toLocaleString')`, thrown from
inside `money()`.

**Cause:** Elsewhere in the same result type, a *different* field was
already legitimately `number | null` (e.g. `revenue: number | null` for
a "closed day" gap). A consuming component wrote `money(x!)` — a
non-null assertion — reasoning "this field is only null when the day is
closed, and I already branched on that." That reasoning was true only
because the sibling field (`netProfit`) had never actually been `null`
on a traded day before; the type already said `number | null`, but no
code path produced that combination. Fixing the backend to correctly
return `null` in a new circumstance (a traded day with a genuinely
uncomputable rate) exercised a path the `!` assertion was never actually
safe for — the type was honest, the assertion wasn't.

**Fix:** `grep` the whole codebase for every consumer of a field before
loosening its computed value from "always a number" to "sometimes
null," even when the type signature already said `number | null` for
other reasons. A pre-existing `| null` in a type is not proof every `!`
assertion against that field has been exercised — check what actually
produced the value before the fix, not just what the type allowed.
**Added:** 2026-08-13

**Follow-up, same day:** the 2026-08-13 canteen redesign (real sales
instead of count-derived-sales) retires the entire class of bug this
entry describes — `canteenCostRate`, `lastCanteenCount`,
`canteenEstimated`, and `provisional` are gone from
`getDashboardProfit`/`getLedgerSummary` entirely, and profit is never
`null` at either location anymore. `dashboard-profit.tsx` and
`ledger-shell.tsx` (and their stories) still reference these retired
fields in their own local view types — they compile clean (the UI's
types are independent of the API response) but will render `undefined`/
`NaN` for the removed figures at runtime until a UI pass updates them.
Known, disclosed gap from a backend-only implementation pass — not
rediscovered, don't re-diagnose it as a new bug.

**Closed, 2026-08-13 (same day, items 5-8 pass):** both view types now
match `getDashboardProfit`/`getLedgerSummary`'s real shape exactly — no
optional/null fields left where the backend always returns a number, no
`provisional` badge. Stories updated to match. If this bug resurfaces,
something drifted between the UI's local type and the logic.ts return
type again — diff them directly rather than guessing.

## `Transfer.reversedTransferId` (the column on the model itself) is never written

**Symptom:** Looks like it should mark "this transfer is a reversal of an
earlier one," per its own schema comment — but every transfer row reads
`reversedTransferId: null`, even for a transfer created by
`reverseTransfer`.

**Cause:** `reverseTransfer` (undoing an already-confirmed transfer)
never creates a new `Transfer` row at all — it posts a `StockMovement`/
`IngredientMovement` pair directly, with `transferId` set to the
*original* transfer's id and `reversedTransferId` set to that same
original id on the *movement*, not on any `Transfer` row. `Transfer`'s
own `reversedTransferId` column exists in the schema (with a comment
describing exactly this use) but no code path — `recordTransfers`,
`reverseTransfer`, `cancelPendingTransfer` — ever populates it.

**Fix:** don't trust `Transfer.reversedTransferId` for "is this a
reversal" — it's always `null` today. `listTransfersAtLocation`
(`stock/logic.ts`) detects "has this transfer been reversed" by querying
movements with `reversedTransferId: { in: transferIds }` instead, same
as the pre-2026-08-13 version did. `TransferHistoryEntry.isReversal` is
hardcoded `false` for the same reason — there's no real "this row is
itself a reversal" signal to read yet. If a future change makes
`reverseTransfer` create a real `Transfer` row for the reversal, this
note (and `isReversal`) should be revisited.
**Added:** 2026-08-13

## `listTransfersAtLocation` used to reconstruct history from movement pairs — a pending transfer only writes one side

**Symptom:** A transfer sent but not yet confirmed showed as one-sided or
was missing entirely from transfer history; there was no way to show
confirmed-vs-sent quantity or a `pending`/`cancelled` status from this
function at all.

**Cause:** The pre-2026-08-13 `listTransfersAtLocation` reconstructed
history entirely from `StockMovement`/`IngredientMovement` rows with
`reason: "transferred"`. In the two-sided transfer model, `recordTransfers`
only writes the *sender's* outgoing movement when a transfer is sent —
the receiver's incoming movement doesn't exist until `confirmTransfer`
runs (see REQ-02 Part A). A reconstruction keyed on movement pairs has
no way to represent "sent, still pending" — there's only one movement to
find, and its direction alone doesn't say whether the other side ever
confirmed, or whether it was cancelled instead.

**Fix:** `listTransfersAtLocation` now reads `Transfer` directly
(`findTransfersInvolvingLocation` in `stock/queries.ts`) —
`Transfer.status`/`sentQuantity`/`confirmedQuantity` are the real source
of truth for all three states (pending/confirmed/cancelled), one row per
transfer regardless of which side's movements exist yet.
`TransferHistoryEntry` gained `status` and `confirmedQuantity` fields;
`reversed` still comes from movements (see the entry above — there's no
`Transfer`-level signal for that). Before reconstructing any read from
movement rows, check whether the thing being read has a real backing
model (`Transfer`, here) that's already the source of truth — movements
are a ledger of what happened, not always a complete index of current
state.
**Added:** 2026-08-13

## A `StockMovement` row can carry `quantity: 0` on purpose

**Symptom:** Looks like a bug — why write a movement that doesn't move
anything?

**Cause:** `transfer_shortfall` (2026-08-13, REQ-02 Part A's two-sided
transfers) needs to record "N units never arrived, attributable to this
transfer" on the *receiving* location's ledger for reporting/audit
purposes. The receiving side's actual stock change is already fully
captured by the paired `transferred` row being written at only
`+confirmedQuantity` (less than what was sent) — the sender's stock
already left at the full `sentQuantity` when they sent it. Writing the
shortfall as a further negative quantity on top of the already-reduced
incoming amount double-counts the same missing unit (caught by an
integration test expecting `quantityOnHand: 3` after sending 4 and
confirming 3, which returned `2`).

**Fix:** the shortfall row is a marker, not a quantity change —
`quantity: 0`, `reason: "transfer_shortfall"`. The actual gap size lives
on `Transfer.sentQuantity − Transfer.confirmedQuantity`, which any
report reads from directly. Before assuming every `StockMovement`
quantity must be non-zero, check whether the row's job is "change stock"
or "attribute an event that already happened elsewhere."
**Added:** 2026-08-13

## All quantities are `Int` — decimal/fractional amounts cannot be stored

**Symptom:** A recipe input rejects `0.25` (e.g. 0.25 kg of potatoes per
plate of chips). Not a form validation bug — every quantity column in
the schema (`RecipeLine.quantity`, `Recipe.yieldQuantity`,
`StockMovement.quantity`, `IngredientMovement.quantity`,
`SaleLine.quantity`, `Asset.quantity`, etc.) is `Int` in
`prisma/schema.prisma`. `Ingredient.unitOfMeasure` is free text ("kg,
litre, packet, whatever the owner enters"), so the schema allows a unit
that implies fractional amounts while the quantity column can't hold
one.

**Cause:** an early modeling decision to track stock in whole units,
which holds for countable goods (plates, bottles, pieces) but not for
anything measured by weight/volume where a recipe or delivery
legitimately needs a fraction of a unit (0.25 kg, 1.5 litre).

**Not fixed yet — needs a decision, not a patch.** `Int → Decimal` is a
schema-wide migration touching cost math everywhere quantity is
multiplied by a per-unit cost (recipe costing, stock valuation, COGS,
movement ledgers) — flagged during 2026-08-13 manual admin-reporting
reconciliation testing, deliberately not fixed inline. Until decided,
work around it by defining fractional-prone ingredients in a smaller
whole unit (e.g. "Potatoes" in units of 100g rather than kg, so 0.25 kg
becomes `25`) rather than trying to force a decimal into these fields.
**Added:** 2026-08-13

## Canteen "no count yet today" gap — owner's Dashboard not covered yet

**Deliberately deferred, not forgotten.** `docs/formulas.md` §10's gap
(handover checked on a day with no covering canteen count reads as a false
shortfall) was resolved for the attendant's own handover screen
(`cash/ui/handover.tsx`'s `NoCountYetBanner`, backed by
`stock/logic.ts`'s `getLatestStockCountDate`) — she sees it on the count
step, the confirm step, and the already-recorded state. It was **not**
added to the owner's Dashboard Handover section
(`cash/ui/dashboard-handovers.tsx`), where she reviews expected-vs-actual
across all staff — she already sees the real expected figure there
(unlike the attendant's blind count), so she can reason about a low number
herself, but an explicit "no count yet" flag on that row would still be a
real improvement. Scoped out of the 2026-08-15 canteen count-derived-sales
UI pass as a different screen than the one item 3 named; pick up as its
own small ticket if the owner finds herself second-guessing a canteen row.
**Added:** 2026-08-15

## Reset tooling runs in the operator's timezone; production runs UTC

The reset scripts (`scripts/reset-*.ts`) run **from a laptop over an SSH
tunnel**, not on the droplet — so `new Date("...")` without a `Z` is parsed
in the *laptop's* timezone, while every date boundary the app computes
(`setHours(0,0,0,0)` in `reporting/logic.ts`) uses the *container's*, which
is UTC. No `TZ` is set in `docker-compose.prod.yml` or `.env`.

On 2026-08-17 the replay stamp was written as
`new Date("2026-08-16T23:59:00")` meaning "yesterday, Nairobi". Parsed on an
EAT (UTC+3) laptop it became `2026-08-16T20:59:00Z` — which is still safely
before production's `2026-08-17T00:00:00Z` day boundary, so the reset was
correct, with three hours of margin rather than the sixty seconds a literal
`23:59Z` would have given. That margin was luck, not design.

**If you re-run this tooling from a machine in a different timezone, make
the stamp explicit.** A laptop at UTC+5 would parse the same literal as
`18:59Z` (fine), but one *behind* UTC would push it past midnight into
today's period — which is exactly the Trap 2 failure that produces a large
negative cost-of-goods-sold (see `docs/data-reset-findings.md`, and the
workaround in `reporting/ui/opening-balance.ts`).

Verify the boundary rather than assuming it: `reset-verify.ts` prints the
stamp every movement carries, and reproducing the ledger's own
opening/closing sums for one known item is a five-line script.
**Added:** 2026-08-17

---

## A weighted average values new stock above what was paid for it

**Symptom.** The ledger reports a negative cost of goods sold on a day
nothing was sold — production showed **−72.6** with `salesValueMinor: 0`.
Distinct from the timezone/boundary cause documented above: here the period
boundaries are correct and the arithmetic is doing exactly what it was told.

**Cause.** Costing used a running average (the old `formulas.md` §3), and
§6 values stock at both period boundaries using the item's cost while
purchases enter at the price actually paid. The average made those two
disagree: a delivery's own units were valued at the blend, not at what was
paid for them. Potatoes: 3.5 units carrying the owner's hand-entered
KSh 326.79, then 12 received at KSh 300 — average KSh 306.05, so the 12 new
units cost 300 each and were valued at 306.05:

```
12 × (306.05 − 300) = 72.60
```

The trigger is a price *difference* on an item with stock already on hand.
It cannot happen when the price is unchanged, which is why Peas (12 @ 90
onto 6 @ 90) was fine on the same day and only Potatoes showed it.

**Why it hid for weeks.** Nothing about the movement rows is wrong — the
figure is derived on read. And it only surfaces once a priced delivery
lands on top of pre-existing stock, which for most items had not happened
yet: 30 of 38 ingredients had a hand-entered cost and no delivery at all.

**Fixed 2026-08-17** by dropping the average — the delivery price becomes
the cost outright, so purchases and valuation agree — together with T8's
historical valuation, which keeps stock already on hand at what it cost.
**Both halves are required.** Dropping the average alone stamps the new
price on the older units too, turning a −72.60 into a +93.77. See
`formulas.md` §3 and `stock/tests/latest-price-costing.integration.test.ts`.

**The invariant worth keeping.** A period with no sales, no waste and no
issues must produce a cost of goods sold of exactly zero. That one
assertion catches this entire class of bug, and is now a test.

**Added:** 2026-08-17
