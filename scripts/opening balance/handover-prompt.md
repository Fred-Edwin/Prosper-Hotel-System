> **HISTORICAL — August 2026. Do not execute this.** This prompt describes
> the one-off legacy catalogue import, which is long since done. It is kept
> only for the reasoning in "Why stock-count correction, not
> receiving/delivery" below, which still holds.
>
> It references `scripts/clear-transactions-keep-catalog.ts`, **which no
> longer exists** (deleted 2026-08-17). Anything about resetting trading data
> while keeping stock now lives in `docs/data-reset-findings.md` — read that
> instead.

I want to start completely fresh with the local database's catalog and stock data. Here's the full context and the plan we already agreed on — please execute it (confirming any remaining open point with me first if you find one).

## Background

We're loading real closing-stock data from the old legacy system into this app (Prosper Hotel — a stock/sales/cash system for a restaurant+canteen). Two source files already exist in the repo:

- `scripts/opening balance/v2-catalog-export.json` — full catalog export: 100 products (name, category, supply_type, buying_price, selling_price, low_stock_threshold, active) + 43 ingredients (name, unit, buying_price, low_stock_threshold, active) + delivery_locations.
- `scripts/opening balance/v2-closing-stock-2026-08-14.json` — closing stock snapshot as of 2026-08-14: items array (name, location, last_entry_date, closing_stock, closing_stock_value, stale) and ingredients array (name, last_entry_date, closing_stock, stale). Read the file's own `note` field — items never logged at all are absent, not zero; `stale: true` means the last entry was before 2026-08-10.

There's also an older markdown version of the closing-stock doc at `docs/opening balance/v2-closing-stock-2026-08-14.md` — same data, superseded by the JSON now that it exists. Ignore the markdown; use the JSON.

## Why "stock-count correction," not "receiving/delivery"

This was worked out carefully in a prior session — don't re-derive it, just follow it:

- `StockMovementReason.received` (the receiving/delivery feature) mutates `lastKnownCostMinor` (running average cost) via `recordProductCost`/`recordIngredientCost`, AND feeds `sumIngredientsBoughtMinorAtLocationInPeriod`, which is the "bought" term in the restaurant's cost-of-goods-sold formula (`opening + bought − closing − transfer`, see `docs/formulas.md` and `src/modules/reporting/logic.ts`). Using it to load a physical count (not a real purchase) would fabricate purchase costs and distort COGS/profit — including corrupting the cost basis for all *future* real sales, not just today.
- `StockMovementReason.corrected`, via `stock/logic.ts`'s `correctStockCount` (called after `recordStockCount` creates a `StockCount`/`StockCountLine`), does NOT touch `lastKnownCostMinor` and does NOT feed the "bought" sum. Closing stock quantity is derived as a sum of ALL movements regardless of reason (no reason filter in `sumIngredientMovementsAtLocationAsOf` / `sumMovementsByProductAtLocationAsOf`), and closing stock VALUE is a separate downstream multiplication by the item's existing cost — so a correction correctly produces a real closing-stock value without polluting COGS.
- **Conclusion, already validated**: load all quantities via `recordStockCount` (owner, per location) + `correctStockCount` per line, NOT via receiving.

## Known COGS caveat (already explained to the user, don't re-derive)

Since we're only loading closing stock and there's no opening stock or purchases in this fresh dataset, the COGS formula `opening(0) + bought(0) − closing = -closing` will show a NEGATIVE COGS figure for today's date. This is mathematically expected, not a bug, and not fixable by fabricating a matching opening-stock entry (that would misstate a real trading period as having zero activity, which isn't true either). The user understands and accepts this. Worth checking once the load is done whether reporting screens default to a sensible date range so this artifact doesn't confuse the owner day-to-day — flag it, don't necessarily build anything unasked.

## Decisions already made — do not re-ask these

1. **DB wipe scope**: keep `Location` (2 rows: restaurant, canteen) and `StaffMember` (8 rows, incl. one owner "Admin Owner") intact. Wipe everything else to zero: Product, Category, Ingredient, Recipe, RecipeLine, StockMovement, IngredientMovement, StockCount, StockCountLine, Sale, SaleLine, PaymentLine, Customer, Repayment, Handover, Expense, DrawingDebt, DrawingRepayment, DaysWorked, Asset, Transfer, Session. A script for exactly this already exists: `scripts/clear-transactions-keep-catalog.ts` — but it currently does NOT wipe Product/Category/Ingredient (an earlier session's script). You need it to ALSO wipe those three this time (extend the script or write a new one) — check for FK order (Recipe/RecipeLine reference Product/Ingredient, so delete those before Product/Ingredient).
2. **Categories**: create from the catalog export's `category` field values (beverages, snacks, meals, fruits, cyber, stationery, dawa) as real `Category` rows, and link each product to its category.
3. **Product kind mapping**: `category: "meals"` → `ProductKind.cooked_food`. These specific cyber-category items → `ProductKind.service` (no physical stock unit, it's a service charge): Binding, Photocopy, Spiral Binding, Spiral Binding (70), Tape Binding, Paste, Logbook, Logbook Assessment, Logbook HSA, Logbook Industrial, Printing/Papers, Blue Forms, Research, SHA & Others. Everything else (beverages, snacks, fruits, stationery, dawa, and any other cyber item not listed above) → `ProductKind.goods`.
4. **Location mapping from `supply_type`**: `restaurant_only` → restaurant. `canteen_independent` → canteen. `canteen_supplied` → **restaurant** (this is the important one — these are items the restaurant produces/owns and the canteen just sells; `Product.locationId` is documented as "home location," not "where stock currently sits," so production location wins even though canteen also holds/sells stock of it — matches how the closing-stock JSON lists the same item name under both `restaurant` and `canteen` location sections).
5. **Pricing/cost seeding**: `selling_price` → `Product.priceMinor` (multiply by 100, round). `buying_price` → seed `Product.lastKnownCostMinor` / `Ingredient.lastKnownCostMinor` directly (multiply by 100, round) — this is real historical cost data from the source system, not a fabricated movement, so it's fine to write directly via `recordProductCost`/`recordIngredientCost` (or directly via the catalogue queries — check which is more appropriate; `recordProductCost`/`recordIngredientCost` compute a *running average*, which for a from-scratch seed with `quantityOnHand: 0` just sets the average to the given cost directly — confirmed in `catalogue/logic.ts`'s `runningAverageMinor`). A `buying_price` of `"0.00"` in the export means no real cost recorded — treat as null, not zero, same nullable-until-set convention as the schema comments describe.
6. **`low_stock_threshold`** from the export → `Product.lowStockLevel` / `Ingredient.lowStockLevel`.
7. **`active` field** from the export → `Product.active` / `Ingredient.active`. Note: the ingredient "Smokies" (`Pkt` unit) is `active: false` in the source data — this is intentional/pre-existing in the legacy system, not a local accident. The closing-stock JSON still lists a Smokies ingredient quantity (5), but `recordStockCount` rejects a batch containing any inactive item — so this line must be skipped, not force-reactivated. (Note there is ALSO a *product* called "Smokies" in the canteen/restaurant, category snacks, which IS active — don't confuse the two; they are different catalog entities that happen to share a name.)
8. **Duplicate product names across locations**: a few product names appear twice in the catalog export with different `supply_type` (e.g. "Dasani 500ml" appears as both `restaurant_only` and `canteen_independent`, "Dasani 1 lit" vs "Dasani 1lit"). Since `Product.name` has a `@unique` DB constraint, these need distinguishing names when creating (e.g. suffix with location, similar to how the current dev DB already has "Dasani 500ml (Restaurant)" / "Dasani 500ml (Canteen)" — check the export carefully for every such collision, not just Dasani, before creating).
9. **Ingredient "Smokies" cost**: `buying_price: "560.00"` exists in the export despite being inactive — fine to seed the cost anyway (doesn't matter since it can't be counted while inactive).

## What to actually do, in order

1. Read both JSON files fully if you haven't (they're not huge — do it directly, don't sample).
2. Detect and resolve any product-name collisions in the catalog export (see point 8) — list them for the user if the resolution isn't obvious, otherwise proceed with a location-suffix convention consistent with the existing DB naming.
3. Write/extend a script to wipe Product, Category, Ingredient, Recipe, RecipeLine, plus all transactional tables (reuse `scripts/clear-transactions-keep-catalog.ts`'s existing list and extend it), keeping Location/StaffMember. Support `--dry-run`. Run dry-run, show the user counts, get explicit confirmation before running for real (this is a destructive DB wipe — confirm scope and get a go-ahead, per this project's working rules on infrastructure/destructive actions).
4. Write a script that creates Categories, then Products and Ingredients from the catalog export, using the real module logic (`createProduct`, `createIngredient`, `createCategory` from `src/modules/catalogue/index.ts`) as an owner `AuthenticatedStaff` — not raw Prisma writes — so permissions/validation paths are respected exactly like a real owner action. Seed cost via `recordProductCost`/`recordIngredientCost` immediately after creation where `buying_price` is present and non-zero.
5. Dry-run this creation script, show a summary, confirm with the user before running for real.
6. Write/adapt the closing-stock loader (a prior version exists as `scripts/load-closing-stock.ts` and `scripts/load-closing-stock-ingredients-only.ts` from the markdown-based load — these are now stale since the catalog will be rebuilt from scratch; adapt them to read the JSON directly instead of parsing markdown, and to NOT need to create missing products this time since step 4 already creates the full catalog). Use `recordStockCount` + `correctStockCount` per location (restaurant, canteen) for products, and once for ingredients (recorded at the restaurant location — "central store," confirmed with user in the prior session since `IngredientMovement` requires a `locationId` and only the restaurant has recipes consuming ingredients). Skip the inactive "Smokies" ingredient line. Dry-run, confirm, then run for real.
7. Verify the end state: query `stockMovement`/`ingredientMovement` grouped by `reason` (should be 100% `corrected`, zero `received`), confirm `Expense` count is unaffected/zero from this load, and spot-check a couple of closing-stock values against the JSON (quantity and derived value).
8. Report back to the user in plain, simple language (they are non-technical about this app's internals — keep explanations concrete, avoid jargon, use short lists) what was created/loaded, any items skipped and why, and remind them this was the LOCAL database only — production is a separate, later step they'll ask for explicitly.

## Working style reminders for this task

- This project's CLAUDE.md requires confirming scope before touching real infrastructure — local DB destructive wipes still warrant an explicit go-ahead each time, dry-run first.
- Follow `queries.ts` (bare Prisma) / `logic.ts` (composes + enforces rules) separation — call `logic.ts` functions from scripts, never raw `db.*` writes for anything that has a logic-layer equivalent (catalogue creation, stock counts). Raw Prisma is fine only for things with no logic-layer equivalent (e.g. bulk deletes in the wipe script, following the existing `clear-transactions-keep-catalog.ts` pattern).
- Use `npx tsx scripts/<name>.ts` to run scripts, `DATABASE_URL` from `.env` already points at the local dev DB (`postgresql://prosper:prosper@localhost:5432/prosper_hotel`) — don't touch `TEST_DATABASE_URL`.
- Clean up any throwaway inspection scripts you create along the way (this session left behind exactly the two loader scripts named in point 6 above and `scripts/clear-transactions-keep-catalog.ts` — those are legitimate keepers, not throwaway).
- Do not touch production in this session. That's explicitly a future step the user will ask for separately.
