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

*Revised 2026-08-15 — superseding the 2026-08-13 revision below the line, which itself
superseded the original design further down.* The two locations now diverge more than the
2026-08-13 revision left them:

| | Restaurant | Canteen |
|---|---|---|
| Sales | Recorded individually, as they happen, with payment method | Inferred from a stock count — see below |
| Money | Sum of the day's sales, per payment line | Cash and M-Pesa totals declared at [[Handover]], checked against the day's count-derived sales as a whole |
| Stock count | Daily, a shrinkage check only | Cooked food daily; own goods on any day the attendant chooses — the count that produces that day's sales, not merely a shrinkage check |
| Item detail | From the sales themselves | From the sales the count produced |
| Credit sales | Recorded individually, named customer | Not available |

**Why the canteen moved to count-derived sales, again.** Client-directed. Individually
recording a sale per item — even with payment method dropped, the 2026-08-13 fix — was still
too slow for the canteen's actual mid-rush trade, and the client's own established procedure
was already "count what's left, subtract from what was available." Rather than continue
optimising per-sale entry, the canteen now works that way: `recordStockCount` infers the
quantity sold for any product line short of its expected quantity, and writes it as a real
`sold` `StockMovement` — indistinguishable in the ledger from a restaurant sale's line — plus a
matching `Sale` record so revenue reporting sees it the same way. See `stock/logic.ts`'s
`recordStockCount` and `sales/logic.ts`'s `recordCountDerivedSale`.

**Why credit sales are dropped at the canteen, not merely re-inferred alongside them.** A count
cannot supply a customer's name, and running two entry paths at one location — count-derived
for cash sales, individually typed for credit — is the exact combination BUG-10 exploited the
first time: a real entry and an inferred entry, both claiming the same shrinkage, with no
reliable way to net one against the other. Dropping canteen credit entirely removes the second
path rather than reintroducing the netting problem it caused.

**Why the canteen's stock count no longer separates a sale from ordinary shrinkage.** Breakage,
a complimentary item, and a genuine sale all read identically — the gap between expected and
counted stock. Accepted as a deliberate simplification for the canteen's low-value, high-volume
goods; the restaurant's wastage/consumption/give-away tracking is unaffected and still separate
from `sold` there.

**Why a canteen count and a canteen handover no longer share a cadence.** Handover — cash and
M-Pesa she's holding — stays daily, independent of whether a count happened that day. A count
may be taken whenever the attendant does it; whatever it implies about the days since the
previous count is booked entirely on the count's own date, not spread across the intervening
days. Days between counts show no canteen sales until the count that covers them lands.

**What holds unchanged:**

- The restaurant's sale recording, credit, and correction flows — untouched by this revision.
- `docs/formulas.md` §6's canteen cost-of-goods formula — it already read `sold` movements
  directly, not the `Sale` table, so a count-derived `sold` line changes nothing about how cost
  is computed.
- M-Pesa remains independently verifiable at both locations via the messages the attendant does
  not author.

---

**2026-08-13 design, retained for record.** Both locations recorded sales individually — the
canteen without payment method per line, settled at Handover instead, with credit sales the one
exception still recorded individually with a named customer at both locations. This replaced
the original count-derived design below after BUG-10 found the canteen attendant could already
record a real sale alongside the system's own count-based inference, double-counting the same
shrinkage. That revision held for two days before the client asked for count-derived sales back
— see the revision above for why per-sale entry, even simplified, still didn't fit how the
canteen actually trades, and how credit was dropped this time to avoid reintroducing BUG-10's
exact collision.

---

**Original design, retained for record.** The canteen recorded no individual sales; instead it
declared daily cash/M-Pesa totals ("Takings"), and item-level sales were inferred by comparing
stock counts, at a cost rate measured at the last count. The stated reasons were that
requiring per-sale entry mid-rush would produce invented data, and that packaged goods are
impractical to count daily. The rejection of per-sale entry turned out to be solvable by
dropping payment method from the sale record rather than dropping the sale record itself —
see the 2026-08-13 revision above — until that too proved too slow, and the design returned
here, this time explicitly for the reason the original design already understood.

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

**What `reporting` pulls in (ticket 25).** The dashboard's Profit panel needed several reads
that didn't exist on any module's `index.ts` yet, since nothing before it needed "a figure at
an arbitrary location and period" rather than "today, at my own location": `stock` gained
ingredient stock valuation at a point in time and money-bought/issued sums over a period;
`sales` gained a location/period revenue total; `cash` gained takings and running-costs totals
over a location/period. All are owner-gated the same way as every other location-scoped read
in their module — added as narrow, additive exports, not by reaching into another module's
`queries.ts`/`logic.ts` directly.

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

**Login is a name and a four-digit PIN.** Staff use their own phones and log in mid-service
with customers waiting; an email and password is friction that gets worked around. Name
rather than phone number: it is what a staff member already knows without looking anything
up, where a phone number is one more thing to recall or mistype under pressure. `StaffMember.name`
is unique for this reason — see [ADR 0007](adr/0007-name-based-login.md) if a name collision
between two staff members is ever hit; the accepted answer today is that the owner picks a
distinguishing name (a surname, a nickname) at the point a duplicate would occur, same as she
already would for two people who happen to share a first name.

The accepted risk, unchanged from the earlier phone-based decision: a shared or observed PIN
weakens attribution, and attribution is the basis of the handover control. Mitigated by
making activity visible per person rather than by hardening the login.

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
  keeping the previous value. Not worth a reversal. (The keeping-the-previous-value half is
  **not yet built** for staff/customer records — see BUG-01 in `docs/bugs.md`. The
  `Amendment` model it needs now exists; the two update paths were simply never wired to
  it.)
- **A wrong figure on a closed day is edited in place** (ADR 0008), and the edit is recorded
  in the `Amendment` trail — what changed, from what, to what, by whom, when. Reversal is
  therefore **no longer the only mechanism**: reversal is for an event that should not have
  happened at all, amendment for an event that happened with the wrong number attached to
  it. The old backdated-correction mechanism that sat between them was deleted by
  editable-ledger T11.

**Voids are shown on the day's summary.** An undo the owner cannot see is a way to hide a
mistake; a cashier with fifteen voids in a day should be visible. Visible rather than
blocked, because blocking it makes the system unusable.

### Changing a closed day

**Superseded by ADR 0008.** The owner **edits closed figures directly, in place, from the
ledger.** One click on a cell, type the new value; the correction cascades forward
automatically because quantity is still derived from movements (ADR 0001 holds).

The previous rule here — that she records a new entry carrying a past effective date, and
the closed day keeps its original numbers — is reversed, not merely relaxed. It was
rejected for three reasons, recorded in full in ADR 0008: the one implementation of it
stamped an `effectiveAt` that no report read, so a correction for last Tuesday landed in
today's profit; the motion is an accountant's, and she is not one; and the audit argument
("a trail over figures that move silently is worthless") is answered by *building the
trail*, not by making figures immovable — an uncorrectable figure gets worked around
outside the system, where there is no trail at all.

What replaces it:

- **Every edit is recorded** — what changed, from what, to what, by whom, when — captured
  silently. She is never asked to type a reason (D3). The trail surfaces in Activity and on
  the cell itself, which carries a marker opening that figure's history.
- **Every edit confirms first**, naming the cell and both figures, and showing the real
  cascade the edit would cause — computed by the server running the amend and rolling it
  back, never predicted in the browser.
- **Handovers are frozen** (D2). `expectedCashMinor` / `expectedMpesaMinor` are never
  recomputed by anything. Where a later edit moves that day's sales, the handover row says
  so in words showing both figures. This is the one place in the system where two figures
  are meant to disagree, so it is always explained where it appears.
- **Far-back edits warn, never block** (D6). Beyond 31 days the confirm names the span. She
  remains the authority; there is no threshold at which an edit is refused.

**The cost, accepted knowingly:** "what Tuesday looked like on Tuesday" is no longer
answerable from the figures alone. It is answerable from the amendment trail, which stores
both values, but reconstructing a whole day as it originally stood means replaying
amendments rather than reading a column.

### Ledger day boundaries, stated once

Two conventions in the code decide where an amendment lands, and they differ deliberately:

- a ledger **day** D is the half-open interval `(D 00:00, D+1 00:00]` — `occurredAt: { gt,
  lte }`;
- **opening** at D is `occurredAt <= D 00:00` — the `...AsOf` reads, `lte`.

So a correction setting *opening* on D is stamped at exactly **`D 00:00:00.000`**: `lte`
includes it in D's opening while `gt` excludes it from D's own movement columns. A
correction setting *closing* on D is stamped at **`D+1 00:00:00.000`**, which is D's own
`lte` end and therefore inside D.

There is **no gap between D−1's close and D's open** — the day windows are contiguous, so
correcting D's opening moves D−1's closing with it. That is correct, and it is what the
reconciliation property in `stock/tests/amend-ledger.integration.test.ts` pins down.

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

### Product home location — a deliberate exception to "the ledger is the only source"

*Added 2026-08-13, per REQ-04 in `docs/feature-requests.md`, closing BUG-14/BUG-15 in
`docs/bugs.md`.* `Product` gained a required `locationId` — the first catalogue item to carry
location as stored data, alongside (not instead of) the movement ledger.

**This does not weaken the stock-levels rule above.** No stock *quantity* is ever stored on
`Product`; current stock is still purely the sum of movements. What's new is a different
question the ledger was never positioned to answer well on its own: *whose product is this by
default* — which location's New Sale, Production and stock-correction screens should offer it
without the location needing any transfer history first. Before this, New Sale had no way to
ask that question at all and simply offered every active product globally (BUG-14); nothing
in the ledger can answer "what should this location be able to sell before it's ever moved
anything," because the ledger only knows about movements that already happened.

**Sellable-at-a-location is the union of both sources, not either alone:**
`product.locationId === here` **OR** the product has positive current stock at `here` per the
movement ledger (i.e. it was transferred in and confirmed received). The static field decides
default visibility and where **production** may happen (a location may only produce a product
whose home location it is — production is the restaurant kitchen's act, not a generic one).
The ledger remains sole authority on **quantity** and therefore on overselling — a location
can offer a transferred-in product it doesn't own, but never sell more of anything than the
ledger says is actually there.

**Why not fold this into the ledger instead** (e.g. an implicit "default location" inferred
from first-ever movement)? Considered and rejected: it would make a brand-new product
unsellable anywhere until some movement happened to it first, which is backwards — the owner
needs to declare where a product belongs *before* any stock exists for it, the same way she
already declares its price and category at creation.

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

## Design-reference prototype locations

`/build`'s checkpoint step says to search the design-reference worktree
(`../prosper-hotel-design-reference`, find it with `git worktree list` if
the name drifts) before concluding a screen has no precedent. That search
costs an agent several minutes of exploration every time — this table is
the shortcut, found once so future tickets don't re-derive it.

**Snapshot only, not a promise.** Taken at commit `a977bea` (2026-08-06) in
that worktree. If a path below doesn't resolve, the worktree has moved on
— fall back to the real search `/build` already describes rather than
assuming the destination was never designed.

| Destination | Path in the design-reference worktree |
|---|---|
| Dashboard | `src/components/design/shell/dashboard-body.tsx` |
| Ledger | `src/components/design/ledger/ledger-r3.tsx` |
| Stock (admin valuation) | `src/components/design/shell/stock-body.tsx` |
| Money out | `src/components/design/money-out/page.tsx` |
| People | `src/components/design/people/round.tsx` |
| Activity | `src/components/design/activity/page.tsx` |
| Catalogue | already built — see `src/modules/catalogue/` in this repo |
| New sale (till) | `src/components/design/till/till-r2.tsx` |

All six admin destinations route through
`src/components/design/shell/admin-shell.tsx` and share the destination list
in `src/components/design/shell/nav.ts`. The till is filed under its own
`till/` folder, not `shell/` or `staff/` — worth knowing before concluding a
staff-shell screen has no precedent just because `staff/` only holds
`handover-body.tsx`/`round.tsx`/`shell-home.tsx`.

**Precedent existing is not the same as buildable now.** Stock's full
valuation table needs per-unit cost, which `stock/index.ts` doesn't expose
yet — ticket 04 built a deliberately smaller real view instead of the
prototype's shape. Check what the current module interface actually
returns before assuming a prototype can be built as-is.

## Non-functionals

Five users. Two locations. Roughly 150 sellable lines. A few hundred sales a day at most.

Kenyan Shillings throughout. Cash and M-Pesa tracked separately, never pooled. No regulatory
or compliance constraint beyond keeping honest records.

**Recorded explicitly to license not over-engineering.** This system does not need
scale architecture, caching layers, or horizontal anything. Correctness and speed of entry
matter; throughput does not.
