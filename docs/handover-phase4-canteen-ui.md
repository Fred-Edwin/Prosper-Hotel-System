# Handover — Canteen redesign, UI pass

**For:** a fresh agent session in `/home/edwinfred/prosper-hotel`, on branch
`add/canteen-real-sales` (currently at the tip — check `git log --oneline -5`
to confirm you're on top of "feat: canteen records real sales instead of
count-derived sales (backend)").
**Written by:** the tech-lead session, 2026-08-13.
**Role to hold for this work:** you are acting as the same tech-lead /
senior-engineer role this session held — reading requirements, making the
scoping calls the skills ask for, writing the code, and stopping to ask
Edwinfred rather than guessing at genuine branch points. Not a narrow
ticket-executor: several of the items below need a real design decision
before a line of UI code is written.

---

## Read first, in this order

1. `CLAUDE.md`, `AGENTS.md` — project conventions, this Next.js version's
   quirks.
2. `docs/proposal.md` §4 (Canteen operations) and §5 (Handover, canteen case)
   — both fully rewritten 2026-08-13. This is the spec every screen below
   answers to.
3. `docs/scope.md`'s "2026-08-13 — Canteen: real sales, two-sided transfers,
   retiring count-derived sales" entry — the definition of done for the
   *whole* redesign (backend + UI). The backend half is done; this handover
   is the rest of that definition.
4. `docs/feature-requests.md`'s REQ-02 entry — the two-sided-transfer and
   Today's-summary requirements this UI pass implements, in Edwinfred's own
   words, agreed 2026-08-13.
5. `docs/architecture.md`'s "The two locations record trade the same way"
   section — the revised comparison table and the retained record of the
   original design below it, so you understand what changed and why rather
   than just what the code now does.
6. `CONTEXT.md`'s `Sale`, `Takings` (retired), `Handover`, and `Location`
   entries — vocabulary, all revised 2026-08-13.
7. `docs/gotchas.md`'s two newest entries (both dated 2026-08-13): the
   `dashboard-profit.tsx`/`ledger-shell.tsx` stale-field gap, and the
   `StockMovement` quantity-0 pattern. Both are directly relevant to what
   you're about to touch.

## What's already done (do not redo)

The backend implementation is complete, committed, and green: 386 tests
passing, lint clean, build clean. Read the commit itself for the full
picture:

```
git show --stat 42b5f31
```

In summary — the module interfaces you'll build against:

- **`sales`**: `recordCounterSale` now accepts `paymentLines: []` for a
  canteen sale (product + quantity only). The restaurant still requires
  full payment lines — enforced in `sales/logic.ts`, not just by which UI
  calls it. Credit sales fold into the same `recordCounterSale` call with a
  `credit` payment line and `customerId`.
- **`stock`**: transfers are two-sided now. `recordTransfer(s)` sends
  (writes the outgoing movement, creates a `pending` `Transfer` row, does
  **not** move the receiver's stock yet). New: `confirmTransfer(db,
  requester, { transferId, confirmedQuantity })` — receiver-only, writes
  the incoming movement at the confirmed quantity plus a
  `transfer_shortfall` marker (quantity always `0` — see gotchas.md) if
  short. New: `getPendingTransfersAtLocation(db, requester, locationId)` —
  what a location's staff should see the moment they land on a task screen.
  New: `cancelPendingTransfer(db, requester, transferId)` — sender's own
  undo of a still-pending send. `reverseTransfer` now undoes an
  already-confirmed transfer via a real opposite transfer.
- **`cash`**: `Takings` (and its UI, routes, nav entry) is gone entirely.
  Handover is the single step at both locations — `recordHandover(cashMinor,
  mpesaMinor)` is genuinely all she does now, no separate declare-first
  step. Canteen's expected figure is a **combined** total
  (`Handover.expectedMpesaMinor` is `null` at the canteen — means "not
  tracked separately," never "expected zero").
- **`reporting`**: canteen cost of goods and profit are final, never
  provisional, at both locations — see `getDashboardProfit`,
  `getLedgerSummary`.

New API routes that exist and have no UI caller yet:

```
GET  /api/stock/transfers/pending
POST /api/stock/transfers/[transferId]/confirm   { confirmedQuantity }
POST /api/stock/transfers/[transferId]/cancel
```

## The known, disclosed gap this handover closes

`src/modules/reporting/ui/dashboard-profit.tsx` and
`src/modules/reporting/ui/ledger-shell.tsx` (plus their `.stories.tsx`
files) still read response fields the backend no longer sends
(`canteenCostRate`, `lastCanteenCount`, `canteenEstimated`, `provisional`).
They compile — the UI's local view types are independent of the actual API
response shape — but will render blank/`NaN` for those figures at runtime.
Fixing this is in scope for this pass (item 8 below).

---

## The work

Route this through `/design` first for the genuinely new screens (items 2
and 3 — no design-reference precedent exists for either), then `/tickets`
→ `/build` → `/review` for implementation, per the project's normal
pipeline. Don't skip `/design`'s checkpoint step ("state whether you're
building one composition or 2-3 structurally different variants, and why,
before building either") — these are exactly the kind of screen
`docs/architecture.md`'s stock-list note warns about inventing unreviewed.

### 1. Canteen sell screen — extend, not new

**File:** `src/modules/sales/ui/new-sale.tsx`

Already wired: the attendant's `sell` nav link
(`components/layout/staff-nav.ts` — added this session) routes to
`<NewSale role={role} />` in `staff-page-client.tsx`. `NewSale` already has
a role branch (`counterDisabledForRole = role === "store-manager"`, line
~249) — same pattern, extend it.

For `role === "attendant"`: the payment step should not require full
payment lines. Product + quantity, complete the sale — matches
`recordCounterSale`'s new tolerance for `paymentLines: []`. Credit stays
available (name a customer, `method: "credit"` line) — same flow, not a
separate screen, per `docs/proposal.md` §4 ("one flow, not a separate
screen, matching how a restaurant cashier already records credit within
the till").

This is very likely a design tweak to an existing composition, not a new
screen — but confirm the checkout step's shape (does "Complete sale"
change to something else when there's nothing to pay? does the amount
still show for her own tracking?) before assuming.

### 2. Receive-confirmation banner + confirm screen — new

No design precedent. Needs a `/design` pass.

**Banner:** `StaffHome` in `components/layout/staff-shell.tsx` (~line 120)
already has one precedent banner — the un-handed-over nudge (~line 139),
deliberately a sentence, not a badge ("a badge cannot say why" — read the
comment in full before designing this). A second banner belongs here:
pending transfers waiting for confirmation, sourced from
`GET /api/stock/transfers/pending`. Applies at **both** locations — REQ-02
is explicit this is not canteen-special-cased. Decide with Edwinfred
whether it's a second banner stacked above/below the handover one, or a
combined "here's what's waiting" treatment — this is exactly the kind of
call `/design`'s checkpoint step exists for.

**Confirm screen:** new nav destination reachable from the banner (and
probably also from wherever transfer history ends up, see item 5). Shows
what was sent (item, quantity, who, when), lets her enter what she
actually received, calls
`POST /api/stock/transfers/[transferId]/confirm { confirmedQuantity }`. A
short receipt should surface as visible feedback, not a silent write —
`docs/proposal.md` §4 calls the shortfall "auto-recorded as its own
discrepancy movement," and the person confirming should see that happened.

### 3. Split stock view — extend `stock-list.tsx`

**File:** `src/modules/stock/ui/stock-list.tsx`

Currently one flat list, backed by `GET /api/stock/[locationId]`. Needs a
canteen-owned vs. restaurant-supplied filter or tab, per
`docs/scope.md`'s definition of done ("the canteen stock page filters
between canteen-owned and restaurant-supplied stock"). The backend has no
explicit label for this — it's inferred the same way
`reporting/logic.ts`'s `computeCanteenCostOfGoods` already does it: a
product received directly (`reason: "received"`) is her own goods; a
product that arrived via `reason: "transferred"` is restaurant-supplied.
You may need a new stock-module read that returns this split rather than
computing it client-side from raw movements — check what
`getCurrentStockAtLocation` currently returns before deciding whether to
extend it or add a new function. Restaurant-only staff (store manager,
cashier) don't need this filter; it's canteen-specific UI even though the
underlying mechanic (transfer confirmation) is not.

### 4. Store-manager mirror

- The same receive-confirmation banner/screen from item 2 — she receives
  supplier deliveries into the existing `receive` flow, but also now
  receives transfers *back* from the canteen (printing/stationery, per
  proposal.md §2) through the same pending/confirm mechanism.
- Her stock view should show on-hand vs. sent-to-canteen. Check whether
  `stock-list.tsx`'s restaurant-side rendering needs a similar extension or
  whether this belongs on a different existing screen — don't assume
  `stock-list.tsx` is the only place this fits without checking.
- Visibility into whether the canteen's receipt reconciled cleanly (no
  shortfall) — this could be as simple as showing confirmed transfers she
  sent, with their confirmed-vs-sent quantities, somewhere she already
  looks. Ask before inventing a new screen for this alone.

### 5. Surface `transfer-history.tsx`

**Files:** `src/modules/stock/ui/transfer-history.tsx` (built, unreachable),
`src/app/staff/staff-page-client.tsx` (already has a routed
`active === "transfer-history"` branch, just no nav key reaches it),
`src/components/layout/staff-nav.ts`.

This screen predates the two-sided transfer model — check whether its data
shape (`TransferHistoryEntry` in `stock/index.ts`) still reads correctly
against pending/confirmed/cancelled transfers, since `listTransfersAtLocation`
was left structurally as-is in the backend pass (it still reconstructs
history from movement pairs, which now only exist once a transfer is
confirmed — a still-pending transfer will show as one-sided or missing
depending on how you read it). You may need to extend
`listTransfersAtLocation` to read from the `Transfer` model directly
instead of reconstructing from movements, now that `Transfer` is the
source of truth for status. Whether this becomes its own nav entry or
folds into item 6's Today's summary is explicitly still open — REQ-02 says
so; decide with Edwinfred, don't default silently.

### 6. "Today's summary" — rename and extend

**File:** `src/modules/sales/ui/todays-sales.tsx`,
`components/layout/staff-nav.ts`'s `sales` link (currently "Today's
sales").

Per REQ-02 Part B: rename to "Today's summary." Cashier/store-manager
content is unchanged (their own sales today). Attendant's content expands:
takings recorded (now: sales recorded, cash+M-Pesa combined — reuse
whatever the handover screen already reads), transfers received today
(confirmed quantities, from the same pending-transfers data source, now
that item 2 makes this real), count-derived sold quantity **retired** —
replace with actual sold quantity from her own recorded sales, and current
closing stock (item 3's split view, or a summary of it).

### 7. Cancel-pending-transfer UI

`POST /api/stock/transfers/[transferId]/cancel` exists, no UI calls it.
Needs a trigger somewhere a sender can see their own still-pending sends —
likely alongside item 5's transfer history, or immediately after sending
in item... check `transfer-stock.tsx` (`src/modules/stock/ui/`) for
whether a "just sent" confirmation state already exists there that this
could hang off of.

### 8. Fix the known stale-field gap

**Files:** `src/modules/reporting/ui/dashboard-profit.tsx`,
`src/modules/reporting/ui/ledger-shell.tsx`, and both `.stories.tsx` files.

Remove `canteenCostRate`, `lastCanteenCount`, `canteenEstimated`,
`provisional` from these components' local view types and rendering —
they no longer exist in the API response (see `getDashboardProfit`'s and
`getLedgerSummary`'s actual return types in `reporting/logic.ts` for the
current shape). The canteen's profit/cost-of-goods figures are final now,
same status as the restaurant's — the UI should present them the same way,
not with a "provisional" badge that no longer applies. Update the Storybook
stories' fixture data to match.

---

## Process notes

- **Route through `/design` for items 1–4** before ticketing — genuinely
  new UI or a real composition decision, not mechanical wiring. Items 5–8
  are closer to ordinary ticket work against already-decided shapes; use
  judgment on whether they need a design pass too, but don't skip the
  checkpoint by default.
- **Test-first for logic changes** (any new stock-module read you add for
  item 3 or 5), test-after for UI wiring — same rule as everywhere else in
  this project.
- **Verify against a real browser**, not just Storybook — `CLAUDE.md`'s UI
  rules require this, and per `docs/gotchas.md`, kill any stale `next dev`
  server first if you've just migrated (you haven't this session, but
  check before assuming).
- If you hit a genuine ambiguity not resolved by this document or the docs
  it points to — stop and ask Edwinfred, the same standing instruction
  every skill in this project carries. Several of the open questions above
  (banner placement, whether transfer history gets its own nav entry) are
  flagged as open on purpose, not omissions.
