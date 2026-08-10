---
name: design
description: Finalize the design system (theme tokens, component base) and design every screen as a real, built, interactive prototype — organized by user role and destination — through a per-screen build/self-critique/review loop, landing each approved screen as a Storybook story. Use after /foundation, before /tickets.
---

# Design

Bootstrap phase 4 of 6. Run once, after `/foundation`, before `/tickets`.

## Purpose

Make every UI/UX decision up front, as real running code, so that `/build`
never has to invent layout, component composition, or visual design while
implementing a ticket. By the end of this phase, every screen the product
needs exists as an approved, working Storybook story built from real
components and realistic mock data — `/build` only assembles what's already
designed.

Screens are built as actual interactive prototypes (real components, real
navigation, real mock data), never static mockups. Enterprise design
quality is judged on usability and speed as much as appearance, and neither
of those can be evaluated from a static image.

## Inputs

- `docs/architecture.md`, `docs/scope.md`, `docs/conventions.md` from `/alignment`
- The scaffolded repo, component tooling (shadcn init'd), and Storybook setup from `/foundation`
- `references/ui-rules.md` and `references/design-principles.md` (this
  skill's reference material — read both in full before doing anything else)
- Any project-specific overrides in `docs/design.md`, if one already exists
  (project-specific rules there override `references/ui-rules.md`)

## Process

### 1. Finalize the theme

Tokens are a real design decision, not scaffolding — decide them here, not
in `/foundation`, so they reflect the actual design direction rather than a
placeholder guess. Using `references/design-principles.md` as the basis:

- Pick the neutral ramp (one Tailwind ramp, used exclusively), the accent
  colour, and the three semantic colours
- Pick the radius personality (sharp/medium/large) and derive the radius
  scale
- Confirm or set the type scale and font choice
- Set motion durations/easings (defaults from `references/design-principles.md`
  are almost always correct — only deviate with a specific reason)

Write these into the project's Tailwind v4 `@theme` block (the file
`/foundation` scaffolded for this). This file is the binding source of
truth for these values from this point forward — not a document. If
`docs/design.md` doesn't exist yet, create it as a short index: chosen
font, accent colour, radius personality, density default, and a pointer to
the theme file and to `references/ui-rules.md` / `references/design-principles.md`.
Do not duplicate token values into `docs/design.md` — point to the theme
file instead.

Confirm the finalized theme with Edwinfred before proceeding — this is a
cheap, high-leverage checkpoint since every screen from here on depends on it.

### 2. Build the screen inventory

Using `docs/scope.md` and `docs/architecture.md`, produce `docs/screens.md`:
every screen the v1 product needs, organized as:

```
## <Role/Persona> (e.g. Admin, Director, Accountant)
### <Destination> (a page may contain multiple distinct screens/states)
- **Screen:** <name>
  **Purpose:** <what it's for, what it depicts, concisely>
  **Status:** planned
```

This is a living checklist — status moves through `planned` → `in review`
→ `approved` as the per-screen loop below proceeds. It makes the phase
resumable: an agent picking this up in a later session reads exactly what's
left, without Edwinfred re-explaining anything.

Once the inventory is complete, ask Edwinfred where to start (which role,
or shells/app-frame first) and what cadence to use — build one screen at a
time, or a full role's screens before review. Do not assume; ask both, with
one-at-a-time as the recommended default.

### 3. Identify pattern types before building

Across the inventory, name the distinct screen *pattern types* present
(e.g. list view, detail view, form, dashboard, settings) per
`references/design-principles.md`'s page templates. Variant exploration
(step 4 below) only happens for the **first screen of each pattern type**.
Every subsequent screen of an already-established pattern type reuses the
chosen pattern directly — no new variants, just consistent application.
This keeps effort proportional and is itself what produces consistency
across the app.

### 4. Per-screen build loop

For each screen, in the order and cadence Edwinfred chose:

1. **Build it as a real prototype** — actual shadcn components, actual
   Storybook-viewable, actual mock/seed-shaped data (per `scope.md`'s
   definition-of-done for the relevant feature — see "Mock data" below).
   If this is the first screen of a new pattern type, build 2–3 real
   variants; otherwise build one, following the established pattern.
   Include the screen's required states in the same pass, not as a later
   add-on: empty (first-use and no-filter-results are different messages),
   loading (skeleton, not spinner), error, and permission-denied, per
   `references/ui-rules.md`'s "Required states" section.

2. **Self-critique before showing Edwinfred.** Check the built screen
   against `references/ui-rules.md` directly, item by item. Fix anything
   mechanically wrong (arbitrary values, contrast failures, missing
   states, alignment issues) before presenting — Edwinfred's review time
   should go to taste and judgment calls, not rule violations the agent
   should have caught itself.

3. **Present to Edwinfred.** For a first-of-pattern screen, present all
   variants together for comparison.

4. **On approval:** optionally note what Edwinfred liked about it. Record
   this in `docs/screens.md` against that screen's row, for Edwinfred's own
   future reference only — do **not** feed it back into this skill's own
   behavior as a rule to replicate elsewhere. Edwinfred is deliberately
   still exploring and does not want early approvals to narrow future
   variety. Mark the screen `approved` and land it as a Storybook story —
   this is now the canonical, in-repo version `/build` will read.

5. **On rejection:** ask what was wrong. Take Edwinfred's input, then
   produce new variants reflecting it — not a single blind retry. Return
   to step 2 for the new variants.

6. Move to the next screen per the chosen cadence, repeating until every
   screen in `docs/screens.md` is `approved`.

### Mock data

Every screen is designed fully against mock data shaped like the real
thing — never half-designed because a backing feature doesn't exist yet.
Use the seed data conventions from `/foundation` as the base; extend with
realistic edge-case data per `references/ui-rules.md`'s "Edge cases"
section (long text, many items, zero items, extreme numbers) so screens
are checked against reality, not just the happy path.

If a screen needs a data shape that isn't actually defined in
`docs/scope.md`'s definition-of-done, that is a sign `/alignment` left a
gap — stop and raise it with Edwinfred as a scope gap to resolve, rather
than guessing at a shape or leaving the screen unfinished.

## Output

- Finalized theme file (binding source of truth for design tokens)
- `docs/design.md` (short index: chosen values summary + pointers)
- `docs/screens.md` (full inventory, all screens `approved`)
- Every approved screen as a Storybook story in-repo, built from real
  components and covering its required states
- `docs/conventions.md` may need a pointer added to the Storybook
  location, if not already referenced from `/foundation`

Note: these Storybook stories are isolated design references, not the
running app. `/tickets` cuts a dedicated App Shell ticket (built first,
before any feature) that wires real navigation and routing in the actual
app around these designs — every destination becomes a real, clickable
route showing the relevant approved screen's designed state (including
its empty/pending state for destinations not yet implemented) rather than
a 404.

## Explicit non-goals

- No Figma or external mockup tooling in the default path — building real
  variants directly is cheap enough with shadcn's component coverage that
  a separate mockup step adds a translation cost without a clear payoff.
  Revisit only if fast, low-fidelity exploration before committing to real
  code becomes genuinely necessary on a specific project.
- No feature implementation beyond what's needed to render a screen
  against mock data — real logic and real data wiring is `/build`'s job.
- Don't let an approved screen's "liked" notes become an implicit rule the
  agent applies to unrelated future screens.
