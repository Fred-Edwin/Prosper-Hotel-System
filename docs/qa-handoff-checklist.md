# Full-day manual walkthrough

A chronological simulation of one trading day, end to end, rather than a
role-by-role checklist — the goal is to catch handoff bugs a per-role pass
can't see (e.g. a canteen sale recorded at 9am not showing up on the
owner's dashboard by close). Run against `pnpm dev` + fresh `pnpm seed`
data, on localhost.

**Reflects the 2026-08-13 canteen redesign** (`docs/proposal.md` §4): the
canteen now records each sale individually — same motion as a restaurant
cashier, no payment method per line, one stock ledger for both her own
goods and food transferred in from the restaurant. Takings-as-the-only-
record is retired. If you're comparing against an older version of this
checklist, that version is stale.

Check items off as you go (`[x]`). Where something's broken, don't fix it
here — log it in `docs/bugs.md` per its format and keep testing.

## Setup

- [ ] `pnpm seed` run against local DB — 8 staff members (PIN `1234` for
      all), 2 locations, sales/movements/handovers/expenses/counts
      already in place.
- [ ] `pnpm dev` running, app reachable at localhost.
- [ ] Keep a second browser profile or incognito window handy — the
      script requires logging out and back in as different people
      repeatedly; session cookies mean one tab can't hold two identities
      at once.

Seed identities (name / PIN `1234`):

| Name | Role | Location |
|---|---|---|
| Admin Owner | owner | restaurant (but sees both) |
| Store Manager | store_manager | restaurant |
| Restaurant Cashier | cashier | restaurant |
| Brian Otieno | cashier | restaurant |
| Canteen Attendant | attendant | canteen |
| Peter Kiptoo | attendant | canteen |
| Faith Mumbi | cashier | restaurant, **inactive** — must be refused login |

---

## 1. Morning — restaurant receives and produces

Log in as **Store Manager**.

- [ ] Receive a delivery (e.g. potatoes or cooking oil) — enter quantity
      and the price paid on this occasion. Confirm stock increases and
      weighted-average cost updates.
- [ ] Issue ingredients to the kitchen (e.g. potatoes, for chips).
      Confirm ingredient stock decreases.
- [ ] Record production output (e.g. Chips, a number of plates). Confirm
      it's recorded — check where production surfaces (dashboard/store
      movements) since there's no dedicated "production" nav item.
- [ ] Confirm Store Manager cannot reach New Sale (no nav entry, and if
      you find the route, hitting it directly should refuse rather than
      silently succeed).

## 2. Morning — canteen opens, no transfer yet

Log in as **Canteen Attendant**.

- [ ] Confirm there is **no** unconfirmed-transfer banner yet (nothing
      sent from the restaurant this session) — she reaches her ordinary
      screens normally.
- [ ] Record a walk-in sale of one of the canteen's own goods (e.g.
      Sodas or Crisps) — confirm the flow takes product + quantity only,
      **no payment method field**. This is the core change: verify it
      genuinely isn't there, not just optional.
- [ ] Record a second sale, quantity > 1, different product.
- [ ] Record a credit sale — same entry flow, with a customer named
      inline (e.g. Jane Wanjiru). Confirm it's one flow, not a separate
      screen.
- [ ] Open her stock screen — confirm "My stock" vs "From restaurant"
      distinction exists for her own reference, and that it's read-only
      classification, not a separate recording mechanism.

## 3. Midday — restaurant sends stock to canteen

Log in as **Store Manager**.

- [ ] Transfer cooked food (e.g. Chips or Mukimo) to the canteen. Confirm
      it's recorded once and appears as in-transit, not yet counted as
      canteen stock.

Log in as **Canteen Attendant**.

- [ ] Confirm the unconfirmed transfer is now surfaced **immediately and
      prominently** — she cannot reach her ordinary screens without
      seeing it (per proposal.md §4). This is a specific UI claim — check
      it isn't just a dismissible toast.
- [ ] Confirm the transferred stock, at what she actually received (test
      a short-received discrepancy: confirm a quantity less than what
      was sent). Confirm the gap is recorded as its own discrepancy, not
      folded into wastage.
- [ ] Confirm the confirmed portion now counts as canteen stock and is
      sellable, appearing under "From restaurant" in her stock view.

## 4. Afternoon — restaurant till

Log in as **Restaurant Cashier**.

- [ ] Record a counter sale (cash only).
- [ ] Record a delivery/takeaway sale.
- [ ] Record a split cash/M-Pesa sale — confirm both amounts are
      recorded against the one sale.
- [ ] Record a credit sale against an existing customer.
- [ ] Void one of today's own sales, same-day. Confirm stock/cash reverse
      and the row stays visible, marked void (not hidden).

Log in as **Brian Otieno**.

- [ ] Record one sale. Confirm Today's Sales is scoped correctly (own
      sales — or whatever scope `docs/architecture.md` actually
      specifies; don't assume own-only without checking).
- [ ] Attempt to void one of Restaurant Cashier's sales — should be
      refused (same-day-own-entry-only), unless architecture.md says
      otherwise.

## 5. Afternoon — canteen sells the transferred food

Log in as **Canteen Attendant**.

- [ ] Sell the food received from the restaurant in step 3 — same sale
      entry flow as her own goods, confirming one recording action
      regardless of stock origin.
- [ ] Record wastage of a canteen item (proposal.md §4 doesn't exclude
      the canteen from wastage recording — confirm it's reachable here).

Log in as **Store Manager**.

- [ ] Record wastage of a restaurant item.

## 6. Close of day — restaurant

Log in as **Store Manager** (or **Admin Owner** — count is owner/store
manager per §3).

- [ ] Run a stock count with a deliberate discrepancy on at least one
      item. Confirm the system shows expected vs counted vs difference,
      and that it lands as **open**, not silently auto-corrected.

Log in as **Restaurant Cashier**, then **Brian Otieno**.

- [ ] Each hands over: enter cash total and M-Pesa total separately.
      Confirm the check compares cash-to-cash and M-Pesa-to-M-Pesa
      independently (per proposal.md §5 — restaurant is the two-currency
      check, distinct from the canteen's combined one below). Make one
      handover agree and one show a shortfall.

## 7. Close of day — canteen

Log in as **Canteen Attendant**.

- [ ] Hand over: enter cash total and M-Pesa total, but confirm the
      **check itself is a single combined figure** (cash+M-Pesa summed,
      not compared separately) — this is a deliberate narrowing per
      proposal.md §5, distinct from the restaurant. Verify the UI
      actually implements the combined comparison, not two separate
      ones dressed up together.
- [ ] Confirm the credit sale from step 2 is **excluded** from the
      handover's expected total (no money changed hands) and instead
      appears under amounts owed.

## 8. Owner — money out

Log in as **Admin Owner**.

- [ ] Record one payment in each of the 4 categories: stock, running
      costs, equipment/furniture, owner's drawings.
- [ ] Confirm equipment and drawings do **not** reduce reported profit
      but do reduce expected cash.
- [ ] Confirm the drawings entry creates/updates an amount-owed-back
      balance.
- [ ] Reverse one expense — confirm it's excluded from totals but stays
      visible, marked reversed.

## 9. Owner — end-of-day reporting pass

Still logged in as **Admin Owner**.

- [ ] Dashboard: Profit panel shows figures for restaurant, canteen, and
      combined — **all final, not provisional** (this is the headline
      change from the last two commits — no "estimated" or "provisional"
      badge on canteen profit/COGS anymore, since canteen sales are now
      recorded directly rather than count-derived). Confirm this
      explicitly.
- [ ] Dashboard Handovers: today's restaurant handovers (agreed +
      shortfall) and the canteen's combined-figure handover from step 7
      all show, correctly distinguished.
- [ ] Ledger shell: Product, Cash, Store, Non-sales tabs each render with
      today's new entries (the sales/transfers/wastage/expenses just
      recorded), not just seeded historical data.
- [ ] Store ledger / cost-of-goods-sold: confirm the canteen's COGS is
      now calculated the same way as the restaurant's — `opening + in −
      closing` — for both the transferred food (recipe cost or 60%
      estimate if no recipe) and her own goods (purchase cost). Cross-
      check against proposal.md §10.2's worked example shape.
- [ ] Activity trail: today's actions from every role appear, filterable
      by person and date, including the stock-count discrepancy and the
      voided sale.
- [ ] Amounts owed: the credit sales recorded in steps 2 and 4 both
      appear under the correct customer, across both locations.

## 10. Permission & lifecycle edge checks

- [ ] Attempt login as **Faith Mumbi** (inactive) — must be refused.
- [ ] Location isolation: while logged in as a canteen-scoped role,
      confirm restaurant stock/sales/cash is unreachable — refused if
      navigated to directly, not a silent empty list. Repeat the reverse
      (restaurant-scoped role against canteen data).
- [ ] As owner, deactivate a staff member with sales recorded today.
      Confirm they can no longer log in but their sales stay attributed
      and visible in Today's Sales/ledgers/Activity. Reactivate them.

## 11. Known gaps — verify still true, don't re-log as new

- [ ] **BUG-01** (`docs/bugs.md`): edit a staff member's or customer's
      name/phone as owner, check Activity — confirm previous value is
      still silently lost, or note if fixed.
- [ ] **Owner nav stopgap**: confirm owner's staff-shell nav still shows
      the store-manager variant. Flagged design question, not a bug —
      note whether acceptable to ship as-is.

---

## Wrap-up

- [ ] Any new issue found above → log in `docs/bugs.md` in its standard
      format, don't fix inline during this pass.
- [ ] Summarize for the client: what was tested, pass/fail per step, and
      the disposition of each known gap (fixed, deferred, accepted).
