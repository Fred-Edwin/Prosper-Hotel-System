# Handover — Canteen count-derived sales, e2e + final pass (Session 3 of 3)

**For:** a fresh agent session in `/home/edwinfred/prosper-hotel`, working
tree on top of the current uncommitted Session 1 + Session 2 changes (see
"State of the tree" below — nothing is committed yet).
**Written by:** the tech-lead session that did Session 2 (UI), 2026-08-15.
**Role to hold for this work:** same as the project's other handovers —
tech-lead, not a narrow ticket-executor. This session is verification and
polish, but "verification" still means judgment — if something looks wrong,
say so and fix it or ask, don't wave it through.

---

## Why this exists

Client asked the canteen to go back to count-derived sales (count what's
left, the system works out what sold) instead of individually recording
each sale — a deliberate reversal of the 2026-08-13 canteen redesign. See
`docs/scope.md`'s **2026-08-15 — Canteen: count-derived sales, dropping
credit and individual entry** entry for the full reasoning.

The work was deliberately split into three sessions with a checkpoint
before each:

1. **Backend** (schema/logic/routes, done) — `recordStockCount` now infers
   canteen sales; `recordCounterSale` rejects the canteen; canteen credit
   sales dropped.
2. **UI** (done, this handover's predecessor at
   `docs/handover-canteen-count-derived-sales-ui.md`'s prior version —
   overwrite it, its job is done) — removed canteen sale entry, built the
   count review-before-commit step, added the no-count-yet-today handover
   banner, fixed a real bug found while auditing.
3. **This session** — e2e pass, edge cases, final verification. Read
   everything below before touching anything.

## Read first, in this order

1. `CLAUDE.md`, `AGENTS.md` — project conventions, this Next.js version's
   quirks.
2. `docs/scope.md`'s **2026-08-15** entry — definition of done for the
   whole change. Both the backend and UI halves are now built; this
   session verifies and closes it out.
3. `CONTEXT.md`'s `Sale`, `Location`, `Stock Movement` entries — read the
   *retired* paragraphs too, not just the current ones.
4. `docs/architecture.md`'s "The two locations record trade differently"
   section.
5. `docs/formulas.md` §1, §2, §7, §10 — §10 in particular: the
   no-count-yet-today gap, now resolved in the UI (see below), verify it
   actually reads right end-to-end.
6. `docs/gotchas.md`'s two entries dated 2026-08-15 — one is a real
   modeling constraint (Int quantities, unrelated to this work but you'll
   hit it if you touch counts), the other is **this feature's own known,
   deliberately deferred gap** — read it, it tells you what NOT to treat
   as a bug.

## State of the tree

Nothing is committed. Run `git status` and `git diff --stat` first. Three
kinds of changes are mixed in the working tree — know which is which
before you touch anything:

1. **Session 1's backend work** (`stock/logic.ts`, `stock/queries.ts`,
   `sales/logic.ts`, `sales/queries.ts`, `sales/index.ts`, `cash/logic.ts`,
   docs) — foundational, already verified, don't relitigate it.
2. **Session 2's UI work** (everything under `*/ui/`, `staff-nav.ts`,
   `staff-page-client.tsx`, `stock-page-client.tsx`, plus further
   `stock/logic.ts`/`stock/schema.ts`/`cash/logic.ts`/`cash/routes.ts`
   edits Session 2 made — see below) — what this session verifies.
3. **Two files with a genuinely unrelated, pre-existing diff**, present
   before Session 1 even started, left alone on Edwinfred's instruction
   both times:
   - `src/modules/sales/ui/new-sale.tsx` — a qty-input UX fix (undeletable
     field bug in the basket stepper). Session 2 *did* edit this file
     too (removing dead attendant-only branching, see below) — the two
     diffs are interleaved. Read carefully before changing this file
     again; don't attribute one to the other.
   - `src/modules/stock/ui/transfer-variants.tsx` — same class of qty-input
     fix. Session 2 did not touch this file. Still not yours to touch
     unless it's directly relevant to what you're testing.

Diff against `git log -1` (`68c1de4`) for the full combined picture if
needed.

**Before you start:** run `pnpm test`, `pnpm lint`, `pnpm exec tsc
--noEmit`, `pnpm build`. All four were clean at the point this handover
was written (421/421 tests). Confirm that's still true — if anything
shifted, figure out why before proceeding.

## What Session 2 built (do not redo)

- **`staff-nav.ts`**: attendant's nav no longer has `sell` or `credit` —
  down to 7 tiles (sales, receive, count, wastage, stock, transfer,
  transfer-history, handover). `credit-sale.tsx` is now unreachable from
  any nav — left in place, not deleted (Edwinfred's explicit call: keep
  the file and its client-approved help copy, just unwired).
- **`new-sale.tsx`**: restaurant/cashier-only now. The dead
  `role === "attendant"` payment-optional branching (2026-08-13 leftover)
  was pruned — `Till` no longer special-cases the attendant at all.
- **`record-stock-count.tsx`**: canteen-only additions, gated on a new
  `isCanteen` prop threaded from `staff-page-client.tsx` through
  `stock-count.tsx`:
  - Expected quantity shown per product tile and per line **while
    counting** (not just after) — e.g. "40 expected" — a deliberate,
    explicit reversal of the restaurant's blind-count protection for the
    canteen only, per Edwinfred's direct instruction mid-session (he
    wants her to see it; she counts far more often than the restaurant
    does, and the independent-check rationale doesn't apply the same way
    here).
  - A post-submit review screen: "This count means you sold" — product,
    quantity, value, total — shown before she taps Done. Not a true
    pre-commit gate (the count already wrote by the time it renders,
    same pattern as `handover.tsx`'s "done" step) but nothing is silent.
    Empty state: "Nothing counted short of expected."
- **`stock-count-detail.tsx`**: canteen counts (`isCanteen` prop) now show
  Expected and Sold columns in the read view too, not just at record time.
  Restaurant counts unchanged — counted-only, no comparison.
- **Backend change enabling the above** (Edwinfred's explicit call,
  overriding the "backend is done" boundary for this specific case):
  `stock/logic.ts`'s `getStockCount` and `recordStockCount` only strip
  `expectedQuantity` from the response for a **non-owner restaurant**
  caller now — a canteen caller (any role) and the owner (either
  location) always get it. `stock/schema.ts`'s `StockCountLineForReader`
  gained an optional `priceMinor` field for the same reason (needed to
  value a short line as a derived sale without a second round trip).
- **`handover.tsx`**: new `NoCountYetBanner`, shown on the canteen's count
  step, confirm step, and already-recorded state when
  `canteenAwaitingTodaysCount` is true. Backed by a new
  `stock/logic.ts` export, `getLatestStockCountDate` (non-owner-safe —
  just a date, not the owner-only comparison), wired through
  `cash/logic.ts`'s `getTodaysHandoverForStaff` and
  `cash/routes.ts`'s `todaysHandoverRoute`.
- **Real bug found and fixed while auditing** (not something Session 2
  was asked to build, found by checking the definition-of-done's "audit
  existing screens" item): `stock-count-review.tsx` (owner's admin Stock
  page) had a "Since last count" panel that read a `derivedSales` field
  `getLatestStockCount` has never actually sent since the 2026-08-13
  rework — it silently always rendered "nothing sold" regardless of
  reality. Fixed to compute sold quantity/revenue client-side from the
  same expected/counted/priceMinor data the comparison table above it
  already uses. Verified working live in Storybook (Edwinfred watched).
- **Storybook**: every touched/new component has stories covering its new
  states — canteen-with-shortfall, canteen-no-shortfall, the no-count
  banner, the fixed derived-sales panel. Edwinfred reviewed the key ones
  live via `pnpm storybook` and confirmed they look right — **don't
  re-verify visual correctness of what's already confirmed**; if you're
  re-running Storybook checks, focus on states Session 2 didn't show him
  (e.g. loading/error states, or anything you change yourself).

## Known, deliberately deferred gap — not a bug

`docs/gotchas.md`'s 2026-08-15 entry: the owner's Dashboard Handover
section (`cash/ui/dashboard-handovers.tsx`) does **not** show a no-count
banner, even though the attendant's own handover screen does. This was a
conscious scope call, not an oversight — the owner already sees the real
expected figure there (unlike the attendant's blind count), so she can
reason about a low number herself. If you notice this while testing,
don't "fix" it as a bug — it's already written up. Flag to Edwinfred only
if testing reveals it's actually confusing in practice, which would be new
information, not a rediscovery.

---

## The work

### 1. E2E pass

Add/extend Playwright specs (`e2e/`) for the canteen's new flow:
attendant logs in → home screen has no "sell"/"credit" tile → Stock count
→ enters counts (verify expected quantity is visible) → short a product →
Record count → review screen shows the implied sale → Done → Today's
summary shows the count-derived sale as a real row → Handover shows the
no-count banner correctly (or doesn't, once a count has landed today).
Selectors are `data-testid` only, per `CLAUDE.md` — check the ones already
added: `count-sold-review`, `count-sold-review-row`,
`count-sold-review-empty`, `count-sold-review-done`,
`handover-no-count-banner`, `derived-sales-row`.

### 2. Edge cases to verify by hand or test

- A canteen count where **every** line is short (review shows all of
  them, total sums correctly).
- A canteen count where a line is **long** (surplus) — should produce no
  sale, shouldn't appear in the review or the owner's "since last count"
  panel. `docs/formulas.md` §2 says a surplus is "not itself explained."
- Correcting a canteen count line after a count-derived sale was already
  written (`correctStockCount`'s `canteenShortfallAlreadyBooked` logic,
  built in Session 1) — verify end to end that it doesn't double-move
  stock, and that the owner's review screen reflects the correction
  properly afterward.
- Voiding a count-derived `Sale` from Today's summary — mechanically
  works (writes a `corrected` movement, same as any sale void), but
  confirm the copy in the void confirmation dialog doesn't say anything
  that only makes sense for an individually-typed sale.
- Two canteen counts on the same day — confirm the second one's expected
  quantity correctly reflects the first count's effect (not stale).
- The no-count-yet banner: verify it disappears the moment a count lands
  today, without requiring a page refresh if that's how the rest of the
  app behaves (check an existing similar live-update pattern before
  assuming either way).

### 3. Final documentation check

`docs/scope.md`'s 2026-08-15 entry's "Definition of done" list — go
through it line by line, confirm each is actually true now, not just
assumed. Update `docs/bugs.md` if this closes anything logged there
(check for a BUG referencing canteen credit-sale double counting or
similar — Session 1's handover mentioned BUG-10 as the original trigger
for all of this).

---

## Definition of done for this session (and the whole 3-session effort)

- E2E coverage exists for the canteen's count → implied-sale → handover
  path, using real `data-testid` selectors, no fixed waits.
- Every edge case in section 2 above is verified, not assumed — write
  down what you checked and what you found, even briefly, so this doesn't
  need re-verifying later.
- `docs/scope.md`'s 2026-08-15 entry's definition of done is fully
  satisfied — mark it done in whatever tracking the project uses, if any.
- `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`, and
  `pnpm test:e2e` all clean.
- This file (`docs/handover-canteen-count-derived-sales-ui.md`) is deleted
  or reduced to a one-line "done, see commit X" note once the work is
  actually committed — it's a working document, not permanent
  documentation, and leaving it around stale would violate the same
  discipline it asks of everyone else.
