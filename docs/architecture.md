# Architecture — Prosper Hotel

Decisions, and the reasons behind them. Reasons do not go stale even when code moves.

Vocabulary is in `CONTEXT.md`. Scope is in `docs/scope.md`. Every financial calculation is
in `docs/formulas.md`.

---

## The cutting dimension: location

**Location cuts through the entire system.** It is an entity, not an attribute.

Nearly every other concept is meaningless until the location is known — stock, sales,
cash, handovers, staff postings. Location has its own paybill, its own stock, its own
staff and its own daily close.

Three consequences, settled deliberately because retrofitting any of them is expensive:

- **It scopes permissions.** Staff see their own location only. The owner sees both.
- **Transfers are visible at both ends.** "Own location only" means *own location, plus
  transfers involving it* — the canteen must see food coming from the restaurant.
- **Stock moves in both directions.** The restaurant sends prepared food to the canteen;
  the canteen sends printing stock back. Two stocking points supplying each other, not a
  hub and spoke. A transfer is one movement out and one movement in.

### The two locations record trade differently

This is not a preference to be configured away. It follows from how each location physically
trades, and the system accommodates both rather than forcing one shape on the other.

| | Restaurant | Canteen |
|---|---|---|
| Sales | Recorded individually, as they happen | Not recorded individually |
| Money | Sum of the day's sales | **Takings** — cash and M-Pesa totals, entered at close |
| Stock count | Daily | Cooked food daily; own goods weekly |
| Item detail | From the sales themselves | **Derived** at the weekly count |

**Why the canteen cannot record sales as they happen.** Students arrive in a rush. The
attendant is serving and handling money, not operating a phone. She reads M-Pesa messages as
she distributes items. Requiring per-sale entry would produce invented data, which is worse
than honestly coarse data.

**Why the canteen counts weekly.** Its stock is packaged goods in quantity — a box of
biscuits, a carton of sweets. Counting them daily is a chore with no daily payoff. Weekly is
normal for retail of this kind.

**What the canteen gives up, accepted deliberately:**

- **Daily canteen profit is provisional** — the cost of restaurant-supplied food is exact, the
  cost of canteen-only goods is estimated between counts and corrected at each one. Revenue
  and cash position remain daily and exact.
- **Low-stock warnings are stale** — accurate on count day, drifting afterwards.
- **A weekly variance has several possible causes** — theft, breakage, miscounting — and the
  single number cannot separate them.

**What still holds.** Two controls at two frequencies: money checked daily, stock checked
weekly. M-Pesa is independently verifiable at both locations because the messages are
evidence the attendant does not author. Sustained cash shortfall surfaces at the weekly count
even though a single day's cash cannot be verified.

**Credit sales are always recorded individually, at both locations.** A debt needs a named
customer and cannot wait a week for a count.

---

## Modules

Six. Each is a part of the business the client would recognise, described in her own words.

| Module | Owns | The client's words |
|---|---|---|
| `catalogue` | Products, ingredients, recipes, prices | "what I sell and what it costs" |
| `stock` | Movements, daily closes, counts, transfers | "what's on my shelves" |
| `sales` | Sales, payment lines, customers, credit | "what we sold and who owes me" |
| `cash` | Handovers, expenses, the running balance, drawings | "where the money is" |
| `people` | Staff, days worked, pay, access | "my staff and what I pay them" |
| `reporting` | Profit, stock valuation, the item history, the audit trail | "am I making money" |

**Why `cash` is separate from `sales`.** Money taken at the till and money sitting in the
owner's pocket are different questions, and she said so herself. Sales answers *what did we
sell*; cash answers *where is the money*. A business can sell well and still have cash
unaccounted for — separating them is what makes that visible rather than hidden.

**Why `reporting` owns no data.** It reads from everything and stores nothing, which is
usually a smell. It earns its place here because profit spans stock cost, sales revenue and
expenses, and that join has to live somewhere. **It reads through other modules' interfaces,
never their internals.**

**The audit trail is not a module.** Every module writes to it, so it is a shared
foundation capability rather than a part of the business. It is *read* through `reporting`.

---

## Seams

Six, one per module — the module interfaces listed above.

**Tests observe behaviour at these six seams and nowhere else.** No test is written against
a module's internals. If something can only be checked by reaching past an interface, the
module is the wrong shape.

---

## Testing

**Integration tests** run against `prosper_hotel_test` (a real, separately migrated
database — never mocked) via `pnpm test`, in `src/modules/<x>/tests/*.integration.test.ts`.
They call a module's `index.ts` exports directly. `src/modules/people/tests/auth.integration.test.ts`
is the exemplar: log in, wrong PIN, unknown phone (same error — no enumeration leak), logout
invalidates the session.

Auth's cookie-setting route handlers (`loginRoute`, `logoutRoute`) depend on Next's
per-request `cookies()` context and cannot be called directly outside a running server —
that boundary is what E2E exists to cover. `login`/`logout`/`getAuthenticatedStaff` sit one
layer below the HTTP routes and accept the Prisma client as a parameter, so they're
integration-tested directly; both are exported from `people/index.ts` for that reason.

**E2E tests** run via Playwright (`e2e/`, `pnpm test:e2e`), through a real running app,
critical paths only. `e2e/auth.setup.ts` logs in once and saves browser state to
`e2e/.auth/staff.json` (gitignored) — every other spec reuses it, so a broken login produces
one failing setup, not forty failing specs. Selectors target `data-testid` only, never CSS
classes or visible text, which is what survives a cosmetic restyle. No fixed waits — assert
on the condition (a locator, a URL, a network response), never `page.waitForTimeout`.

---

## Stack

| Concern | Choice | Why |
|---|---|---|
| App | Next.js, as a PWA | One codebase, installs to a phone from a link, no app store. Staff use their own phones. |
| Language | TypeScript | The domain is money and stock; types catch real errors. |
| Database | PostgreSQL | The movement ledger and daily closes need real transactions. Non-negotiable for accounting. |
| Data access | Prisma | Schema-first, generated migrations, and a visual browser. See [ADR 0006](adr/0006-prisma-for-data-access.md). |
| Auth | Owned, in `people` | Access is location-scoped and role-shaped in a way off-the-shelf auth fights. |
| Hosting | One host, app and database together | Solo developer. Splitting hosts creates a preview-deployment problem for no gain. |

**Online only.** Offline sales were considered and rejected: connectivity at both locations
is reliable in practice, and offline sync is a large amount of work to solve a problem this
business does not have. If that changes, sales are append-only and therefore the safe thing
to make offline-capable first.

---

## Identity and access

**Four roles**, drawn from how the business actually runs rather than invented:

- **Owner** — everything, both locations. The only role that corrects stock, pays money out,
  changes a closed day, sets prices, and manages staff.
- **Store manager** — stock at the restaurant: receiving, issuing to the kitchen, transfers.
  Records delivery orders. **Does not work the till.**
- **Cashier** — selling at their location, and recording wastage they observe.
- **Attendant** — the canteen, single-handed: sells, receives transfers, receives deliveries
  direct from suppliers and records what they cost, sends stock back, keeps stock records.
  Effectively cashier and store manager for one location.

**Both locations receive from suppliers.** Goods arrive at the restaurant's main store and
also directly at the canteen, which stocks packaged goods a supplier can drop off. Receiving
is therefore a capability of the store manager *and* the attendant, each at their own
location — not a restaurant-only action.

**Recording a receipt is not paying for it.** The attendant records stock arriving and its
cost; the money leaving remains the owner's [[Cash Movement]]. This preserves the single
expected-cash balance, which depends on only one person paying money out.

**The owner works any position when present.** Capability is therefore not "owner sees
reports" — she must be able to do everything her staff can do, plus what only she can do.

**Login is a phone number and a four-digit PIN.** Staff use their own phones and log in
mid-service with customers waiting; an email and password is friction that gets worked
around. The accepted risk: a shared or observed PIN weakens attribution, and attribution is
the basis of the handover control. Mitigated by making activity visible per person rather
than by hardening the login.

**Staff are managed by the owner** — added, deactivated, rates and roles set. **Deactivated,
never deleted:** a former employee's sales must stay attributed to them.

---

## Data lifecycle

**Nothing that moved stock or money is ever deleted.** But mistakes are common and must be
fixable in seconds, mid-service. These are not in tension — the distinction is *how*.

- **Reversal, not deletion.** A wrong sale is voided: a reversing entry returns stock and
  cash to where they were, and the original stays readable, marked void, attributed.
- **Void your own entry, same day, before close** — any role, no permission needed. This is
  the common case and it must be fast.
- **After the day is closed** — owner only.
- **Non-financial typos** — a misspelled name, a wrong phone number — are edited in place,
  keeping the previous value. Not worth a reversal.

**Voids are shown on the day's summary.** An undo the owner cannot see is a way to hide a
mistake; a cashier with fifteen voids in a day should be visible. Visible rather than
blocked, because blocking it makes the system unusable.

### Changing a closed day

The owner does not edit closed figures. She records a **new entry that carries an effective
date in the past**, with a reason and attribution. The closed day keeps its original numbers.

**Every entry carries two dates: effective and entered.** Normally identical. For a
correction they differ, and that gap is the information — it distinguishes "what Tuesday
looked like on Tuesday" from "what Tuesday looks like now". Both are answerable.

Editing the figure directly was rejected because the handover was already checked against
it, because the client's bar is "the past readable exactly as it happened", and because an
audit trail over figures that move silently is worthless.

### Stock levels

A stock level is **not a stored number**. It is the sum of the movements.

For speed, each location freezes a **daily closing balance per item** at close. Current stock
is last night's close plus today's movements. This is not only an optimisation — it is
exactly the client's existing Excel shape (opening, added, transferred, sold, wasted,
closing) and it gives the daily physical count something to compare against.

**A day closes even when it does not balance.** The discrepancy is recorded, not hidden, and
an unexplained gap never blocks the next day's trading.

**A physical count never silently overwrites the record.** It records what was counted and
shows the difference. Correcting the record is a separate, deliberate act — and **only the
owner may correct.** The person who counts is not the person who adjusts.

---

## Integrations

**None in v1.** M-Pesa payments are recorded by hand as payment lines against a sale. There
is no paybill integration and no automatic reconciliation.

Recorded explicitly because it is the obvious next integration: two paybills, one per
location, and matching statements to recorded sales would strengthen the handover control.

---

## Environments and deployment

One host, application and database together. A single production environment plus local
development.

**No staging in v1.** A solo developer and an environment nobody looks at is cost without
benefit. Because the stack is not split across hosts, the preview-deployment problem — a
preview frontend pointing at a production backend — does not arise.

### Rollback

Every image is tagged with its git SHA (`ghcr.io/fred-edwin/prosper-hotel:<sha>`), and
`docker compose up -d --no-deps app` against a different `APP_IMAGE` swaps the running
container in a few seconds without touching Postgres or Caddy. Tested by hand: rolled the
live app back one deploy, confirmed `HTTP 200` on the rolled-back image, rolled forward
again.

To roll back manually, on the droplet as `deploy`:

```bash
cd ~/prosper-hotel
export APP_IMAGE="ghcr.io/fred-edwin/prosper-hotel:<prior-sha>"
echo "APP_IMAGE=${APP_IMAGE}" > .env.deploy
docker compose --env-file .env --env-file .env.deploy -f docker-compose.prod.yml up -d --no-deps app
```

Prior SHAs are visible via `docker images | grep prosper-hotel` (only images already
pulled to the droplet are available without a re-pull) or from `git log` on GitHub.

**This does not undo a migration.** Per the backward-compatibility rule below, a plain
image rollback should be enough in the overwhelming majority of cases — the old code
runs fine against a schema that only ever grew forward-compatibly. A migration that
truly can't roll forward safely is a design error to fix, not something this procedure
handles.

**Migrations run automatically on deploy and must be backward-compatible** — the
currently-running (old) code must never break against the new schema, because rollback
does not reverse a migration.

### Backups

Daily `pg_dump` via cron on the droplet (`~/prosper-hotel/backup.sh`, 03:00 UTC),
gzipped into `~/backups/`, 14-day local retention. Restore tested by hand: dumped the
live database, restored into a scratch database on the same Postgres instance, diffed
table list and row counts against the source, dropped the scratch database.

Current gap: backups live on the same disk as the database they back up — no off-site
copy yet (e.g. DO Spaces/S3). Fine for now given the data volume and one-droplet setup,
but worth revisiting before this matters for a real incident (disk failure or droplet
loss would take out both).

---

## Observability

Error tracking with alerts to the developer. The client should not be the one who discovers
the system is broken. Cheap, and worth it for a business that trades daily.

**Live**: Sentry, via `@sentry/nextjs`. Wired through Next's native
`instrumentation.ts` (server + edge) and `instrumentation-client.ts` (browser)
file conventions — this Next.js version doesn't use the older
`sentry.server.config.js` pattern. The DSN is a build-time arg for the client
bundle and a runtime env var for the server, threaded through the Dockerfile,
`docker-compose.prod.yml`, and the deploy workflow. Source map upload
(`SENTRY_AUTH_TOKEN`) is optional — its absence just skips the upload rather
than failing the build. Verified end to end: triggered a real 500 on
`/api/auth/login` in production and confirmed it appeared in Sentry's Issues
tab.

**Uptime monitoring: deliberately skipped.** DigitalOcean's infrastructure
uptime record was judged sufficient given the single-droplet setup — a
deliberate call, not an oversight. Revisit if the droplet ever has an
unexplained outage Sentry didn't catch (Sentry only sees errors the app gets
a chance to throw; it can't see the app being unreachable).

---

## The tracer slice

Built to establish the pattern every ticket copies: staff logs in, sees
their own location's current stock. Live in production, permission-enforced,
covered by an integration test, an E2E test and a Storybook story.

**A movement needs something to move.** `stock` owns `StockMovement`;
`catalogue` owns the minimal `Product` it points at. Reading a product from
`stock/logic.ts` goes through `catalogue/index.ts`
(`findProductsByIds`), never `catalogue/queries.ts` directly — the first
real exercise of the cross-module-import rule with two modules that
actually need each other.

**Current stock is computed, not stored**, per the data-lifecycle decision
above: `getCurrentStockAtLocation()` sums `StockMovement.quantity` (signed:
positive in, negative out) grouped by product, via Prisma's `groupBy`. The
daily closing-balance snapshot is deliberately not built yet — the tracer
proves the shape, not the optimisation.

**`canAccessLocation()` is enforced one layer below the route**, in
`stock/logic.ts`, not in `routes.ts` and not in the UI. `getCurrentStockAtLocation(db, requester, locationId)`
returns `{ ok: false, reason: "forbidden" }` rather than throwing, so the
route maps it to a 403 and the UI renders `PermissionDenied` from
`components/patterns/states.tsx`. Every future location-scoped read or
write should call it the same way, at the same layer.

**A design gap surfaced mid-slice, and how it was resolved.** The design
phase produced `stock-body.tsx` — an admin/owner valuation table (cost,
value, filters) — but no staff-shell "what's on hand" screen. Per
`docs/design.md`'s closing rule ("if a needed pattern doesn't exist, STOP
and ask"), this was raised rather than silently reusing the admin table or
inventing a screen unreviewed. Resolved by building a new staff-shell
composition (`stock/ui/stock-list.tsx`) from existing primitives only — no
table-toolbar chrome, no cost/value columns, large tap-target rows per the
mobile rules. **The lesson for future tickets:** design coverage was
audited screen-by-screen during Design, not role-by-role — a role having no
screen for a real need it has is the kind of gap that surfaces during
Foundation or a ticket, not before. Surface it the same way: stop, ask,
resolve explicitly, don't default to either extreme (blind reuse or silent
invention).

**The staff shell's `StaffRole` type (`components/layout/staff-nav.ts`) has
no `owner` case**, and uses kebab-case (`store-manager`) where Prisma's
`StaffRole` enum uses snake_case (`store_manager`) and adds `owner`. The
tracer's `/staff` route maps `owner` to the `store-manager` nav (the
broadest existing list) as a stopgap — `docs/scope.md`'s "still to
establish" list doesn't cover this, so it's a real open question: does the
owner get her own staff-shell nav, or is "broadest existing list" the
permanent answer? Decide before a ticket needs the distinction to matter.

**Integration test files must run sequentially.** `LocationCode` only has
two values (`restaurant`, `canteen`) and every integration suite creates its
own `Location` rows against the one shared real test database. Two suites
racing in parallel collide on the enum's uniqueness constraint. Fixed with
`fileParallelism: false` on the `integration` project in `vitest.config.ts`
— not a workaround, just what "one real shared test database" actually
requires once there's more than one test file.

**`test-db.ts` moved from `modules/people/tests/` to `shared/test-db.ts`.**
It was never a `people`-specific concern — every module's integration tests
need the same test-database client. Import it as `@/shared/test-db`.

**Deployed but not yet logged-into live**, unlike this session's Sentry/
rollback/backup work. The migration ran cleanly in production (confirmed
via `\dt` over SSH — `products` and `stock_movements` exist) and the app
serves `HTTP 200`, but production's `staff_members` table is empty —
nobody has run `pnpm seed` against the live database, and seeding real
customer infrastructure wasn't done without asking. So the login → stock
path is verified against local Postgres and in CI (integration + E2E), and
manually in a local browser across three roles with correct location
scoping — but not yet exercised against the live URL with a real session.
**Revisit before calling this fully proven**: either seed production with
placeholder staff for a one-time check, or wait until the owner's first
real staff member is entered and check then.

## Non-functionals

Five users. Two locations. Roughly 150 sellable lines. A few hundred sales a day at most.

Kenyan Shillings throughout. Cash and M-Pesa tracked separately, never pooled. No regulatory
or compliance constraint beyond keeping honest records.

**Recorded explicitly to license not over-engineering.** This system does not need
scale architecture, caching layers, or horizontal anything. Correctness and speed of entry
matter; throughput does not.
