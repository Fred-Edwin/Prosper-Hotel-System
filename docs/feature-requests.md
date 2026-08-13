# Feature requests — Prosper Hotel

Intake log for `/add`. Log a request here as soon as it's raised — what
was asked, by whom, when — before `/add` scopes it against
`docs/architecture.md`/`docs/scope.md`. Convert relative dates ("next
week") to absolute dates when logging.

Format, one entry per request:

```markdown
## REQ-<NN>: <short title>
**Requested by:** <who — client, staff, owner>
**Date:** <YYYY-MM-DD>
**Status:** new | scoped | built

### Description
What was asked for, in their words where possible.

### Initial notes
Anything said in passing worth keeping — constraints, urgency, why now.
```

## REQ-01: In-app contextual help panel
**Requested by:** Edwinfred (client-facing need: staff/owner confusion
during pre-handoff walkthrough)
**Date:** 2026-08-12
**Status:** scoped — see `docs/scope.md`'s "Added post-v1" section,
2026-08-12 entry

### Description
A "?" trigger on every screen opens a help panel explaining that
screen's purpose and its actions — so the client (owner and her staff)
can understand each screen without a training session or standing
support. Two presentations of one component: a slide-over on the
admin/desktop shell (Owner), a bottom sheet on the staff/mobile shell
(Cashier, Attendant, Store manager). Content is one write-up per nav
destination, sectioned by tab where that destination has tabs
(Catalogue, Ledger, People) — so the panel opens once per page and
covers all its tabs in one scroll, not per-tab.

### Initial notes
Surfaced during a pre-handoff manual QA pass — the owner and staff
would otherwise need direct explanation of what each screen does.
Copy has already been drafted and approved by the client, role by role,
across three docs: `docs/help-copy-owner-draft.md`,
`docs/help-copy-cashier-draft.md`,
`docs/help-copy-attendant-storemanager-draft.md`. Shared staff screens
(New sale, Today's sales, Wastage, Stock, Handover) have one canonical
copy block reused across the roles that see them — written once under
Cashier, referenced (not duplicated) elsewhere. Use this approved copy
verbatim as content; do not redraft it.

## REQ-04: Product location scoping — fixing BUG-14/BUG-15
**Requested by:** Edwinfred (owner-facing realization, prompted by the full-day
walkthrough that logged BUG-14/BUG-15)
**Date:** 2026-08-13
**Status:** scoped — see `docs/scope.md`'s "Added post-v1" section, 2026-08-13
"Product home location, and an overselling guard" entry

### Description
Products need to be scoped to a home location (restaurant or canteen), set by the
owner at catalogue creation/edit time. Each location's New Sale, Production, and
Correction screens should offer only products that genuinely belong there: the
location's own products, plus anything currently sitting in that location's stock
because it was transferred in and received. This directly resolves the open
architectural fork BUG-14 already identified ("stock-aware New Sale" vs. "explicit
location assignment") in favour of the latter, and gives BUG-15's overselling guard
something concrete to check quantity against.

### Initial notes
Surfaced from the same full-day walkthrough that logged BUG-13/14/15 — investigating
BUG-14 found that `Product` has no location concept at all today (unlike `Asset`,
which already does), so New Sale shows the entire global catalogue to every location
regardless of actual stock. Decided with Edwinfred, 2026-08-13: `Product.locationId`
is required (every product has exactly one home location, no shared/global option);
sellability at a location is the home-location match *or* positive transferred-in
stock, combined; production is hard-gated to a product's home location; the
correction dialog uses the same combined scoping as sales. See `docs/bugs.md`
BUG-14 and BUG-15 for the original findings this closes.

## REQ-03: Canteen redesign — real sales instead of count-derived sales
**Requested by:** Edwinfred (owner-facing realization, prompted by BUG-10)
**Date:** 2026-08-13
**Status:** scoped — see `docs/scope.md`'s "Added post-v1" section, 2026-08-13 entry

### Description
The canteen should record real sales the same way the restaurant does — product
and quantity per sale, no payment method per line since trade is too fast — rather
than declaring daily totals and having item-level sales inferred from a weekly
stock count. Applies to both the canteen's own stock and food transferred in from
the restaurant. Folds in REQ-02 in full (confirm-receipt on transfers becomes a
prerequisite; the per-role summary screen rides along) and adds a store-manager-side
mirror: a receive-confirmation notification and stock visibility into what's been
sent to the canteen and whether it was confirmed without discrepancy.

### Initial notes
Surfaced directly from BUG-10 (canteen derived-sales double-count): investigating
the bug found the attendant could already record a real cash sale, which the
original design's core assumption ("individual sales aren't recorded at the
canteen") didn't anticipate. Edwinfred concluded the inference-from-count design
itself was the wrong call, not just the formula computing it — see
`docs/proposal.md` §4 and `docs/architecture.md`'s canteen comparison table for the
full reasoning and the retained record of the original design. The BUG-10
reproduction task in flight at the time (`docs/handover-phase3b-bug10-reproduction.md`)
was stopped as superseded rather than continued.

## REQ-02: Confirm-receipt on stock transfers, and a per-role "Today's summary" screen
**Requested by:** Edwinfred
**Date:** 2026-08-13
**Status:** scoped — folded into the 2026-08-13 canteen redesign in `docs/scope.md`'s
"Added post-v1" section (both parts: A is now a hard prerequisite of real canteen
sales, not a parallel nice-to-have; B rides along once transfers are two-sided)

### Description
Two related gaps surfaced while discussing BUG-10 (the canteen
double-counted-sales bug) and what the canteen attendant can actually
see day to day. Both concern the same underlying question: right now a
stock transfer is push-only (the sender completes it and it lands as
the receiver's stock immediately, no acknowledgment step), and there is
no single screen showing a location's staff member what happened that
day in one place.

**Part A — confirm-receipt on transfers.** Today, `recordTransfers`
(`src/modules/stock/logic.ts:391-503`) writes both the outgoing and
incoming stock movements atomically, in one call, made entirely by the
sending side. The receiving location has no action to take and no
record that anything arrived beyond reading the transfer history log
(itself currently unreachable from the nav — see Part B) — any
in-transit loss or miscount is invisible until it shows up as a
shortfall at the next physical stock count, by which point it's
indistinguishable from ordinary shrinkage.

Agreed shape, discussed 2026-08-13:
- A transfer becomes two-sided: the sender records a quantity sent: the
  receiver, at their own location, separately confirms a quantity
  received (which may differ from what was sent).
- Applies in **both directions** — restaurant→canteen and
  canteen→restaurant — one consistent mechanic, not special-cased to
  the canteen.
- While a transfer is sent but not yet confirmed, it is **in transit**:
  the sender's on-hand decreases the moment they send, the receiver's
  on-hand only increases on confirm. Neither location's stock count
  includes it while in transit.
- If the confirmed quantity is less than what was sent, the gap is
  **auto-recorded as its own discrepancy movement** — distinct from
  wastage, from a stock-count correction, and from ordinary
  shrinkage — clearly attributable to the transfer itself (e.g. "lost
  in transit"), not folded into an existing reason code.

This is a real data-model change, not a UI-only addition: it changes
what a transfer *is* (a single atomic movement today, a two-step
sent/received pair going forward), adds a new "in transit" stock state
that today's `sumMovementsByProductAtLocation`-style queries don't
know about, and needs a new reason/movement type for the auto-recorded
shortfall. Needs full scoping against `docs/architecture.md`'s stock
module before ticketing — flagging here, not scoping it myself.

**Part B — "Today's summary" screen, per role.** Rename the existing
"Today's sales" nav destination (`src/modules/sales/ui/todays-sales.tsx`,
`all.sales` in `src/components/layout/staff-nav.ts`) to "Today's
summary" and expand its content per role rather than adding a separate
screen:
- Cashier / store-manager: unchanged — the sales they personally rang
  up today (this is already what the screen shows).
- Attendant: takings recorded, transfers received today (once Part A
  exists — confirmed-received quantities, not just sent), count-derived
  sold quantity from the most recent count, and current closing stock.

Separately noticed while checking this: `transfer-history.tsx`
(`src/modules/stock/ui/transfer-history.tsx`) already exists, is fully
built, and is wired to a real route
(`active === "transfer-history"` in `staff-page-client.tsx:92`) — but
no nav link or in-screen button anywhere reaches it. It's dead code
from every role's perspective today. Whether this becomes its own nav
entry or gets folded into Today's summary is part of what needs
scoping — flagging its existence now so it isn't rebuilt from scratch.

### Initial notes
Surfaced from a question during the Phase 2 financial review
(`docs/financial-code-review.md`) about whether the canteen attendant
can see what she received from the restaurant versus what she's sold —
she currently cannot, in one place. Confirmed the stock-count entry
screen's blind-count design (no expected quantity shown while
counting, per `record-stock-count.tsx`'s and `staff-shell.tsx`'s
existing comments — "the count is blind, so the home screen must not
leak what the till expects either") is a deliberate anti-fudging
choice and should **not** change as part of this — expected-vs-counted
stays a post-submission comparison only.
