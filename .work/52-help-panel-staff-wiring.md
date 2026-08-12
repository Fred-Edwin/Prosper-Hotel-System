# 52 — Wire HelpPanel into every staff task screen

**Type:** plumbing (test-after)
**Blocked by:** 51 (staff shell header needs an actions slot to wire
this into)
**Status:** in-progress

## Goal

Every staff task screen (all 12 nav links, across Cashier, Attendant,
Store manager) shows a working "?" help trigger in its task header,
opening the correct approved content, and never covering that screen's
bottom-anchored primary action when open.

## Context

- Pattern: `src/components/patterns/help-panel.tsx` (`bottomOffset` prop
  exists for exactly this case),
  `src/components/patterns/help-content.ts` — already built, do not
  redesign or redraft content.
- New slot from ticket 51: `StaffShellHome`'s right-side header prop,
  threaded through `src/app/staff/staff-page-client.tsx`.
- Per-screen topic keys and bottom-action heights (measure each screen's
  actual sticky bar height when implementing — these are the buttons to
  clear, not a guessed px value):

| Nav label | `active` key | Component | topic key | Bottom bar to clear |
|---|---|---|---|---|
| New sale | `sell` | `src/modules/sales/ui/new-sale.tsx` | `new-sale` | "Complete sale" (sticky bottom-0) |
| Today's sales | `sales` | `src/modules/sales/ui/todays-sales.tsx` | `todays-sales` | none |
| Wastage | `wastage` | `src/modules/stock/ui/record-wastage.tsx` | `wastage` | "Record" (sticky bottom-0) |
| Stock | `stock` | `src/modules/stock/ui/stock-list.tsx` | `staff-stock` | none |
| Handover | `handover` | `src/modules/cash/ui/handover.tsx` | `handover` | "Hand over" / "Check what I've counted" (sticky bottom-0) |
| Takings | `takings` | `src/modules/cash/ui/takings.tsx` | `takings` | "Record today's takings" / "Check what I've entered" (sticky bottom-0) |
| Credit sale | `credit` | `src/modules/sales/ui/credit-sale.tsx` | `credit-sale` | "Record credit sale" (sticky bottom-0) |
| Receiving | `receive` | `src/modules/stock/ui/receive-delivery.tsx` | `receiving` | "Record delivery" (sticky bottom-0) |
| Stock count | `count` | `src/modules/stock/ui/stock-count.tsx` / `record-stock-count.tsx` | `stock-count` | "Record count" (bottom bar) |
| Transfer stock | `transfer` | `src/modules/stock/ui/transfer-stock.tsx` / `transfer-variants.tsx` | `transfer-stock` | "Review N items" / "Transfer N items" (sheet footer) |
| To kitchen | `issue` | `src/modules/stock/ui/issue-to-kitchen.tsx` | `to-kitchen` | "Record issue" (sticky bottom-0) |
| Production | `production` | `src/modules/stock/ui/record-production.tsx` | `production` | "Record production" (sticky bottom-0) |

  Note `stock` (nav label) uses topic key `staff-stock`, not `stock` —
  deliberately distinct from the admin Stock destination's `stock` topic
  key, since the staff and admin Stock screens show different content
  (staff: name + quantity only; admin: filters, value, low-stock). Don't
  collapse these into one key.
- Every topic key above already exists in `help-content.ts` — confirmed
  content, don't re-derive or redraft.

## Scope

**In:**
- Pass `<HelpPanel topic="..." bottomOffset={N} />` into each of the 12
  task components' header slot (via ticket 51's new prop), per the table
  above — `bottomOffset` only where a bottom bar exists, `0`/omitted
  otherwise.
- Confirm each screen's actual sticky-bar height at implementation time
  and pass the real measured value, not a placeholder.

**Out:**
- `transfer-history` (`active === "transfer-history"`) — not a top-level
  nav link, reached from within Transfer stock. Leave unwired unless
  Edwinfred asks for it separately.
- Any change to `HelpPanel`, `help-content.ts`, or ticket 51's slot
  itself.
- Admin shell wiring (ticket 50).

## Acceptance criteria

- [ ] All 12 staff task screens show a "?" trigger in their header,
      opening the correct topic's content as a bottom sheet (staff shell
      is always below the mobile breakpoint in practice, but confirm the
      component still degrades correctly at any width per its existing
      responsive behavior).
- [ ] On the 9 screens with a bottom-anchored primary action (see table),
      opening the help sheet does not visually cover that action —
      verify the sheet's top edge sits above the action bar, not
      overlapping it, at the screen's real rendered height.
- [ ] On the 3 screens without one (Today's sales, Stock, and any other
      confirmed bottom-bar-free screen), the sheet behaves as a normal
      full/near-full-height bottom sheet with no offset.
- [ ] `staff-stock` and `stock` topic keys are not conflated — staff
      Stock screen shows the staff-appropriate content, not admin's.
- [ ] Storybook stories updated/added per touched component showing the
      trigger present, consistent with each component's existing states
      coverage.

## Verification

- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check in the browser at a mobile viewport width: each of the 12
  screens, confirm trigger placement, correct content, and (for the 9
  with a bottom bar) that the sheet clears the action visibly rather than
  covering it.
- No integration test needed — pure composition, no new branching logic;
  `/review` against `references/ui-rules.md` is the correctness check
  here.
- `docs/screens.md` unchanged — no new destination or story beyond what
  already exists for `Patterns/HelpPanel`.
