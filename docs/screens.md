# Screens — Prosper Hotel

The screen inventory `/tickets` and `/build` check against. Each row is a
Storybook story (`pnpm storybook`) rather than a mockup — the story *is*
the built, reviewed screen. `Status: approved` means the screen shipped
through a ticket and passed `/build`'s self-check (and `/review`, if the
ticket also touched logic); there is no separate design sign-off step
beyond that in this project.

This file is a catalogue of what exists, not a source of new screens —
new destinations get added here as tickets that build them land, per
`docs/conventions.md`'s note that the story file is the primary record.

## Shells and shared patterns

| Story | Path | Status |
|---|---|---|
| Shells/AdminShell | `components/layout/admin-shell.stories.tsx` | approved |
| Shells/StaffShell | `components/layout/staff-shell.stories.tsx` | approved |
| App/LoginForm | `src/app/login/login-form.stories.tsx` | approved |
| Patterns/RecordTable | `components/patterns/record-table.stories.tsx` | approved |
| Patterns/DetailPage | `components/patterns/detail-page.stories.tsx` | approved |
| Patterns/Form | `components/patterns/form.stories.tsx` | approved |
| Patterns/SummaryStrip | `components/patterns/summary-strip.stories.tsx` | approved |
| Patterns/TableToolbar | `components/patterns/table-toolbar.stories.tsx` | approved |
| Patterns/States | `components/patterns/states.stories.tsx` | approved |
| Patterns/ConfirmDialog | `components/patterns/confirm-dialog.stories.tsx` | approved |
| Patterns/HelpPanel | `components/patterns/help-panel.stories.tsx` | approved |

## Catalogue

| Story | Path | Status |
|---|---|---|
| Modules/Catalogue/CatalogueDestination | `src/modules/catalogue/ui/catalogue-destination.stories.tsx` | approved |
| Modules/Catalogue/ProductsTab | `src/modules/catalogue/ui/products-tab.stories.tsx` | approved |
| Modules/Catalogue/IngredientsTab | `src/modules/catalogue/ui/ingredients-tab.stories.tsx` | approved |
| Modules/Catalogue/RecipeList | `src/modules/catalogue/ui/recipe-list.stories.tsx` | approved |
| Modules/Catalogue/RecipeBuilder | `src/modules/catalogue/ui/recipe-builder.stories.tsx` | approved |
| Modules/Catalogue/AssetsTab | `src/modules/catalogue/ui/assets-tab.stories.tsx` | approved |
| Modules/Catalogue/CategoriesTab | `src/modules/catalogue/ui/categories-tab.stories.tsx` | approved |
| Modules/Catalogue/ProductForm | `src/modules/catalogue/ui/product-form.stories.tsx` | approved |
| Modules/Catalogue/IngredientForm | `src/modules/catalogue/ui/ingredient-form.stories.tsx` | approved |

## Stock

| Story | Path | Status |
|---|---|---|
| Modules/Stock/StockList | `src/modules/stock/ui/stock-list.stories.tsx` | approved |
| Modules/Stock/AdminStockTable | `src/modules/stock/ui/admin-stock-table.stories.tsx` | approved |
| Modules/Stock/ReceiveDelivery | `src/modules/stock/ui/receive-delivery.stories.tsx` | approved |
| Modules/Stock/IssueToKitchen | `src/modules/stock/ui/issue-to-kitchen.stories.tsx` | approved |
| Modules/Stock/RecordWastage | `src/modules/stock/ui/record-wastage.stories.tsx` | approved |
| Modules/Stock/TransferDesign | `src/modules/stock/ui/transfer-variants.stories.tsx` | approved |
| Modules/Stock/TransferHistory | `src/modules/stock/ui/transfer-history.stories.tsx` | approved |
| Modules/Stock/ConfirmTransfer | `src/modules/stock/ui/confirm-transfer.stories.tsx` | approved |
| Modules/Stock/SentTransfers | `src/modules/stock/ui/sent-transfers.stories.tsx` | in review |

## Sales

| Story | Path | Status |
|---|---|---|
| Modules/Sales/NewSale | `src/modules/sales/ui/new-sale.stories.tsx` | approved |
| Modules/Sales/CreditSale | `src/modules/sales/ui/credit-sale.stories.tsx` | approved |
| Modules/Sales/TodaysSales | `src/modules/sales/ui/todays-sales.stories.tsx` | approved |

## Cash

| Story | Path | Status |
|---|---|---|
| Modules/Cash/Handover | `src/modules/cash/ui/handover.stories.tsx` | approved |
| Modules/Cash/DashboardHandovers | `src/modules/cash/ui/dashboard-handovers.stories.tsx` | approved |
| Cash/MoneyOutDestination | `src/modules/cash/ui/money-out-destination.stories.tsx` | approved |
| Modules/Cash/Takings | `src/modules/cash/ui/takings.stories.tsx` | approved |

## Reporting

| Story | Path | Status |
|---|---|---|
| Modules/Reporting/DashboardProfit | `src/modules/reporting/ui/dashboard-profit.stories.tsx` | approved |
| Modules/Reporting/DashboardStockMovements | `src/modules/reporting/ui/dashboard-stock-movements.stories.tsx` | approved |
| Modules/Reporting/DashboardStoreMovements | `src/modules/reporting/ui/dashboard-store-movements.stories.tsx` | approved |
| Modules/Reporting/LedgerShell | `src/modules/reporting/ui/ledger-shell.stories.tsx` | approved |
| Modules/Reporting/ProductLedger | `src/modules/reporting/ui/product-ledger.stories.tsx` | approved |
| Modules/Reporting/CashLedger | `src/modules/reporting/ui/cash-ledger.stories.tsx` | approved |
| Modules/Reporting/StoreLedger | `src/modules/reporting/ui/store-ledger.stories.tsx` | approved |
| Modules/Reporting/NonSalesLedger | `src/modules/reporting/ui/non-sales-ledger.stories.tsx` | approved |
| Modules/Reporting/Activity | `src/modules/reporting/ui/activity.stories.tsx` | approved |
| Modules/Reporting/EditableNum | `src/modules/reporting/ui/editable-num.stories.tsx` | approved |
| Modules/Reporting/AmendConfirm | `src/modules/reporting/ui/amend-toast.stories.tsx` | approved |
| Modules/Reporting/AmendHistory | `src/modules/reporting/ui/amend-history.stories.tsx` | approved |
| Modules/Reporting/RecordCorrectionDialog | `src/modules/reporting/ui/record-correction-dialog.stories.tsx` | **to be deleted by editable-ledger T11** — the superseded backdated-correction mechanism (ADR 0008, D5) |

## People

| Story | Path | Status |
|---|---|---|
| Modules/People/StaffDestination | `src/modules/people/ui/staff-destination.stories.tsx` | approved |
| Modules/People/DaysWorkedTab | `src/modules/people/ui/days-worked-tab.stories.tsx` | approved |
| Modules/People/CustomersTab | `src/modules/people/ui/customers-tab.stories.tsx` | approved |
| Modules/People/CustomerDetail | `src/modules/people/ui/customer-detail.stories.tsx` | approved |

## Recent state changes (per-state additions, not new destinations)

Ticket 53 (2026-08-13) added new states to three already-listed stories,
closing BUG-14: `ProductForm` gained a required home-location `Select`;
`NewSale` and `CreditSale` gained an "own stock / from another location"
grouped split with a "Transferred in" badge on the latter
(`OwnAndTransferredIn` story on both). `StockList`'s existing canteen-only
"My stock / From restaurant" tabbed filter (2026-08-13 canteen redesign)
now classifies rows using `StockLevel.isOwn` (`Product.locationId`) instead
of its original ever-received-directly movement heuristic — same tabs,
new classification source (`CanteenBySource` story). Not added as new rows
above since the underlying screens aren't new — same rule as this file's
own note on states vs. destinations.

## Not yet built

Per `docs/roadmap.md`'s stage order — canteen operations (stage 4),
handover/close-of-day beyond restaurant (stage 5 remainder) have no
screens yet. Days worked and the pay figure (stage 7) landed via ticket
35; pay disbursement tracking ("mark as paid") landed as part of the same
ticket rather than deferred, since a pay figure with no record of what
was already paid wasn't useful on its own — see ticket 35's notes.
Reporting (stage 8) has its Profit panel (ticket 25); amounts owed
landed via ticket 36 (Customers tab); product stock valuation landed via
ticket 37 (AdminStockTable's value column); the Ledger shell and its
cost-of-goods-sold waterfall, generalised to an arbitrary period across
both locations, landed via ticket 38; the Product ledger tab (search,
location filter, owner-managed category filter from ticket 41,
day-expansion) landed via ticket 39. The Cash ledger tab (search, category
filter, day-expansion to individual transactions with method, running
cash and M-Pesa balances kept independent throughout) landed via ticket
40. The Store ledger tab (search, location filter, last-delivery-price
cost-move indicator, no day-expansion — the reference has no chevron for
this sub-ledger) landed via ticket 42. The Non-sales ledger tab (one row
per wasted/consumed/given-away entry across products and ingredients,
valued at its own snapshotted cost/selling figures, reason filter, search
by item or recorded-by, totals footer, "est" indicator for recipe-less
cost estimates) landed via ticket 43. Low stock (a filter chip on
AdminStockTable, not a separate destination — ingredient rows alongside
products, a product/ingredient type filter, and the low-stock threshold
field on ProductForm/IngredientForm) landed via ticket 44, which also
added a restaurant/canteen switcher to the Stock page so both locations
are reachable from one screen. The Activity trail (recorded/effective-
date columns with the correction row's warning treatment, kind/who
filters, search including reason text, pagination "1–N of total" rather
than infinite scroll, and the owner's minimal correction-recording
dialog reachable from its toolbar) landed via ticket 45, which also added
`Sale.effectiveAt`/`isCorrection`/`correctionReason` and
`Takings.staffMemberId` to the schema. Added to this file as their
tickets land, not speculatively ahead of them.

**2026-08-13 canteen redesign (`docs/handover-phase4-canteen-ui.md`), design
pass items 1–4.** `NewSale` extended in place (no new row) — for
`role === "attendant"`, payment lines are no longer required to complete a
sale (proposal.md §4). `StockList` extended in place (no new row) — a
canteen-only My stock / From restaurant tab, backed by a new
`getCurrentStockAtLocationBySource` read (`stock/logic.ts`) that classifies
each product by whether it's ever had a `received` movement at that
location. `ConfirmTransfer` (approved) is the new receive-confirmation
screen (items 2 and 4 share it — banner-reachable, not a home-screen tile,
at both locations). `SentTransfers` (in review) is item 4's reconciliation
view — confirmed transfers a location sent, sent-vs-confirmed quantity,
backed by a new `getConfirmedTransfersSentFromLocation` read. Both new
reads are additive; `listTransfersAtLocation` (TransferHistory) was
deliberately left untouched — it still reconstructs from movements, which
under-represents a still-pending two-sided transfer; fixing that is item
5's job, not folded in here.

**2026-08-13 canteen redesign, items 5–8 (`docs/handover-phase4-canteen-ui-items5-8.md`).**
`TransferHistory` (row above, still `approved` — same story file, not a
new row) is now correct and reachable: `listTransfersAtLocation` rewritten
to read the `Transfer` model directly (`status`, `confirmedQuantity`)
instead of reconstructing from movement pairs — see `docs/gotchas.md`'s
2026-08-13 entry on why the old approach under-represented pending
transfers. Added as a `staffLinks`/`staffNav` tile for `store-manager` and
`attendant` (10th and 10th tile respectively) — **flagged, not silently
absorbed:** both roles already exceeded `docs/design.md`'s 5–8-destination
target before this addition (store-manager was at 10, attendant at 9);
Edwinfred's 2026-08-13 call was to add the tile now (item 7's cancel
action needs a home) and treat the nav-budget-wide question as its own
follow-up, not a blocker for this batch. Item 7 (cancel a still-pending
send) is a Cancel action on the sender's own pending rows within
`TransferHistory`, not a separate screen — confirmed with Edwinfred.
`TodaysSales` (row above, still `approved`) renamed "Today's summary" in
nav; for `role === "attendant"` only, a `SummaryStrip` above the list adds
sales-today (cash+M-Pesa), transfers received/sent today (confirmed,
same-day filtered client-side from `listTransfersAtLocation`), and
closing stock — composed from items 2–5's already-decided data shapes,
no new backend read. `DashboardProfit`/`LedgerShell` (rows above, still
`approved`) had their local view types corrected to match
`getDashboardProfit`/`getLedgerSummary`'s real response shape — the
`canteenCostRate`/`lastCanteenCount`/`canteenEstimated`/`provisional`
fields these two components read no longer exist in the API (see
`docs/gotchas.md`'s "Closed, 2026-08-13" note); canteen figures now
render the same way as the restaurant's, no provisional badge.
`SentTransfers` stays `in review` pending Edwinfred's explicit look during
this batch's end-of-work real-browser verification pass, per his
2026-08-13 instruction to bundle that check rather than ask separately.

## Note on naming

Story titles aren't fully consistent (`Modules/Cash/...` vs.
`Cash/MoneyOutDestination` for money-out) — flagged here per `/adopt`'s
"inconsistency is a decision point" principle rather than silently
averaged away. Not worth a ticket on its own; worth fixing the next time
that file is touched for an unrelated reason.
