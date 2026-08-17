# Resetting trading data while keeping stock — what you need to know first

Written 2026-08-17, after the owner asked to clear a weekend of inaccurate
trading data while keeping the catalogue, prices and current stock figures.

**Nothing in this document has been run against production.** It records
what was learned reading the code and inspecting the live droplet, so the
next attempt doesn't rediscover it. Scripts written during that session were
deliberately deleted — they were untested, and a fresh implementation
informed by these findings is better than inherited code nobody has run.

Read this before writing any reset tooling.

---

## The request, in the owner's words

> "Only the Items, Opening, Closing Stock, Buying and Selling price should
> remain."

Concretely: on the ledger, African Tea reads opening 32 / closing 32 today.
After the reset it must still read 32 / 32, with all purchases, sales and
history gone, so staff start trading from the real shelf quantities.

---

## Trap 1: stock is not stored, it is derived

**There is no `quantityOnHand` column anywhere.** A stock level is the SUM of
that item's `StockMovement` rows (`sumMovementsByProductAtLocation` in
`stock/queries.ts`). Ingredients work the same way via `IngredientMovement`.

So "delete the transactions" and "keep the closing stock" are mechanically
in direct conflict — deleting movements takes **every item to zero**.

The only correct shape is:

1. **Snapshot** the derived figure for every item at every location
2. **Wipe** the transactional tables
3. **Replay** the snapshot back in as an opening balance
4. **Verify** the post-reset figures match the snapshot line for line

The snapshot MUST be taken before the wipe. It is the only record of the
position outside the `pg_dump`.

---

## Trap 2: date the replay to YESTERDAY, not now

Reporting periods filter `occurredAt > periodStart AND <= periodEnd`, while
opening stock is `occurredAt <= asOf` (both in `stock/queries.ts`).

A movement dated **yesterday evening** therefore falls *outside* today's
period but *inside* today's opening balance — today opens at the counted
figure and, with no trading yet, closes at the same figure. Exactly the
"African Tea 32/32" position the owner expects.

Dating it **today** puts opening=0 plus a correction inside the period. With
opening=0 and bought=0, the cost-of-goods-sold formula (`docs/formulas.md`
§6) produces a large negative number and a nonsense net profit. This already
happened once on 2026-08-14 and forced the hardcoded workaround still sitting
in `src/modules/reporting/ui/opening-balance.ts`. Do not repeat it.

The artifact day lands on yesterday instead — acceptable, since yesterday is
part of the period being abandoned anyway.

**Note:** `recordStockCount`, `createStockCount` and `correctStockCount` do
NOT accept an `occurredAt` — they default to `now()`. Either thread a date
through them, or re-stamp the created rows afterwards. Re-stamping keeps
live business logic untouched, which is preferable for a one-off.

---

## Trap 3: `recordStockCount` rejects a whole batch for one bad item

`recordStockCount` returns `{ ok: false, reason: "inactive_item" }` if ANY
line references an inactive product or ingredient. One inactive item holding
stock fails the **entire location's count**, not just its own line. This bit
the August load (the "Smokies" case).

Check for inactive-items-with-stock BEFORE wiping, while it's still free to
abort.

---

## Trap 4: `correctStockCount` writes a DELTA, not an absolute

The delta is `correctedQuantity - expectedQuantity`. This is only equal to
the full counted quantity when the movements table is EMPTY (expected = 0).

Running a replay against a non-empty movements table produces deltas, not
opening balances — silently doubling or halving every figure. Guard for an
empty table before replaying.

Two related subtleties in `stock/logic.ts`:

- **Canteen shortfalls:** `recordStockCount` auto-books a `sold` movement for
  a canteen product shortfall. `correctStockCount` compensates by switching
  its delta base to `countedQuantity` for that case only. Against an empty
  table the auto-sale is inert (expected=0 makes the shortfall negative,
  filtered by a `> 0` guard), so no phantom sales — but understand this
  before touching either function.
- **`invalid_cost`:** a product with no recipe cost, no `lastKnownCostMinor`
  and no `priceMinor` has its correction **silently dropped** and reloads at
  zero. Find these before wiping.

---

## Trap 5: replay as `corrected`, never as `received`

Receiving mutates `lastKnownCostMinor` via the running-average cost update
AND feeds `sumIngredientsBoughtMinorAtLocationInPeriod`, the "bought" term in
cost-of-goods-sold. Loading a physical count as a purchase fabricates spend
the owner never made and distorts COGS — including the cost basis of every
future real sale.

A stock-count correction touches neither. This was settled during the August
load; don't revisit it.

---

## What gets deleted vs kept

**Delete** (transactional): `DrawingRepayment`, `DrawingDebt`, `Asset`,
`Expense`, `Handover`, `DaysWorked`, `PaymentLine`, `SaleLine`, `Sale`,
`Repayment`, `Customer`, `StockCountLine`, `StockCount`, `Transfer`,
`StockMovement`, `IngredientMovement`.

Delete order follows foreign keys — children before parents. `Asset`
references `Expense` (nullable FK) so it must go first. `Customer` is
referenced by `PaymentLine`/`Sale`/`Repayment` so it goes after those. Wrap
it in one transaction: a partial wipe leaves the books in a state that is
neither the old position nor a clean one.

**Keep** (catalogue + identity): `Location`, `StaffMember`, `Product`,
`Category`, `Ingredient`, `Recipe`, `RecipeLine`. Prices live on these
(`priceMinor`, `lastKnownCostMinor`) and are untouched.

Staff PINs and accounts survive — nobody re-registers.

**Owner decisions from 2026-08-17:** no assets and no days-worked were ever
recorded (assert this and abort if non-zero). Customer credit data is not
needed — delete without exporting.

---

## The production environment — where the previous attempt lost time

Three wrong assumptions were made here. All are verified facts now:

**SSH alias is `prosper-hotel-prod`** (root) — not `prosper-hotel`. There is
also `prosper-hotel-deploy` (the restricted CI user). Both in
`~/.ssh/config`, both keyed to `~/.ssh/wendo_droplet`.

**The droplet has NO source checkout.** `~/prosper-hotel` on the droplet
holds only `docker-compose.prod.yml`, `Caddyfile`, `.env`, `.env.deploy`,
`backup.sh`, `~/backups/`. There is no `scripts/`, no `src/`, no `prisma/`.

**The app image cannot run scripts.** It's a Next.js *standalone* build — the
Dockerfile copies only `.next/standalone`, `.next/static` and `public`.
`docker exec ... ls /app` shows exactly `node_modules  package.json  public
server.js`. No `tsx`, no source. Deploying first does not help; the standalone
build is by design. Shipping scripts would need a Dockerfile change, a
deploy, and a revert.

**Postgres publishes no host ports.** `docker port prosper-hotel-postgres-1`
returns nothing — it's reachable only on the Docker network (container was at
`172.18.0.2`, but that IP is not stable across restarts; look it up).

**Therefore: run reset tooling from the developer's laptop, over an SSH
tunnel to the Postgres container.** The laptop has the source and module
tree; the droplet has the data.

```bash
# Terminal 1 — leave running
PGIP=$(ssh prosper-hotel-prod "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' prosper-hotel-postgres-1")
ssh -N -L 15432:$PGIP:5432 prosper-hotel-prod

# Terminal 2 — from ~/prosper-hotel on the laptop
export DATABASE_URL="postgresql://prosper:<POSTGRES_PASSWORD>@localhost:15432/prosper_hotel"
```

`POSTGRES_PASSWORD` is in `/home/deploy/prosper-hotel/.env` on the droplet
and nowhere else (`docs/infrastructure.md`). DB is `prosper_hotel`, user
`prosper`.

Use `export`, not the `.env` file — a real environment variable beats
`dotenv/config`, and editing `.env` risks pointing `pnpm dev` at production
later.

**`psql` is not installed** on the laptop or the droplet host. Verify the
tunnel with a read-only Prisma script (e.g. `scripts/get-location-ids.ts`)
instead. `pg_dump` runs inside the container:

```bash
ssh prosper-hotel-prod 'docker exec prosper-hotel-postgres-1 pg_dump -U prosper prosper_hotel' \
  > ~/prosper-backup-pre-reset-$(date +%Y%m%d-%H%M%S).sql
```

Check the dump's size before proceeding. `~/backups/` on the droplet also has
nightly dumps (03:00 UTC, 14-day retention) as a second net.

---

## Sequence that was agreed

1. `pg_dump` to the laptop — the only undo
2. Snapshot current derived stock (read-only) + a plain-text sign-off sheet
3. **Owner confirms the figures** — after the wipe this sheet is the only record
4. Preflight (read-only): no-cost-basis, inactive-with-stock, negative quantities
5. Wipe, in one transaction
6. Replay dated `2026-08-16T23:59:00` (yesterday's close)
7. Verify against the snapshot, then check the live ledger reads 32/32

Steps 5 and 6 are **one operation** — between them the business reads as zero
stock. Nobody trades until step 7 passes.

---

## Follow-up owed to the owner

**Build a stock adjustment screen.** The owner asked to replace derived stock
with stored, editable quantities. The real problem is that there is no
owner-facing way to correct a figure — not that stock is derived. A stored
column would mean two sources of truth that drift, and would destroy the
audit trail that makes the ledger, waterfall and COGS work.

`correctStockCount` already does the work; it just isn't exposed as a screen.
Owner opens an item, types the correct number, gives a reason — five seconds,
writes a correcting movement underneath, history survives. That was the
recommendation. **The owner has not yet accepted or rejected it**; if they
still want stored levels after hearing this, that's their call to make.
