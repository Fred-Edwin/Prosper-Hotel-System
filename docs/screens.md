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

## Catalogue

| Story | Path | Status |
|---|---|---|
| Modules/Catalogue/CatalogueDestination | `src/modules/catalogue/ui/catalogue-destination.stories.tsx` | approved |
| Modules/Catalogue/ProductsTab | `src/modules/catalogue/ui/products-tab.stories.tsx` | approved |
| Modules/Catalogue/IngredientsTab | `src/modules/catalogue/ui/ingredients-tab.stories.tsx` | approved |
| Modules/Catalogue/RecipeList | `src/modules/catalogue/ui/recipe-list.stories.tsx` | approved |
| Modules/Catalogue/RecipeBuilder | `src/modules/catalogue/ui/recipe-builder.stories.tsx` | approved |
| Modules/Catalogue/AssetsTab | `src/modules/catalogue/ui/assets-tab.stories.tsx` | approved |

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

## People

| Story | Path | Status |
|---|---|---|
| Modules/People/StaffDestination | `src/modules/people/ui/staff-destination.stories.tsx` | approved |
| Modules/People/DaysWorkedTab | `src/modules/people/ui/days-worked-tab.stories.tsx` | approved |
| Modules/People/CustomersTab | `src/modules/people/ui/customers-tab.stories.tsx` | approved |
| Modules/People/CustomerDetail | `src/modules/people/ui/customer-detail.stories.tsx` | approved |

## Not yet built

Per `docs/roadmap.md`'s stage order — canteen operations (stage 4),
handover/close-of-day beyond restaurant (stage 5 remainder) have no
screens yet. Days worked and the pay figure (stage 7) landed via ticket
35; pay disbursement tracking ("mark as paid") landed as part of the same
ticket rather than deferred, since a pay figure with no record of what
was already paid wasn't useful on its own — see ticket 35's notes.
Reporting (stage 8) has its Profit panel (ticket 25); amounts owed
landed via ticket 36 (Customers tab); product stock valuation landed via
ticket 37 (AdminStockTable's value column). Profit-by-arbitrary-period
remains unbuilt. Added to this file as their tickets land, not
speculatively ahead of them.

## Note on naming

Story titles aren't fully consistent (`Modules/Cash/...` vs.
`Cash/MoneyOutDestination` for money-out) — flagged here per `/adopt`'s
"inconsistency is a decision point" principle rather than silently
averaged away. Not worth a ticket on its own; worth fixing the next time
that file is touched for an unrelated reason.
