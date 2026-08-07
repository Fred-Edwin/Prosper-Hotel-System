# 03 — Catalogue: the tabbed destination

**Type:** plumbing (test-after)
**Blocked by:** 01, 02 (every tab needs its underlying CRUD and logic built first)

## What this delivers

The single Catalogue nav destination design.md specifies: "Products,
ingredients, recipes, assets — reference data behind one link, tabbed."
This ticket builds the destination itself — the shell, the tabs, and every
screen wired to the backend already built in tickets 01–02 — in one
focused pass, rather than each ticket bolting on its own separate screen.
Held back deliberately so the catalogue UI gets full, undivided design
attention in a single session.

Assets (the fourth tab design.md lists) are not built here — they belong
to `cash`'s expense categories (architecture.md, stage 6 of the roadmap),
not `catalogue`. This ticket includes only the Products, Ingredients, and
Recipes tabs; a fourth Assets tab is added when `cash` reaches that stage,
not invented early against a module that doesn't own the concept.

The destination is owner-only — matches every write in tickets 01–02 being
owner-gated, and catalogue data (ingredient cost, recipe cost) is not
shown to staff roles.

## Acceptance criteria

- [ ] Owner sees a single "Catalogue" link in the admin shell's nav.
- [ ] The destination has three tabs: Products, Ingredients, Recipes.
- [ ] The Products tab lists all products (ticket 01) with a way to
      create/edit/deactivate/reactivate and to set price inline on the
      product form, matching design.md's "setting a price is a field on
      the product form... not a screen."
- [ ] The Ingredients tab lists all ingredients (ticket 01) with
      create/edit/deactivate/reactivate.
- [ ] The Recipes tab shows every cooked-food product with its recipe
      status — current version's cost if a recipe exists, "—" if it does
      not (design.md: absences are listed, not summarised) — and lets the
      owner create a recipe or a new version of an existing one (ticket
      02).
- [ ] A non-owner role is denied access to the Catalogue destination
      entirely (route-level, not just hidden nav).
- [ ] Each tab has loading, empty, and error states from
      `components/patterns/states.tsx`.
- [ ] Each new UI component has a Storybook story covering its states.

## Out of scope

- Assets tab (belongs to `cash`, a later stage).
- Any staff-shell view of catalogue data.
- Anything beyond wiring the UI to already-built backend — no new business
  logic is introduced in this ticket.
