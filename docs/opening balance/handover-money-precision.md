# Handover: migrate money fields (`*Minor`) from Int to Decimal — cent-level precision

## Role

You're a backend/data-modeling engineer working on Prosper Hotel, a
stock/sales/cash system for a restaurant+canteen (see root `CLAUDE.md` and
`AGENTS.md` before writing any code — this Next.js version has
breaking-change docs in `node_modules/next/dist/docs/`). This is a schema
migration ticket: widen every money field from whole-shilling `Int` to
cent-precise `Decimal`, mirroring a migration already done for *quantity*
fields. Read this whole document before starting; it names the precedent to
copy and the traps to avoid.

## Why this is needed

While loading real legacy data (`scripts/opening balance/v2-catalog-export.json`,
`scripts/import-v2-catalog.ts`), we found the source system records prices
and costs to the cent — e.g. Cooking oil costs KSh 253.33, Potatoes KSh
326.81, Milk Glass KSh 32.50. But every money field in this schema
(`priceMinor`, `lastKnownCostMinor`, `costBasisMinor`, `totalMinor`, etc.)
is declared `Int?` or `Int` — whole shillings only. Loading real costs into
these fields silently rounds them (253.33 → 253, 326.81 → 327), losing real
precision the business actually has in its historical data and will
continue to have in future entries (delivery prices, weighed-portion costs,
etc.).

The user wants exact cent precision preserved and displayed — "if it's
253.33, it should show exactly that."

## Important: what this ticket is NOT

This is unrelated to a *different*, already-completed migration
(`cdf5f73 feat: migrate quantity/threshold fields from Int to Decimal(10,2)`,
2026-08-14) that widened *quantity* fields (StockMovement.quantity,
Product.lowStockLevel, Recipe.yieldQuantity, etc.) so fractional stock
counts (3.5 kg, 0.5 kg) could be stored. That migration is done, correct,
and out of scope here — do not touch quantity fields again. This ticket is
the money-field sibling of that migration, using the same technique.

Also unrelated: `docs/bugs.md` BUG-11, where a UI form multiplied a
shilling amount by 100 as if converting to cents — this codebase's `*Minor`
fields are **not** cents-scaled today (see `src/shared/money.ts`'s comment:
"Every `*Minor` field is plain whole shillings — there is no minor unit.
Nothing should ever scale a shilling amount by 100"). That comment and
convention will need to be revisited as *part of* this ticket (see below) —
but don't confuse "no minor-unit scaling exists" (true today, and this
ticket doesn't have to change that) with "no fractional shillings exist"
(the actual gap this ticket closes). This ticket is about decimal
*precision within* whole shillings (253.33 shillings), not about
introducing a cents-multiplier convention.

## The precedent to follow: `cdf5f73`

Run `git show cdf5f73` to see the full worked example. Summary of its
approach, which this ticket should mirror field-for-field:

1. **Schema**: change `Int` → `Decimal @db.Decimal(10, 2)` (or similar
   precision — see "Precision" below) in `prisma/schema.prisma`, with a
   short doc comment on each field explaining why (matches this file's
   existing comment style throughout the schema).
2. **Migration**: `prisma migrate dev` generates the SQL migration. Confirm
   it's a lossless `ALTER COLUMN ... TYPE numeric(...)` — no data loss for
   existing whole-shilling rows, same as the quantity migration's migration
   file.
3. **`queries.ts` boundary**: Prisma returns `Decimal` fields as
   `Decimal.js` objects, not plain numbers. Every `toX()` mapper function in
   each module's `queries.ts` needs `.toNumber()` calls added, exactly like
   `catalogue/queries.ts`'s existing `toProduct`/`toIngredient` do for
   `lowStockLevel` today (see lines ~11-36 there for the pattern). This
   keeps `logic.ts`, `routes.ts`, and UI code untouched — decimal handling
   is fully contained at the queries.ts boundary, per this codebase's
   queries.ts (bare Prisma) / logic.ts (business rules) split.
4. **Forms**: check for any UI input that does `Math.round()` or similar
   truncation on a money field before submitting — `cdf5f73`'s commit
   message notes it found three catalogue forms silently truncating
   fractional `lowStockLevel` input this way. Money-field equivalents
   (price input on `product-form.tsx`, cost input wherever
   `recordProductCost`/`recordIngredientCost` are called from the UI, etc.)
   need the same audit.
5. **Tests**: existing integration tests asserting whole-number money
   values should keep passing unchanged (lossless cast — nothing round-trips
   differently for existing whole-number data, per the precedent commit).
   Add new coverage for a fractional money value round-tripping correctly
   (e.g. record a cost of 253.33, read it back, assert it's still 253.33 —
   not 253).

## Fields in scope

Every field ending `Minor` in `prisma/schema.prisma`, currently `Int` or
`Int?` (grep confirmed these — recheck at start of work in case the schema
has moved on):

- `StaffMember.dailyRateMinor` — `Int`
- `Product.priceMinor` — `Int?`
- `Product.lastKnownCostMinor` — `Int?`
- `Ingredient.lastKnownCostMinor` — `Int?`
- `Sale.totalMinor` — `Int`
- `Sale.deliveryFeeMinor` — `Int?`
- `SaleLine.priceMinor` — `Int`
- `PaymentLine.amountMinor` — `Int`
- `Repayment.amountMinor` — `Int`
- `StockMovement.costBasisMinor` — `Int?`
- `StockMovement.sellingValueMinor` — `Int?`
- `IngredientMovement.unitCostMinor` — `Int?`
- `IngredientMovement.costBasisMinor` — `Int?`
- `IngredientMovement.sellingValueMinor` — `Int?`
- `Handover.expectedCashMinor` — `Int`
- `Handover.expectedMpesaMinor` — `Int?`
- `Handover.actualCashMinor` — `Int`
- `Handover.actualMpesaMinor` — `Int`
- `Expense.amountMinor` — `Int`
- `DrawingDebt.amountMinor` — `Int`
- `DrawingRepayment.amountMinor` — `Int`

Also check `delivery_locations[].fee` handling if a `DeliveryLocation`
model or equivalent exists by the time this ticket is picked up — the
catalog export has fee values like "150.00" that are currently whole
numbers too, same story.

## Precision

Source data seen so far never exceeds 2 decimal places (cents-equivalent —
253.33, not 253.333). `Decimal(10, 2)` (matching the quantity migration's
precision choice) is very likely correct; confirm against
`scripts/opening balance/v2-catalog-export.json`'s `buying_price` values
before committing to it, and check whether any existing formula in
`docs/formulas.md` or `reporting/logic.ts` divides money in a way that
could need more than 2 decimal places of intermediate precision (e.g. a
running average cost calculation) — if so, consider whether the *stored*
precision should stay 2dp (display-level) while intermediate math uses
full `Decimal.js` precision before a final round, rather than rounding at
every write.

## Display

`src/shared/money.ts`'s `money()` currently formats with
`maximumFractionDigits: 0` — whole shillings only, by design (that's why
"KSh 3" not "KSh 2.50" was correct *display* behavior even before this
migration, for a rounded-to-whole-shilling stored value). Once storage
supports cents, decide with the user whether `money()` should now show
decimals when the underlying value has them (e.g. "KSh 253.33") or
continue rounding for display while storing exactly — this is a real
product decision, not just a technical one, and belongs in front of the
user before changing shared display formatting used across every money
figure in the app. Don't assume; ask.

## Data to re-verify once done

`scripts/opening balance/v2-catalog-export.json` and
`scripts/opening balance/v2-closing-stock-2026-08-14.json` are the real
source data already loaded into the local dev DB via
`scripts/clear-catalog-and-transactions.ts` +
`scripts/import-v2-catalog.ts` + `scripts/load-closing-stock.ts` (see
recent git history / conversation for that load). Once this schema
migration lands, that catalog/stock data should be **reloaded** (same
wipe-then-import scripts) so the real fractional costs (Cooking oil
253.33, Potatoes 326.81, etc.) are captured at full precision instead of
the whole-shilling rounding the current data has. Confirm with the user
before wiping local data again — same destructive-action rule as any other
local DB wipe (see root `CLAUDE.md`'s Working rules).

## Out of scope

- Do not touch quantity/threshold fields — already `Decimal(10,2)`, done in
  `cdf5f73`.
- Do not reintroduce a cents-multiplier (`* 100`) anywhere — that's the
  exact mistake BUG-11 fixed and this ticket must not resurrect it. Money
  stays plain shillings, just with decimal precision now.
- Do not touch production — this is local-dev-only work until the user
  explicitly asks for a production migration.
