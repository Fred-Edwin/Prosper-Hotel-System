# Scope — Prosper Hotel

## The v1 destination

Prosper Hotel's two locations run their daily trade in one system: stock received, issued to
the kitchen, transferred between locations, counted and sold; sales taken in cash, M-Pesa and
credit; each day closed and handed over with discrepancies visible per person; and the owner
able to see profit, cash position, debtors and stock value across both locations — with every
entry attributable to the person who made it, and the full history of any item on any day
readable exactly as it happened.

The bar it must clear: **anything the Excel sheets do today, it does at least as well.**

---

## Out of scope for v1

This list is worth more than the one above. It is what stops creep.

**AI query layer.** An assistant the owner could ask "am I making money?" in plain language,
reading the historical data directly. A genuinely good fit for this client — she is absent
during trading hours, non-technical, and already phrases every need as a question rather than
a report. Deferred because it is a layer *on top of* the data and has nothing to read until
stock, sales and cash are real; and because an assistant answering questions about money from
a half-built schema is worse than no assistant. **Nothing in v1 needs to change to allow it**
— the full attributed movement history it would depend on is already the design. When built,
it must read through the module interfaces rather than querying the database directly, so
that location scoping applies to it automatically.

**Offline sales.** Rejected on evidence: connectivity at both locations is reliable in
practice. Sales are append-only and therefore the safe first candidate if that changes.

**Asset depreciation.** Assets are recorded and kept out of profit, but their cost is not
spread over their useful life. Real accounting, and an addition rather than a rework if the
owner later wants it.

**Supplier accounts.** Suppliers are paid on delivery. No supplier credit, no payables, no
supplier statements.

**Automatic M-Pesa reconciliation.** No paybill integration. M-Pesa is recorded by hand as a
payment line.

**Payroll beyond days worked.** Pay is days worked multiplied by a daily rate. No tax, no
NSSF, no NHIF, no advances or deductions.

**Anything customer-facing.** No online ordering, no customer portal, no notifications to
customers. Delivery orders are recorded by staff, as they are today.

**A third location.** The design is location-scoped throughout and would accommodate one, but
nothing is built or tested for it.

---

## Added post-v1

### 2026-08-12 — In-app contextual help panel

A "?" trigger on every screen's page header (top-right, both shells)
opens a help panel with static, pre-written text explaining that
screen's purpose and its actions. One new `components/patterns/` entry,
rendered in two presentations from one component: a slide-over above
the mobile breakpoint, a bottom sheet below it — switching by screen
width, not by role, so the owner sees whichever matches the device
she's actually using. Content is a central map keyed by nav destination
(sectioned by tab where that destination has tabs — Catalogue, Ledger,
People — so the panel opens once per page and covers every tab in one
scroll), populated from copy already drafted and approved by the client:
`docs/help-copy-owner-draft.md`, `docs/help-copy-cashier-draft.md`,
`docs/help-copy-attendant-storemanager-draft.md`. No new data, no new
permissions, no new module — presentation-layer only, req'd by REQ-01
in `docs/feature-requests.md`.

**Definition of done:** every nav destination in both shells has a
working "?" trigger; the panel renders the approved copy for that
destination (all tabs in one scroll, where applicable); presentation
switches correctly at the mobile breakpoint regardless of role; a
Storybook story exists per state (open/closed, both presentations); the
pattern is documented in `docs/conventions.md`'s UI section alongside
the other `components/patterns/` entries.

---

## Still to establish

Carried forward from discovery. None blocks v1, but each will need an answer before the part
of the system it touches is built.

- How the daily quantity sent to the canteen is decided.
- Which products have a known, reliable yield, and what those yields are.
- Whether selling prices change as often as purchase costs do.
- Whether cashiers hold a float overnight, or hand over everything.
- How printing is priced — per page, per job, or per document type.
- How far back the audit trail needs to be readable.

---

## Added post-v1

### 2026-08-13 — Canteen: real sales, two-sided transfers, retiring count-derived sales

*Supersedes the original canteen design in `docs/proposal.md` §4/§5/§10 and
`docs/architecture.md`'s canteen comparison table — a rework, not an addition. See those
documents' inline revision notes for what changed and why (BUG-10 was the trigger: the
attendant could already record a real sale, which the original design did not anticipate,
causing the same shrinkage to be counted once as a real sale and once as an inferred one).*

**What changes:**

- The canteen attendant records real per-sale rows — product and quantity, the same motion a
  restaurant cashier uses — for both the canteen's own stock and food transferred in from the
  restaurant. No payment method per line; too slow for rush trade with students.
- Credit sales fold into the same entry flow, with a customer named, matching the restaurant's
  till.
- She still declares cash and M-Pesa totals at close for handover, now checked against the
  day's recorded sales as a whole rather than being the sales record itself.
- Stock transfers become two-sided in both directions (restaurant↔canteen): the sender records
  quantity sent, the receiver separately confirms quantity received. An unconfirmed transfer
  triggers an unmissable notification on the receiving side. A confirmed-short quantity is
  recorded as its own discrepancy movement, distinct from wastage. This is REQ-02 Part A,
  generalised — not canteen-special-cased.
- The canteen stock page shows canteen-owned and restaurant-supplied stock as separate,
  filterable views, updating live as sales and confirmed receipts are recorded. The store
  manager's restaurant-side stock page gains the mirror: on-hand versus sent-to-canteen, and
  whether the canteen's receipt confirmation matched with no discrepancy.
- The periodic canteen stock count (and the restaurant's existing daily count) becomes a pure
  shrinkage/theft check: counted quantity against what the movements say should be there. It no
  longer infers sales, sets a cost rate, or makes any profit figure provisional.
- "Today's sales" is renamed "Today's summary" with per-role content (REQ-02 Part B), and
  `transfer-history.tsx` (already built, currently unreachable from any nav) gets a real entry
  point.

**What this retires:** `recordCountDerivedSales` (`stock/logic.ts`), the `sold_derived`
movement reason and its handling in `foldReasonLines` (`reporting/logic.ts`), and the
provisional/estimated canteen profit model in `docs/formulas.md` §6-§7.

**Definition of done:** canteen attendant can record a sale (with or without a named customer
for credit) in the same number of taps as a restaurant cashier's counter sale, minus the
payment-method step; a restaurant→canteen transfer is not reflected in the receiver's stock
until confirmed, and an unconfirmed transfer is visible on the attendant's home screen without
her navigating to find it; a confirmed-short receipt produces its own discrepancy movement;
canteen daily profit and cost of goods sold report as final, not provisional, in the Profit
panel and the ledger; the canteen stock page filters between canteen-owned and
restaurant-supplied stock; the store manager sees on-hand versus sent-to-canteen and a
receipt-confirmation status; a periodic canteen count still runs and reports a variance, but no
report describes it as correcting an earlier estimate; `docs/proposal.md`,
`docs/architecture.md`, `docs/formulas.md` and `CONTEXT.md` read consistently with the new
design (done as part of this scoping pass, ahead of tickets).

### 2026-08-13 — Product home location, and an overselling guard

*Closes BUG-14 and BUG-15 in `docs/bugs.md`. See `docs/architecture.md`'s "Product home
location" note (Data lifecycle section) for the full reasoning and how this relates to the
existing "a stock level is the sum of the movements" rule — this is a deliberate, scoped
exception to that rule, not an extension of it.*

**What changes:**

- `Product` gains a required home `Location` (restaurant or canteen), set by the owner in the
  catalogue create/edit form, editable afterward the same as price or category.
- New Sale, Production, and the stock-correction dialog, at each location, offer only: that
  location's own products, plus products currently held there via a confirmed transfer in.
  Transferred-in items are visually distinguished from the location's own products via a
  "My stock" / "From restaurant" tab pair (2026-08-13: switched from a stacked grouped-section
  layout to match the canteen Stock page's tab pattern exactly, including labels), each tab
  showing that source's product grid; a "Transferred in" badge still marks transferred tiles.
- **Production is hard-gated to home location** — a location can only produce a product whose
  home location it is (the canteen can never "produce" a restaurant-owned cooked-food item).
- **A real overselling guard, in two parts, both required:**
  - Soft: New Sale shows on-hand quantity per product tile, reusing the existing low-stock
    visual pattern (`admin-stock-table.tsx`'s `isLow`/`TriangleAlert`).
  - Hard: the sale-recording path rejects a line exceeding on-hand stock before writing
    anything, mirroring `recordTransfer`'s existing `insufficient_stock` pattern
    (`db.$transaction`, sum first, write only if sufficient). Surfaced to the cashier/attendant
    as an inline error naming the item and quantity available, not a generic failure message.
- Seed data's 13 products are assigned a home location matching their existing seeded stock
  movements.

**What this does not change:** the transfer mechanism itself (already two-sided, already
correct); how current stock is computed (still purely the movement ledger); permissions
(`canAccessLocation()` is unchanged and ungated by this — the new home-location filter is a
business rule about *what's offered*, not a permission check about *who may act*, and is
enforced separately in each module's `logic.ts`).

**Definition of done:** every product has a home location, set at creation and editable after;
New Sale/Production/Correction at each location show only in-scope products, with
transferred-in items visually distinguished; production is rejected with a clear reason when
attempted against a product whose home location doesn't match; a sale exceeding on-hand stock
is rejected server-side with an inline, item-specific error, and cannot succeed via direct API
call either; New Sale shows on-hand quantity per product; seed data reflects real home
locations; BUG-14 and BUG-15 are marked fixed in `docs/bugs.md`, referencing the tickets that
closed them.
