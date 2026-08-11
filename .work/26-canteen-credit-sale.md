# 26 — Canteen credit sale entry point

**Type:** plumbing (test-after)
**Blocked by:** 08 (credit sale — this ticket reuses its logic and
schema, adds no new payment/customer behaviour), 23 (takings — not a
data dependency, but the canteen's other Stage 4 recording surface;
`staff-nav.ts`'s attendant array already sits next to it)
**Status:** planned

## Goal

Give the canteen attendant a way to record a credit sale, so
proposal.md §4's "credit sales are recorded individually" is actually
reachable — today it is not: `recordCounterSale`'s credit-payment-line
path (ticket 08) is real and already read by ticket 24's count-derived
formula, but the only UI that creates a sale (`NewSale`, ticket 07/11)
is wired to the `sell` nav key, which only `cashier`/`store-manager`
roles have. The `attendant` role has no path to it at all.

## Context

- Relevant module: `src/modules/sales/` (reuse `recordCounterSale`
  and its route, no logic changes) — cross-reference
  `src/modules/sales/index.ts`'s exports before assuming anything needs
  to move.
- `src/components/layout/staff-nav.ts`: `attendant` array (lines
  123–132) has no `sell`-equivalent entry today. Adding one is an
  explicit nav change, not a permission-gating fix — call this out
  since CLAUDE.md requires stopping to ask at genuine UI gaps, and this
  is being decided as part of this ticket rather than left implicit.
- `src/modules/sales/ui/new-sale.tsx`: the existing `Till` component is
  a full counter/delivery/credit till — product grid, fulfilment toggle,
  cash/M-Pesa/credit payment lines. **Do not reuse it wholesale.**
  Proposal.md §4 is explicit that "individual sales are not recorded at
  the point of sale at the canteen" — only credit sales are. Exposing
  the full till at the canteen would let the attendant record cash/
  M-Pesa sales too, contradicting the canteen's whole recording model
  (takings, not per-sale) and double-counting against the count-derived
  formula (ticket 24), which assumes canteen cash/M-Pesa sales don't
  exist as individually recorded rows.
- `CustomerPicker` inside `new-sale.tsx` (lines 690–835) is the reusable
  piece — same search/create-inline pattern, no changes needed.
- `docs/screens.md`'s Sales section: `Modules/Sales/NewSale` is the only
  entry; this ticket adds a new story rather than editing that one, per
  the point above about not reusing `Till` wholesale.

## Scope

**In:**
- A new, canteen-specific screen: product picker (search, tap to add,
  same grid/basket interaction as `Till` where it doesn't conflict with
  the scope cut below) + `CustomerPicker` (required, no optional
  cash/M-Pesa path) + "Record credit sale" action, calling
  `recordCounterSale` with a single `credit` payment line for the full
  total (no split-payment UI — a credit sale is one line by construction
  here, since there is nothing else to split against).
- A new nav entry in `staff-nav.ts`'s `attendant` array (e.g. `credit`,
  distinct from `sell` — label and icon reflecting "credit sale," not
  "new sale," so it's honest about what it does). Confirm the label/icon
  choice reads clearly at a glance before finishing — this is exactly
  the kind of small UI decision CLAUDE.md says to get right the first
  time rather than iterate on later.
- Confirmation view reusing `SaleConfirmation`'s shape (or a trimmed
  version of it) showing product lines, total, customer name.
- `fulfilment: "counter"` on the underlying `recordCounterSale` call
  (delivery fulfilment is restaurant-only per ticket 11 and not a
  canteen concept — confirm this assumption holds by checking
  `SaleFulfilment`'s definition before hardcoding it).

**Out:**
- Any cash/M-Pesa recording at the canteen — that is Takings (ticket 23),
  already built. This ticket adds credit only.
- Changes to `recordCounterSale`, `sales/logic.ts`, or the credit-sale
  data model — ticket 08 already built everything this needs.
- The handover check reading canteen credit sales — credit is excluded
  from the handover check everywhere (proposal.md §5), same as the
  restaurant.
- Editing or voiding a canteen credit sale beyond what ticket 10
  (same-day void) already provides generically — no new logic here.

## Acceptance criteria

- [ ] The canteen `attendant` role has a reachable nav entry distinct
      from `takings` that opens a credit-sale-only entry screen.
- [ ] The screen requires a customer (existing or created inline,
      reusing `CustomerPicker`) before the action is enabled — mirrors
      `Till`'s `creditNeedsCustomer` gating.
- [ ] Submitting calls `recordCounterSale` with a single payment line,
      `method: "credit"`, amount equal to the basket total, and the
      chosen `customerId`.
- [ ] No cash or M-Pesa payment option is present anywhere on this
      screen.
- [ ] A recorded canteen credit sale is readable via `Today's sales`
      (ticket 09, no changes needed — already generic) and is included
      in ticket 24's count-derived-sales credit-sale read (no changes
      needed there either — confirms the plumbing gap is closed, not
      just the UI).
- [ ] Loading, empty-product, and error states via
      `components/patterns/states.tsx`, matching `NewSale`'s existing
      pattern.
- [ ] Storybook story for the new screen, covering: empty product list,
      no customer selected (action disabled), ready-to-submit, and
      confirmation.

## Verification

- No new logic to test-first (Type: plumbing) — this is composition
  over ticket 08's existing, already-tested logic.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- Manually verify (integration test or a one-off script, not a new
  logic suite) that a canteen credit sale recorded through this screen
  shows up correctly in ticket 24's `recordCountDerivedSales` credit-sale
  subtraction — this is the actual gap being closed, so confirm it
  end-to-end rather than trusting the wiring by inspection alone.
- Add the new story to `docs/screens.md`'s Sales section.
