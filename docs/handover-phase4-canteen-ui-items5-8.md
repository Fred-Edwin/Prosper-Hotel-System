# Handover — Canteen redesign, items 5–8 + production readiness

**For:** a fresh agent session in `/home/edwinfred/prosper-hotel`, on branch
`add/canteen-real-sales`.
**Written by:** the tech-lead session that did items 1–4, 2026-08-13.
**Role to hold for this work:** same as the prior handover
(`docs/handover-phase4-canteen-ui.md`) — tech-lead / senior-engineer,
reading requirements, making scoping calls, writing the code, stopping to
ask Edwinfred at genuine branch points. Not a narrow ticket-executor.

**Process for this half, per Edwinfred's explicit instruction:** items 5–8
are implemented **directly** — no `/tickets`, no `/build`, no `/review`
gate per item. Still test-first for logic changes (per `CLAUDE.md`'s
standing rule), test-after for plumbing. Run lint/tsc/build before calling
each item done. This is a deliberate, confirmed departure from the
project's normal pipeline for exactly this batch of work — don't re-ask
about it.

---

## Zero — read first, in this order

1. `CLAUDE.md`, `AGENTS.md`.
2. `docs/handover-phase4-canteen-ui.md` in full — the original handover for
   the whole redesign. Items 1–4 (below) are done; this document is the
   rest.
3. This document, in full, before writing any code.
4. **Uncommitted state check.** As of this handover, items 1–4's work is
   sitting uncommitted on `add/canteen-real-sales` (`git status` will show
   modified files across `sales/`, `stock/`, `staff-nav.ts`, `staff-shell`,
   plus new files: `confirm-transfer.tsx`/`.stories.tsx`,
   `sent-transfers.tsx`/`.stories.tsx`, the `by-source` and
   `sent-confirmed` API routes). **This is real, reviewed, tested work —
   not scratch.** Confirm `pnpm test` is green first (see step 1 below),
   then commit it before starting item 5, so items 5–8 land as their own
   commit(s) on top of a clean base. Do not discard or `git checkout --`
   anything.

## What's already done (items 1–4, do not redo)

- **Item 1** — `sales/ui/new-sale.tsx`: attendant role no longer requires
  payment lines to complete a sale. Approved.
- **Item 2** — `components/layout/staff-shell.tsx`: second stacked banner
  for pending transfer confirmations. `stock/ui/confirm-transfer.tsx`: new
  screen, non-blind (sent quantity shown upfront — confirmed with
  Edwinfred, unlike the handover count). Approved.
- **Item 3** — `stock/ui/stock-list.tsx`: canteen-only My stock / From
  restaurant tabs. New backend read `getCurrentStockAtLocationBySource`
  (`stock/logic.ts`), new route `GET /api/stock/[locationId]/by-source`.
  Test-first, 3 new integration tests. Approved.
- **Item 4** — banner/confirm screen reuse (no new work) + new
  `stock/ui/sent-transfers.tsx` reconciliation view. New backend read
  `getConfirmedTransfersSentFromLocation`, new route
  `GET /api/stock/transfers/sent-confirmed`. Test-first, 2 new integration
  tests. **Status in `docs/screens.md`: "in review"** — Edwinfred has not
  yet explicitly signed off on this one screen the way he did 1–3. Surface
  it for a look before treating it as finished, or fold that check into
  your own end-of-item-5-8 verification pass.

Full detail, including two scope calls made without stopping (per
Edwinfred's "batch to the end" instruction mid-pass), is in
`docs/screens.md`'s new note under Stock, dated 2026-08-13.

**Known, confirmed-broken thing found while building item 4, deliberately
not fixed there:** `listTransfersAtLocation` (`stock/logic.ts`, backs
`transfer-history.tsx`) reconstructs transfer history purely from
`StockMovement`/`IngredientMovement` rows with `reason: "transferred"`. In
the two-sided transfer model, a **pending** transfer only writes the
sender's outgoing movement — the receiver's leg doesn't exist until
`confirmTransfer` runs. So today, a still-pending transfer shows as
one-sided or missing, and there's no confirmed-vs-sent quantity available
via this function at all. This is item 5's job (below) — item 4's new
reads went straight to the `Transfer` model instead of depending on this
broken path.

---

## The work

### 5. Surface `transfer-history.tsx`

**Files:** `stock/ui/transfer-history.tsx` (built, currently unreachable —
no nav key points to it), `stock/logic.ts`'s `listTransfersAtLocation`,
`components/layout/staff-nav.ts`, `src/app/staff/staff-page-client.tsx`.

- Rewrite `listTransfersAtLocation` to read from the `Transfer` model
  directly (it's the source of truth for status now — `Transfer.status`,
  `sentQuantity`, `confirmedQuantity`), not reconstructed from movement
  pairs. It needs to correctly represent all three states: pending, sent
  (from this location), confirmed. Check `TransferHistoryEntry`/
  `TransferHistoryLine` in `stock/index.ts` — the reader-facing shape may
  need a `status`/`confirmedQuantity` field added; check callers of
  `TransferHistoryEntry` before changing its shape.
- Test-first — this is a real logic rewrite, not plumbing. Look at
  `transfers.integration.test.ts`'s existing pattern (`staffAt` helper,
  `beforeEach` cleanup) — item 4's new tests in that file are the most
  recent example of the pattern to follow.
- Add `transfer-history` as its own `staffLinks` entry AND as a home-screen
  tile for both `store-manager` and `attendant` (the roles that transfer)
  — **check the current tile count first.** `staff-nav.ts` currently has
  store-manager at 10 tiles, attendant at 9, both already over
  `docs/design.md`'s "target 5–8 destinations per person" guidance (this
  was already true before this session touched anything — not something
  items 1–4 caused). Decide with Edwinfred whether transfer-history becomes
  a 10th/11th–12th tile, replaces/merges an existing one, or whether the
  6-link budget genuinely needs revisiting for these two roles now that
  the canteen redesign added real destinations. Don't silently blow past
  the guidance without flagging it — this is exactly the kind of design
  question `docs/design.md`'s navigation section cares about.
- Wire the `active === "transfer-history"` branch in
  `staff-page-client.tsx` (branch already exists per the original
  handover — confirm it still points at the right component after your
  `listTransfersAtLocation` changes).

### 6. "Today's summary" — rename and extend

**Files:** `sales/ui/todays-sales.tsx`, `staff-nav.ts`'s `sales` link
(currently "Today's sales").

- Rename nav label to "Today's summary."
- Cashier/store-manager content unchanged (their own sales today).
- Attendant's content expands, per REQ-02 Part B
  (`docs/feature-requests.md`):
  - Sales recorded today (cash + M-Pesa combined — reuse whatever the
    handover screen already reads for this figure).
  - Transfers received today, confirmed quantities — same
    `getPendingTransfersAtLocation`/`Transfer`-model data source item 2's
    `confirm-transfer.tsx` uses, filtered to confirmed-today.
  - Transfers sent today — same shape, filtered from
    `getConfirmedTransfersSentFromLocation` (item 4's new read) or a
    same-day variant of it.
  - Count-derived sold quantity **retired** — replace with actual sold
    quantity from her own recorded sales (real data now, not inferred).
  - Current closing stock — item 3's split view, or a summary of it.
- This is UI composition against already-decided data shapes (items 2–4
  already built the backend reads this needs) — closer to ordinary
  extension than new design, per the original handover's process note.
  Still worth a quick self-check against `docs/design.md`'s "a summary
  strip states, and links where a link exists" rule before considering it
  done.

### 7. Cancel-pending-transfer UI

`POST /api/stock/transfers/[transferId]/cancel` exists
(`cancelPendingTransfer` in `stock/logic.ts`), no UI calls it yet.

- Per Edwinfred's decision (2026-08-13): the trigger lives **alongside
  transfer-history** (item 5), as an action on the sender's own
  still-pending sends in that list/screen. Not a separate screen.
- Check `stock/ui/transfer-stock.tsx` / `transfer-variants.tsx` for whether
  a "just sent" confirmation state already exists there — it predates the
  two-sided model (still shows an old-style "transferred immediately"
  toast per `transfer-variants.tsx`'s `complete()` function) and is not
  this item's job to fix, but don't accidentally build a second cancel
  trigger there by mistake.

### 8. Fix the known stale-field gap

**Files:** `reporting/ui/dashboard-profit.tsx`, `reporting/ui/ledger-shell.tsx`,
and both `.stories.tsx` files.

- Remove `canteenCostRate`, `lastCanteenCount`, `canteenEstimated`,
  `provisional` from these components' local view types and rendering —
  they no longer exist in the API response (check `getDashboardProfit`'s
  and `getLedgerSummary`'s actual return types in `reporting/logic.ts` for
  the current shape). This is a real, disclosed bug: these components
  currently compile fine (their local view types are independent of the
  real API response) but render blank/`NaN` at runtime for these fields.
- The canteen's profit/cost-of-goods figures are final now, same status as
  the restaurant's — present them the same way, no "provisional" badge.
- Update the Storybook stories' fixture data to match the corrected types.
- This is a bug fix against an already-decided shape (the backend commit
  `42b5f31` already defines the real response shape) — test-after is fine,
  but do check the affected screens render correctly against real
  `getDashboardProfit`/`getLedgerSummary` output, not just updated
  fixtures, before calling it done.

---

## After items 5–8: production-readiness checklist

Per Edwinfred's explicit framing — this repo deploys automatically on push
to `main` (`docs/release.md`, single direct-to-prod tier, no staging) — so
"ready to push" here means "ready to go live," not just "ready for a PR."
Treat every item below as a gate, not a nice-to-have:

1. **Full regression pass, in this order:**
   ```
   pnpm test            # integration — must stay at 100% pass, no skips
   pnpm exec tsc --noEmit
   pnpm lint
   pnpm build
   ```
   All four must be clean before proceeding. `pnpm test` takes ~3 minutes
   — run it in the background and wait for the notification rather than
   polling.

2. **Real-browser verification** (`CLAUDE.md`'s UI rule — Storybook is not
   enough). Kill any stale `next dev` server first if one is running from
   a prior session. Walk through, as real staff logins:
   - Attendant: record a sale with no payment lines typed, confirm it
     completes; record a credit sale within the same till.
   - Store manager: send a transfer to the canteen.
   - Attendant: see the pending-transfer banner appear, open
     confirm-transfer, confirm with a **short** quantity, verify the
     shortfall receipt shows.
   - Store manager: see the confirmed transfer show up (reconciled or
     short) in whatever item 5/7 landed as the transfer-history +
     sent-transfers destination.
   - Cancel a still-pending transfer as the sender; confirm it disappears
     from the receiver's pending banner.
   - Canteen stock page: My stock / From restaurant tabs return the right
     split against real data.
   - Today's summary: check attendant's expanded view against real sales/
     transfers recorded during this walkthrough.
   - Dashboard + Ledger: confirm no blank/NaN canteen figures, no stray
     "provisional" language.

3. **E2E check** (`e2e/`, Playwright). Look at whether any existing spec
   touches canteen sales, transfers, or handover — the canteen no longer
   trades by declared daily totals, so a spec asserting the old flow will
   now fail for real reasons, not flake. Decide with Edwinfred whether the
   confirm-transfer flow (a new critical, multi-step, multi-role path)
   needs its own E2E spec before shipping — the project's own conventions
   say E2E is for "critical paths only," and this qualifies. Reuse
   `e2e/auth.setup.ts`'s saved login state; `data-testid` selectors only.

4. **`docs/gotchas.md`** — add an entry for the `listTransfersAtLocation`
   movement-reconstruction gap (found this session, real time cost to
   trace). Follow the existing entries' format (see the two dated
   2026-08-13 already there, from the backend pass).

5. **`docs/screens.md`** — move `SentTransfers` from "in review" to
   "approved" once Edwinfred has actually looked at it (see the item 4 note
   above); add rows for whatever items 5/6 build (`TransferHistory` already
   has a row — check whether it needs updating rather than a new one, since
   the underlying screen isn't new, just newly reachable and newly correct).

6. **Commit discipline** — items 1–4's uncommitted work (see step 0.4
   above) should be its own commit before items 5–8 begin. Items 5–8 should
   land as their own commit(s), not squashed together with 1–4 — they're
   materially different changes (new screens vs. a logic rewrite +
   bugfixes) and a reviewer or future `git blame` benefits from the split.
   Do not push to `main` without Edwinfred's explicit go-ahead, even though
   items 5–8 skip the `/review` gate — direct-to-prod still means someone
   should say "yes, push this" out loud first, per the project's standing
   working rule on infrastructure-touching actions.

7. **Stop and ask** at any genuine branch point not resolved by this
   document — same standing instruction as every skill in this project.
   The nav-tile-budget question in item 5 is flagged as open on purpose,
   not an omission.
