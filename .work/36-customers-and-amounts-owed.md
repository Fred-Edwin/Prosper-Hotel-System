# 36 — Customers tab and amounts owed

**Type:** logic (test-first)
**Blocked by:** None (`Customer`, `createCustomer`/`listCustomers`
already exist in `people` since ticket 06; `getCustomerBalance` already
exists in `sales` since ticket 08 — this ticket is the first screen to
read both together)

**Status:** done (merged 2026-08-12)

**⚠ UI checkpoint (Edwinfred's explicit request):** this ticket builds a
real screen from an already-designed prototype (see below). Before
`/build` merges this ticket, stop and show Edwinfred the built Storybook
story — a screenshot only if a live `pnpm storybook` URL genuinely can't
be reached — for approval or correction, same as the `.claude/skills/
build/SKILL.md` checkpoint for a new screen with no precedent, even
though precedent exists here. Do not merge on self-check alone.

## Goal

Build the People destination's missing Customers tab, and make
proposal.md §7/§10.7's "Amounts owed" real: outstanding balance per
customer, across both locations, and the total. Today `Customer` records
exist (ticket 06) and a per-customer balance is computable (ticket 08),
but **there is no Customers tab at all** — `people-page-client.tsx`
renders only `StaffDestination`, despite that file's own comment
implying "Customers... are a separate tab." This ticket builds it.

## Context

- proposal.md §7: "Amounts owed. Outstanding balances by customer across
  both locations." §10.7 / formulas.md §11: "owed by a customer = credit
  given − repayments... total owed = the sum across all customers, both
  locations."
- **Design precedent exists — check the design-reference worktree before
  building anything from scratch**
  (`../prosper-hotel-design-reference`, per `docs/architecture.md`'s
  precedent table and `docs/gotchas.md`): `src/components/design/people/
  list.tsx` (`PeopleList`) already builds exactly this — a two-tab
  Staff/Customers list using `TableToolbar` + `RecordTable` +
  `SummaryStrip`, and `src/components/design/people/customer-page.tsx`
  (`CustomerPage`) is a full `DetailPage`-template customer detail view
  showing the balance as an arithmetic (credit extended − repayments,
  not a stored figure) with a repayment action inline. Adapt these,
  don't reinvent — same discipline `new-sale.tsx` followed adapting the
  till prototype.
- Relevant module: `src/modules/people/` — `listCustomers`,
  `createCustomer`, `updateCustomer` already exported. `getCustomerBalance`
  lives in `src/modules/sales/index.ts` (ticket 08) — this ticket's
  People-destination screen reads across `people` (customer identity) and
  `sales` (balance), a `people → sales` cross-module read with no
  existing precedent in that direction (prior reads have gone
  `stock → catalogue`, `stock → sales`) — confirm this is the right
  shape (a thin new export on whichever module ends up computing the
  summed total) against `docs/architecture.md`'s Modules table before
  building; if it reads awkwardly, this is worth a quick check-in rather
  than assuming.
- `sales/queries.ts`'s `sumCreditAcrossAllCustomers` (added by ticket 33
  for the Dashboard's "Owed to you" figure) — reuse this for the total;
  don't recompute it a second way.
- `src/app/people/people-page-client.tsx` — currently renders only
  `StaffDestination`; this ticket adds tab structure here (or wraps both
  destinations in a shared tab shell) per the design-reference's
  two-tab `PeopleList` shape.
- **Recording a repayment** — CONTEXT.md/formulas.md's "repayments"
  concept: does this ticket record repayments, or only display the
  balance ticket 08's credit already produces? The design-reference's
  `CustomerPage` shows a repayment action inline ("taking a repayment
  happens on the customer"), but no `recordRepayment`-shaped logic
  exists anywhere in the codebase yet — confirm with Edwinfred whether
  recording a repayment is in this ticket's scope or a follow-on before
  assuming the prototype's action button ships as fully wired.

## Scope

**In:**
- Customers tab on the People destination, alongside Staff (tabs, not a
  new nav destination) — list of customers, name, balance, reusing
  `RecordTable`/`TableToolbar`/`SummaryStrip` per the design-reference
  precedent.
- A customer detail view (adapted from `CustomerPage`) showing the
  balance as credit extended minus repayments, not a stored figure.
- The summed total owed (all customers, both locations) shown in the
  tab's `SummaryStrip`, reusing ticket 33's `sumCreditAcrossAllCustomers`
  rather than recomputing.
- Owner-only read (matches every other cross-location aggregate read in
  this codebase).

**Out:**
- Recording a repayment, unless confirmed in scope per the Context note
  above — resolve this explicitly before building, don't assume either
  way.
- Any change to how credit is extended (ticket 08's `recordCounterSale`
  credit-line path) — this ticket only reads and displays.
- Per-location split of the owed total — proposal.md is explicit the
  total is "across both locations," a single combined figure the way
  `getRunningCashBalance` is a single combined figure.

## Acceptance criteria

- [ ] The People destination has a Customers tab, alongside the existing
      Staff tab.
- [ ] Each customer's balance shown matches ticket 08's
      `getCustomerBalance` exactly.
- [ ] The tab's summary total matches the sum across all customers, both
      locations.
- [ ] A customer detail view shows the balance as an itemized
      credit-minus-repayments arithmetic (once the repayment-recording
      question above is resolved, tests cover it; if repayment recording
      is deferred, the detail view still shows credit lines correctly).
- [ ] Only the owner can view the Customers tab and its balances.
- [ ] **Screen, checkpointed with Edwinfred before merge (see the
      checkpoint note above):** Customers tab (list + detail), adapted
      from the design-reference's `list.tsx`/`customer-page.tsx`.
- [ ] Loading, empty (no customers yet), and error states via
      `components/patterns/states.tsx`.
- [ ] Storybook stories cover: empty state, list with several customers
      (some owing, some not), detail view.

## Verification

- Integration tests, test-first: per-customer balance matches ticket 08's
  existing calculation, summed total matches `sumCreditAcrossAllCustomers`,
  owner-only gate.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- **Show Edwinfred the live Storybook story (or the running app) before
  merging** — this is the ticket's explicit checkpoint, not optional
  self-check.
- Add the new story to `docs/screens.md`'s People section.
