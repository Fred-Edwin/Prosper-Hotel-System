# 35 — Days worked and pay

**Type:** logic (test-first)
**Blocked by:** None (`StaffMember.dailyRateMinor` already exists;
ticket 17 explicitly deferred this as its own follow-on)
**Status:** done (2026-08-11)

**Scope note (confirmed with Edwinfred during build):** the ticket's
original "Out" list excluded pay disbursement/"paid" tracking. Edwinfred
asked mid-build for "mark as paid" to be included after all — a pay
figure the owner can't distinguish from what's already been paid isn't
useful standalone. Expanded in place rather than split into a follow-on
ticket, per explicit direction. Implementation: paying wages creates a
`running`-category `Expense` (proposal.md §10 already treats wages as a
running cost) with a new `Expense.payeeStaffMemberId` field distinguishing
who was paid from who recorded it; `DaysWorked.paidAs` (mirroring
`Expense.receiptId`'s existing grouping-value pattern) is stamped with
that Expense's id. Pay period stays current-calendar-month per the
ticket's original scope — Edwinfred confirmed that's fine for now and
her actual pay cycle can be revisited later if it turns out to differ.

## Goal

Complete proposal.md §11: "Days worked are recorded... Pay is
calculated as days worked multiplied by the daily rate" — the two
sentences ticket 17 deliberately left out of staff CRUD.

## Context

- proposal.md §11 in full is this ticket's spec — three sentences, no
  more implied behavior than what's written.
- **Days-worked source (confirmed with Edwinfred):** manually recorded
  by the owner, not inferred from other activity (e.g. not "did they
  record a sale that day"). A slow day with no recorded sales is not
  necessarily a day off, and inferring presence from unrelated activity
  was never the record's intended meaning — the owner marks days worked
  directly, the same way she'd track it in a notebook or spreadsheet
  today.
- Relevant module: `src/modules/people/` — `staff-tab.tsx`,
  `staff-destination.tsx` (ticket 17's existing People destination
  shell). This ticket adds a new tab, not a new destination.
- `prisma/schema.prisma`'s `StaffMember.dailyRateMinor` — pay reads this
  directly; no new rate field needed.
- Owner-only, matching every other staff-management action (proposal.md's
  role list restricts staff/pay administration to the owner).

## Scope

**In:**
- A `DaysWorked` record: staff member, date, recorded-by. One entry per
  staff member per date (recording the same date twice edits in place —
  a correction, not a duplicate, matching the project's general
  same-day-correction pattern for fast-entry mistakes).
- `recordDaysWorked` / `listDaysWorkedForStaff` / a pay calculation
  reading `count(DaysWorked in period) × dailyRateMinor` for a given
  staff member and period (at minimum, current month — confirm the
  simplest useful period with Edwinfred if proposal.md's silence on
  period leaves genuine ambiguity once building starts).
- New "Days worked" tab on the People destination's Staff area (or a
  per-staff-member view reached from the existing staff list) — a
  calendar-style or date-list picker to mark days worked, plus a
  read-only pay figure for the current period.
- Owner-only for recording; pay figure readable by the owner only, same
  gate as the rest of `people`.

**Out:**
- Any pay disbursement/"paid" tracking — proposal.md §11 only asks for
  calculation, not a payment workflow. Confirm this reading before
  building anything beyond the figure itself.
- Tax, deductions, advances — explicitly excluded by `docs/scope.md`'s
  "Payroll beyond days worked" v1 exclusion.
- Historical pay-by-arbitrary-period reporting — Stage 8 concern if
  wanted beyond the current period.

## Acceptance criteria

- [x] A day worked can be recorded for a staff member on a specific
      date, owner-only.
- [x] Recording the same staff member/date twice edits in place rather
      than creating a duplicate.
- [x] Pay for a staff member over a period equals days worked in that
      period × their `dailyRateMinor`, exactly.
- [x] A deactivated staff member's historical days-worked/pay remains
      readable (matches the project's deactivate-never-delete rule).
- [x] Only the owner can record days worked or view the pay figure.
- [x] **Screen:** a new tab/view on the People destination for marking
      days worked and reading the computed pay, reached from the
      existing staff list.
- [x] Loading, empty (no days recorded yet), and error states via
      `components/patterns/states.tsx`.
- [x] Storybook story covering: empty state, days marked, computed pay
      figure.
- [x] (Added mid-build) Pay can be marked as paid, owner-only, and the
      figure reflects what's still unpaid — see Scope note above.

## Verification

- Integration tests, test-first: recording a day, same-day-same-person
  edit-in-place, pay calculation against a constructed set of recorded
  days, owner-only gate, deactivated staff still readable.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
- Add the new story to `docs/screens.md`'s People section.
