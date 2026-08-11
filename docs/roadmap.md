# Roadmap

The module-by-module build order, decided once so `/tickets` cuts each
tranche against a fixed sequence rather than re-deriving "what's next"
from `docs/proposal.md` on every run.

**What this is not.** Not a ticket list — tickets are cut per stage, by
`/tickets`, when that stage's turn comes. Not a schedule — no dates, no
estimates beyond the rough tranche-count sanity check at the bottom. Not
fixed forever — if building a stage teaches us the sequence was wrong,
this file is corrected, not silently overridden.

**Source of truth for *what* each stage delivers:** `docs/proposal.md`,
section by section. This file only decides *order* and *why that order*.
**Source of truth for what's in/out of v1 at all:** `docs/scope.md` —
this roadmap only sequences what's already in scope.

---

## Already built (Foundation + tracer slice)

- `people` — auth (phone + PIN), sessions, `canAccessLocation()`
- `catalogue` — minimal `Product` (id, name, kind), enough for `stock` to
  reference
- `stock` — `StockMovement`, current-stock-at-location computed from the
  sum of movements, staff-shell read-only view

This is the foundation every stage below builds on. Nothing here is
redone; each stage extends it.

---

## Stage order and why

**Status: Stages 1–3 done. Stage 4 (canteen operations) is current.**
Tickets 01–20 in `.work/` cover Stages 1–3 in full, all merged to `main`.
See each stage below for what specifically landed.

### Stage 1 — Catalogue made real: prices, ingredients, recipes

**Done** — tickets 01 (catalogue reference data: ingredients, product
CRUD, pricing), 02 (recipes: ingredients to product, effective-dated
versions, expected yield), 03 (the tabbed Catalogue destination).

**Delivers:** proposal.md §3 ("price paid on that occasion"), §11's
implicit dependency (pay needs staff, but pricing needs catalogue first),
and the recipe/yield mechanism from §10.7.

**Why first.** Nothing sells without a price. `sales` (stage 2) needs
priced products to exist; `stock` receiving (stage 3) needs ingredients
to exist as a distinct concept from products (CONTEXT.md: ingredient vs.
product is a real, load-bearing split). Recipes feed cost-of-goods-sold
(stage 6), but recipes without prices are meaningless, so this stage
does both together rather than splitting them.

**Depends on:** nothing beyond the tracer slice.

---

### Stage 2 — Restaurant sales: the till

**Done** — tickets 06 (customer record), 07 (counter sale, cash/M-Pesa
split payment lines), 08 (credit sale, inline customer create), 09
(Today's sales), 10 (same-day void), 11 (delivery fulfilment).

**Delivers:** proposal.md §3 "Sales" and "Credit" — cashiers recording
counter/delivery sales, split cash/M-Pesa/credit payment lines, named
customers for credit.

**Why here, not later.** This is the client's central daily verb — the
first genuinely demoable "the system does what the spreadsheet did."
Everything downstream (handover, cash position, profit) is checking or
summarizing what sales produced, so sales has to exist before any of
those stages can be real rather than stubbed.

**Depends on:** Stage 1 (priced products to sell). Decrementing stock on
sale depends on `stock`'s movement ledger, already built.

**Deliberately excluded from this stage:** wastage/internal
consumption/complimentary recording (proposal.md §3) — related but not
blocking, folds into stage 3 alongside the rest of stock's operational
recording.

**Discovered split (tickets 06–10).** `/tickets` cut this stage's first
tranche narrower than one pass: Customer record → counter sale
(cash/M-Pesa, split payment lines) → credit sale (adds credit + inline
customer create) → Today's sales (a new staff-nav list of a day's own
sales) → same-day void, wired into that list rather than a one-shot
confirmation-view action. **Delivery fulfilment was pushed out of this
tranche too** — it needs a named customer (same as credit), so it slots
in cleanly as the next tranche's opening ticket rather than being forced
into the first pass. Per this file's own revision rule, discovered
granularity wins over the one-line stage description above.

---

### Stage 3 — Restaurant stock operations: receiving, issuing, production, transfers, wastage

**Done** — tickets 12 (receiving), 13 (restaurant handover), 14
(dashboard: today's handovers), 15 (wastage/consumption/complimentary),
16 (money out, four categories), 17 (staff CRUD), 18 (issuing to the
kitchen), 19 (production), 20 (stock count, expected vs. counted,
owner-corrected). Transfers to canteen were not cut as their own
ticket in this stage — canteen (Stage 4) has no receiving side to send
to yet, so the transfer mechanic's first ticket slots in as Stage 4's
opening ticket instead, per this stage's original dependency note below.

**Delivers:** proposal.md §3's remaining operational verbs — receiving
deliveries (store manager), issuing to kitchen, production output,
transfers to canteen, wastage/consumption/complimentary recording.

**Why after sales, not before.** Sales is what makes the tracer slice's
stock-viewing screen meaningful (stock actually moving, not just static
counts). Transfers specifically need both locations to exist as active
participants — canteen (stage 4) receives what this stage sends, so the
transfer's "in" half is written here but only becomes end-to-end
demoable once stage 4 exists.

**Depends on:** Stage 1 (ingredients to receive/issue), Stage 2 (proves
the sales-decrements-stock path this stage's production/issuing pattern
will mirror).

---

### Stage 4 — Canteen operations: takings, count-derived sales

**Current stage.** Its opening ticket should also cover the transfer-out
mechanic Stage 3 deferred (see Stage 3's note above) — canteen receiving
is what makes a transfer demoable end-to-end.

**Delivers:** proposal.md §4 in full — the canteen's structurally
different recording (daily takings instead of per-sale, weekly
count-derived item detail), receiving both transferred and
directly-delivered stock, credit sales recorded individually.

**Why its own stage, not folded into stage 2/3.** proposal.md is explicit
that the canteen "trades differently" — this isn't a smaller version of
restaurant sales, it's a different recording mechanism (takings +
derived-at-count vs. per-sale). Building it as its own stage keeps that
distinction honest rather than forcing a shared UI that fits neither
location well, per docs/architecture.md's warning against that.

**Depends on:** Stage 1 (priced canteen goods), Stage 3 (transfers must
exist for the canteen to receive them, and for the restaurant side of a
transfer to already be real).

---

### Stage 5 — Daily close, counts, and the handover check

**Delivers:** proposal.md §3 "Close of day," §5 in full (the blind
handover check, cash and M-Pesa separately, restaurant vs. canteen
expected-amount sources — tickets 26–27), and §8's easier half — same-day
void/edit (any role, before that person's day closes) and the "closed"
state itself (tickets 28, 30).

**Revised split for §8's harder half (discovered while cutting tickets
28–30).** "Amending a closed day" is owner-only and effective-dated, but
its natural UI home is the Ledger destination ("where every figure comes
from," `admin-nav.ts`) — a screen this stage has no reason to build
early, since Ledger's whole point is showing figures across every module,
which is Stage 8's job by the same reasoning that keeps `reporting` last.
Building a correction form now means attaching it to a screen that
doesn't exist yet, then rebuilding it once Ledger lands. **Moved to Stage
8**, alongside Ledger itself, where the correction mechanism and the
activity/history view it feeds naturally belong together. This stage
still builds the *state* the correction mechanism will depend on (ticket
28's "closed" flag, set when a handover is recorded) — Stage 8 only adds
the owner-facing means to act on it.

**Why the rest is here.** The handover check's expected amount is
*assembled from sales/takings already recorded* (§5) — it cannot be
built, let alone tested, before stages 2–4 produce real sales/takings to
check against. The same-day-void half of §8 was already proven
conceptually in Foundation's data-lifecycle notes, but gets its first
full real exercise against actual sales here, and "closed" (ticket 28)
needs those same real handovers to have a trigger to attach to.

**Depends on:** Stages 2, 3, 4 (something to check a handover against at
both locations).

---

### Stage 6 — Cash: money paid out, running balance, drawings

**Delivers:** proposal.md §6 in full — the four expense categories
(stock, running costs, equipment, drawings), the running cash balance,
drawings as a debt.

**Why after handover, not before.** §6's running balance is built from
handovers received (money in) and payments made (money out). Money in
requires stage 5's handover to be real; building cash first would mean
stubbing the "money in" half.

**Depends on:** Stage 5 (handovers as the "money in" side of the
balance).

---

### Stage 7 — People: full staff management, days worked, pay

**Delivers:** proposal.md §11 — staff CRUD (add/deactivate, daily rate),
days-worked recording, pay calculation.

**Why this late.** Nothing else structurally depends on this being built
early — auth and `canAccessLocation()` (the load-bearing parts of
`people`) already shipped in Foundation. Staff management is
operationally important but not a blocker for any other stage, so it
sits wherever there's a natural gap rather than forcing an early slot it
doesn't need. Placed after cash because pay is, in effect, a
recurring expense the owner will want to reason about alongside the
rest of §6, without making stage 6 wait on it.

**Depends on:** nothing beyond Foundation. Could move earlier without
breaking any other stage's dependencies, if it becomes more urgent than
this ordering assumes.

---

### Stage 8 — Reporting: profit, stock valuation, amounts owed, activity record

**Delivers:** proposal.md §7 and §9 in full, and the calculations in
§10 — profitability (daily/weekly/monthly, per-location and combined),
handover reporting, cash position, amounts owed, stock value, low stock,
staff/pay reporting, the activity/audit-trail record.

**Why last.** docs/architecture.md is explicit: `reporting` "reads from
everything and stores nothing... it reads through other modules'
interfaces, never their internals." It cannot be real until the modules
it reads from (sales, stock, cash, people) are. Building it earlier
means building it against stubs and rebuilding it later — the exact
horizontal-slice mistake `/tickets` is designed to prevent, just at
roadmap scale instead of ticket scale.

**Depends on:** every prior stage. This is the module that proves
everything before it was built correctly — the provisional-vs-final
distinction (§10.4), the never-double-count rule (§10.5), the expected
cash calculation (§10.6) all read real data from stages 1–6.

---

## Rough sizing

Each stage above is not one tranche — most will need 2 tranches
(5–8 tickets each) to land fully, going by how the tracer slice's single
demoable feature already touched schema, module, UI, auth, and both test
kinds. Treat this as an order-of-magnitude check, not a plan:

| Stage | Rough tranches |
|---|---|
| 1 — Catalogue | 1–2 |
| 2 — Restaurant sales | 2 |
| 3 — Restaurant stock ops | 2 |
| 4 — Canteen operations | 2 |
| 5 — Close, counts, handover | 1–2 |
| 6 — Cash | 1–2 |
| 7 — People | 1 |
| 8 — Reporting | 2–3 |

**Total: roughly 12–16 tranches, 60–100 tickets.** Wider than the
napkin estimate given earlier in this project's history — this roadmap
is more granular because it forces every proposal.md section to land
somewhere, rather than compressing "the rest of stock" into one line.

---

## When to revise this file

- A stage turns out to need splitting once `/tickets` actually cuts it
  (discovered granularity, not predicted granularity, wins)
- A dependency assumed here turns out to be wrong once the code exists
- The client's priorities shift and a later stage becomes urgent before
  its turn — reorder deliberately here, don't let `/tickets` improvise
  around the roadmap

This file is corrected in place. Don't leave the old order commented out
underneath — git history is the record of what changed and why.
