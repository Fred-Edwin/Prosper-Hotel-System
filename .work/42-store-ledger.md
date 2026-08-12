# 42 — Store ledger

**Type:** logic (test-first)
**Blocked by:** 38 (needs the Ledger shell to host this tab in — already
built and merged)
**Status:** done

**Claimed:** Claude Code — 2026-08-12.

## Goal

Make the Ledger's Store tab real: one row per ingredient, opening/
purchased/out/closing quantities and values for the selected period,
completing the Ledger's second sub-ledger per proposal.md §9's stock
history requirement, this time for ingredients rather than products.

## Context

- Design precedent: `~/prosper-hotel-design-reference/src/components/design/ledger/tables.tsx`'s
  `StoreLedgerTable` — one row per ingredient (opening qty/value,
  purchased qty/value/unit cost with a running-average cost-move
  indicator, out: to-kitchen/transferred/spoilage, closing qty/value),
  search by name, no location split shown in the reference (check
  whether ingredients are restaurant-only in this codebase — if so, no
  location filter is needed; if ingredients also exist at the canteen,
  split by location same as the Product ledger).
- Data sources already built, per-ingredient, at a location, over a
  period: `stock`'s `sumIngredientsBoughtMinorAtLocationInPeriod`,
  `sumIngredientsIssuedByIngredientAtLocationInPeriod`,
  `sumIngredientMovementsAtLocationAsOf` (opening/closing quantity as of
  a date), `getIngredientStockValueAtLocation` (ticket 25's opening/
  closing value at a date) — reuse rather than re-querying
  `IngredientMovement` directly.
- Ingredient movement reasons: `received` (purchased), issued to kitchen,
  transferred out, wasted/spoilage — check `prisma/schema.prisma`'s
  `StockMovementReason` enum (shared with `StockMovement`) for the
  authoritative set, since `IngredientMovement` reuses the same enum.
- Running-average unit cost and its "moved from X" indicator: `Ingredient
  .lastKnownCostMinor` is the current running average; the reference
  shows the *previous* value alongside it to indicate movement — this
  ticket's real logic work is computing what the average was at the
  start of the period vs. now, since only the current value is stored
  (no historical cost snapshots exist for ingredients, same simplification
  `docs/gotchas.md`/ticket 37 already made for products).
- `docs/design.md`'s Ledgers and tables section — one row per subject per
  period, frozen first column, "N of M" filtered counts.

## Scope

**In:**
- A `getStoreLedger` reporting function: given a period and optional
  location filter, returns one row per ingredient with opening qty/value,
  purchased qty/value, current unit cost (and the value it moved from
  over the period, if it changed), issued-to-kitchen/transferred-out/
  spoilage quantities, closing qty/value.
- Route + wiring the Store ledger tab in the Ledger shell to this real
  data, replacing its placeholder state.
- Search by ingredient name, matching the reference's toolbar.

**Out:**
- Product, Non-sales, Cash ledgers — other tickets.
- Day-by-day expansion — the reference's Store ledger has no chevron/
  expansion (unlike Product and Cash), one row per ingredient for the
  whole period is the full shape here; don't add expansion the design
  didn't ask for.
- Recipe-level ingredient consumption breakdown (which recipes used how
  much of an ingredient) — not in proposal.md's spec for this report.

## Acceptance criteria

- [x] Store ledger row's quantities reconcile: opening + purchased − out
      = closing, for a constructed multi-day fixture with purchases,
      kitchen issues, transfers, and wastage.
- [x] Unit cost shown is the ingredient's current running average; where
      it changed during the period, the previous value and direction are
      shown (matches the reference's up/down indicator).
- [x] Searching by name narrows correctly; empty and filtered-empty
      states are visually distinct.
- [x] Non-owner roles cannot reach this data (route-level check, same
      gate as the rest of `reporting`).
- [x] Storybook story: populated table, cost-moved indicator shown, empty,
      filtered-empty, loading.

## Verification

- Integration tests, test-first: `getStoreLedger` against constructed
  fixtures covering purchases, kitchen issues, transfers-out, wastage, and
  a cost change within the period.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- Add the story to `docs/screens.md`'s Reporting section.
