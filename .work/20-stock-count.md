# 20 — Stock count: expected vs counted, owner-corrected

**Type:** logic (test-first)
**Blocked by:** None (`expected` is derivable from the existing
`StockMovement`/`IngredientMovement` ledger alone — docs/formulas.md's
"Expected stock" formula reads only movements already recorded, at
whatever location is being counted; it does not require the canteen or
transfers to exist, since a restaurant-only count is meaningful on its
own)
**Status:** done

## What this delivers

The `count` staff-nav placeholder (currently `NotBuilt`) becomes real,
and closes out proposal.md §3's "Close of day": "Stock is counted by the
owner or the store manager. The system presents the expected quantity,
the counted quantity, and any difference between them."

docs/formulas.md is explicit about the shape:

```
difference = counted − expected
```

"The count never changes the record on its own — it records what was
counted and shows the gap. Only the owner may correct." So this ticket
has two roles in one flow: **recording** a count (owner or store
manager) and **correcting** the ledger from a recorded gap (owner only,
via the existing `corrected` reason already in `StockMovementReason`).

This is a **location-generic** mechanic — it counts whatever
products/ingredients are on hand at one location, restaurant included,
without needing canteen or transfers to exist. CONTEXT.md's "weekly
count is what tests canteen cash" describes one *future use* of this
same mechanic once canteen exists, not a prerequisite for building it
now.

## Lifecycle

New record type: a stock count entry (name TBD during the ticket —
CONTEXT.md doesn't currently define one; check before inventing a term,
per CLAUDE.md's naming rule). Correcting from a count writes a
`corrected`-reason movement (existing reason, untouched by tickets
15/18/19's new values).

- **Create:** a count is recorded per item (product or ingredient) at
  the recording staff member's location, capturing the counted quantity
  and the expected quantity at the moment of counting (so the comparison
  stays honest even if more movements are recorded afterward). Rejected
  if counted quantity is negative, or the item is inactive.
- **Read:** a list of the count's lines showing expected, counted, and
  difference per item. Flagged distinctly where they disagree, same
  visual language ticket 14 used for handover mismatches.
- **Update:** the count record itself is not edited — same
  append-only principle as every other ledger entry in this project.
- **Delete:** not allowed.
- **Undo/Correct:** the owner may correct the ledger from a counted
  line's difference, writing a `corrected` stock movement that brings
  `getCurrentStockAtLocation` in line with what was counted. A
  store-manager-recorded count can be viewed but only the owner can
  apply the correction (proposal.md's role table: "Correcting a stock
  count" is owner-restricted). Correcting an already-corrected line is
  rejected.

## Acceptance criteria

- [ ] A count can be recorded for one or more items (product or
      ingredient) at the recording staff member's location, capturing
      counted quantity and the expected quantity at that moment.
- [ ] `difference = counted − expected` is computed and stored or
      derivable per line.
- [ ] A count line for an inactive item is rejected.
- [ ] A count line with negative counted quantity is rejected.
- [ ] Both store manager and owner can record a count;
      `canAccessLocation()` gates it the same as receiving/issuing.
- [ ] A line whose difference is non-zero is visually flagged distinctly
      from an agreeing line, same pattern as ticket 14's handover
      mismatch.
- [ ] Only the owner can apply a correction from a counted line's
      difference; a store manager attempting to is denied at the route.
- [ ] Applying a correction writes a `corrected` stock movement, and
      `getCurrentStockAtLocation` reflects the counted quantity
      afterward.
- [ ] Correcting an already-corrected line is rejected.
- [ ] **Screen:** the `count` staff-nav placeholder becomes real — item
      picker → counted quantity per line → confirm, then a read view
      showing expected/counted/difference with the owner's correct
      action per disagreeing line.
- [ ] Confirmation, loading, and error states follow
      `components/patterns/states.tsx`.
- [ ] Storybook stories cover the count flow's states, including a
      disagreeing line and the owner's correction affordance.

## Out of scope

- Canteen's weekly count-derived sales (CONTEXT.md, Stage 4) — a
  specific *use* of this same count mechanic once canteen exists; this
  ticket only builds the generic count-and-correct flow.
- Post-close correction rules beyond same-day (no "closed day" state
  exists yet, same stopgap as tickets 10/13/16).
- A count-history list beyond the count just recorded.
