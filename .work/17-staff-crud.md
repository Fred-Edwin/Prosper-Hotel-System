# 17 — Staff: add, edit, deactivate

**Type:** logic (test-first)
**Blocked by:** None (`StaffMember` already exists in schema, from the
tracer slice — only create/update/deactivate logic is missing)

## What this delivers

The People admin destination (currently `NotBuilt`) gets its first real
tab. proposal.md §11: "Staff are added by the owner, with a daily rate
set for each... Staff who leave are deactivated rather than removed, so
that transactions they recorded remain attributed to them" — the same
deactivate-never-delete rule `catalogue`'s Product/Ingredient already
follow.

This ticket is staff CRUD only — days worked and pay calculation
(proposal.md §11's other two sentences) are a distinct piece of logic
(a calculation over a new "days worked" record) and are deliberately left
for a follow-on ticket rather than bundled in, so this one stays a clean,
small plumbing slice.

Owner-only, per proposal.md's role list ("adding and deactivating staff,
and setting daily rates" is explicitly owner-restricted).

## Lifecycle

- **Create:** a staff member is added with name, phone, role, location,
  a 4-digit PIN (ADR 0007 — login is name + PIN, not phone), and a daily
  rate. Name/phone/PIN validation follows whatever the existing
  `people/logic.ts` login path already assumes about PIN shape.
- **Read:** list all staff (active and inactive, distinguished), filter
  by location. Detail view shows role, location, daily rate, active
  status.
- **Update:** name, phone, role, location, daily rate, and PIN are all
  editable in place by the owner — non-financial, in-place edits, no
  reversal needed (matches architecture.md's "non-financial typos... are
  edited in place" rule, extended here to cover a staff record's own
  fields, none of which are financial history).
- **Delete:** not allowed — deactivate only, exactly Product/Ingredient's
  existing pattern. A deactivated staff member's past sales, movements,
  and handovers remain attributed to them.
- **Undo:** deactivation can be reversed by reactivating (mirrors
  `reactivateProduct`/`reactivateIngredient`'s existing pattern in
  `catalogue`).

## Acceptance criteria

- [ ] The owner can add a staff member: name, phone, role, location,
      PIN, daily rate.
- [ ] Staff can be listed (active and inactive shown distinctly) and
      filtered by location.
- [ ] Name, phone, role, location, daily rate, and PIN can be edited in
      place.
- [ ] A staff member can be deactivated and reactivated; deactivation
      never deletes the record.
- [ ] A deactivated staff member cannot log in, but their historical
      sales/movements/handovers remain fully attributed and readable.
- [ ] Only the owner can create, edit, deactivate, or reactivate a staff
      member; other roles are denied at the route.
- [ ] **Screen:** the People admin destination becomes real — a Staff
      tab (matching Catalogue's tabbed-destination pattern) with a list,
      create form, and edit/deactivate/reactivate actions.
- [ ] Loading, empty, and error states follow
      `components/patterns/states.tsx`.
- [ ] Storybook stories cover the tab's states.

## Out of scope

- Days worked recording and pay calculation — a follow-on ticket.
- Customers tab (already has its own record from ticket 06; a People
  destination ticket surfacing it as a tab is separate, smaller work not
  bundled here).
- Any change to the login flow itself.
