# 56 — Stock-correction dialog uses the combined location scope

**Type:** plumbing (test-after)
**Blocked by:** 53 (needs the sellable-at-location product function)
**Status:** planned

## Goal

The stock-correction dialog, at a given location, offers exactly the
same product set New Sale does — that location's own products plus
confirmed transferred-in stock — so a miscount of transferred-in stock
can be corrected without reversing the whole transfer.

## Context

- Relevant module: `src/modules/reporting/ui/record-correction-dialog.tsx`.
- `docs/architecture.md`'s "Product home location" note and
  `docs/scope.md`'s 2026-08-13 entry — both state this dialog uses the
  same combined scoping as sales, decided explicitly with Edwinfred
  rather than left as a narrower "own products only" rule.
- The dialog already has its own location picker (`locations` state,
  `locationId` state) but currently shows an unfiltered product list —
  this ticket wires the existing location selection into ticket 53's
  new combined-set function instead of the current unfiltered fetch.
- Correction itself (who may correct, that it's a separate deliberate
  act from non-sales consumption) is unchanged — `docs/architecture.md`'s
  existing "A physical count never silently overwrites the record"
  section governs that and is untouched by this ticket.

## Scope

**In:**
- The dialog's product list, once a location is selected, calls ticket
  53's combined sellable-at-location function instead of the unfiltered
  active-products fetch.
- Transferred-in items are visually distinguished in this dialog the
  same way as in New Sale (reuse, don't reinvent, ticket 53's badge/
  grouping treatment).

**Out:**
- Any change to who may correct (owner-only, unchanged), or to the
  correction mechanism itself (effective-dated, reason-attributed) —
  this ticket only changes which products are selectable, not what
  correcting one does.
- Ingredient corrections — if the dialog also corrects ingredients,
  leave that path on its current unfiltered behavior; ingredients are
  out of scope for this feature per ticket 53's Out section.

## Acceptance criteria

- [ ] Selecting a location in the correction dialog shows only that
      location's own products plus products currently held there via a
      confirmed transfer — matching New Sale's set exactly for the same
      location.
- [ ] A transferred-in product is visually marked as such, consistent
      with New Sale's treatment.
- [ ] Correcting a transferred-in product's count works exactly as
      correcting any other product (same form fields, same validation,
      same attribution) — only the selectable set changed.
- [ ] Storybook: `record-correction-dialog.tsx`'s story gains a state
      showing a mix of own and transferred-in product options.

## Verification

- Manual integration check (this is plumbing/composition, not new
  logic — ticket 53's own tests already cover the underlying query
  correctness): confirm the dialog's product list matches New Sale's
  for the same location and role.
- `pnpm lint`, `pnpm exec tsc --noEmit`.
- Manual check against `references/ui-rules.md`.
