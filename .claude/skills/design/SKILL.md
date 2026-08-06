---
name: design
description: Settle the visual language — run refinement rounds of structurally different variants on real screens until converged, then lock the winner into theme tokens, an app shell, page templates, and Storybook stories. Run once per project. `/design references` reruns a round against real-world examples when the variants disappoint.
disable-model-invocation: true
---

# Design

Settle the visual language **once**, so no agent ever invents it during Build.

Read `<skills>/reference/UI-RULES.md` for the checkable rules. `design-knowledge.md` (outside the project) is the deeper reference.

**Resolving `<skills>/`.** It is the directory holding the skill folders — `~/.claude/skills/` for a global install, or `<project>/.claude/skills/` for a per-project one. **It is not inside this skill's own folder, and it is not in the project root.** Check the global path first, then the project-local one.

**If a reference file cannot be found, stop and tell the user.** Do not proceed from memory — these files hold the discipline the skill depends on, and running without them silently produces work that looks right and isn't.

## The premise

AI slop is not an aesthetics failure. It's a **vacuum failure** — an agent building a screen with no constraints fills the gap with its defaults, and those defaults are the slop.

**The fix is to leave no gap.** Four layers:

1. **Primitives** — from shadcn, so nothing generic is invented at that level
2. **Templates** — so page layout is never invented
3. **Tokens** — so arbitrary values are impossible by construction, not by discipline
4. **The stop rule** — when a ticket needs a pattern that doesn't exist, the agent stops and asks

Without the fourth, the system erodes one ticket at a time.

## Depth

- **Full** — new visual identity. Setup, refinement rounds, lock
- **Short** — reusing an established house system. Verify it fits this client, adjust the theme, skip the refinement rounds

Ask which, unless it's obvious.

## Modes

| Invocation | Does |
|---|---|
| `/design` | The full run — setup, refinement rounds, lock |
| `/design references` | Rerun the current round against real-world examples. See [Working from references](#working-from-references) |

**`/design references` is user-invoked only.** Never enter it unprompted, and never suggest it *instead of* building — the default is always that the model does its best work first and the user reacts to it. Offer it only after a round has been handed over and disappointed.

---

## Setup (first run only)

### 0. Derive the navigation, and ask who uses what

**Read `CONTEXT.md` and `docs/architecture.md`.** Derive what the app must show from the domain model and modules — a module with a record type implies a list, a detail view, and a form.

**That derivation is working material, not the deliverable. Never present it.** It is a completeness check, and on a real domain it produces thirty to fifty views. A list that long is unreviewable: the user cannot picture using it, and the only reaction available is alarm at the number.

**What you present is the navigation.** Convert before showing anything:

| | |
|---|---|
| **Destination** | A nav link. What the user picks from a menu |
| **View** | A tab, drill-down, sheet or section *inside* a destination |

Views are cheap; destinations are expensive. Thirty views across seven destinations is ordinary software. Thirty destinations is unusable, and the difference is entirely in how they're grouped.

**Group by person, never by module.** Modules are an architecture concept — they describe where code lives, and no user experiences them. A screen list grouped by module shows the system's structure; grouped by person it shows someone's working day, which is the only thing the user can actually judge. Where the same view serves several people, say so rather than duplicating it.

**Then apply merge pressure, before presenting.** The derivation only ever generates. Nothing else in this step pushes back, so push back deliberately:

- **A question answered at two zoom levels is one destination, not two.** *Am I making money* and *how much cash should I have* are one dashboard, not a profit page and a cash page
- **Explanation belongs in one place.** Every "why is this number what it is" view — histories, movements, audit — is tabs of a single ledger destination, not separate pages
- **A filter is not a destination.** "Low stock" is stock on hand with a `WHERE` clause
- **A field is not a destination.** Setting a price is a field on the product form, owner-gated
- **An action on a record is not a destination.** Taking a repayment happens on the customer, not on a Repayments page
- **Identical forms differing by one value are one form with a selector.** Wastage, staff meals and giveaways are one screen with a reason
- **CRUD triplets collapse.** List plus detail plus form is usually one destination with a sheet or a drill-down

**Then state what you refused to merge, and why.** Merging is not free, and some separations are load-bearing: two shells, two different people, or a deliberate control. Naming those tells the user you weren't merging on autopilot, and gives them the specific thing to overrule.

**Target roughly 5–8 destinations per person.** Over eight, merge harder. Under four, check nothing important is buried.

**Present:** the destinations per person, what's inside each, one line on what each does, and the merges you made. Let the user correct it. This is the menu the refinement rounds pick from.

**Then ask who uses this, on what device.** Lead with a recommendation based on what `docs/discovery.md` says about the users.

> "Who uses this on what? A restaurant owner checking takings on their phone at home needs a different shell from a manager doing rosters on a laptop."

Three answers:

| Answer | Build | When it's right |
|---|---|---|
| **Desktop only** | One shell | Office-bound work; nobody uses a phone for this |
| **Responsive** | One shell that adapts | The default. Same tasks, different screen sizes |
| **Two shells** | A desktop shell and a mobile shell | **When mobile users do genuinely different things** — not the same things smaller |

The test for two shells: *is the mobile user doing a subset of the same job, or a different job?* A waiter taking orders on a phone is not doing a small version of the manager's dashboard — that's two shells. A manager checking the same reports on a laptop and a tablet is one responsive shell.

If two shells, each gets its own page templates, and the refinement rounds run on **one screen from each**.

### 1. Install and theme

1. Install and initialise **shadcn/ui**. Not a from-scratch build — it copies component source into the repo, so components are ordinary editable files, and it inherits Radix's accessibility, which agents get badly wrong when writing their own
2. **Set initial theme tokens before adding many components** — neutral ramp, one accent, three semantic colours, spacing scale, radius scale, motion durations. These are a starting point; the refinement rounds will change them
3. Confirm with the user which primitives this app actually needs

---

## Refinement rounds

**This is the loop.** One round is not enough — a single prototype tells you what you don't like, not what you want.

### The design spec

**Open this before round one and update it after every round.** It is what makes rounds cumulative instead of repetitive.

Write it to the OS temp directory — `$TMPDIR` or `/tmp` — as `design-spec-<project>-<timestamp>.md`. Tell the user the path when you create it.

**Never write it into the repo.** It describes the current state of an in-flight phase, which is exactly what goes stale. The durable parts land in `docs/design.md` at lock.

Three blocks:

```markdown
## Locked
| Decision | Round | Choice — in the user's words |
|---|---|---|
| Density | 1 | Dense rows. "She needs to see a whole service without scrolling" |
| List style | 1 | Rows, not cards |
| Primary action | 2 | Top-right, one per page |

## Open
| Question | Round raised | State |
|---|---|---|
| Header weight | 1 | B's too heavy, C's too thin. Retry next round |

## Not yet shown
- Empty state — first use
- Empty state — no filter results
- Error state
- Long-text overflow (200-char name)
- Permission-denied view
```

**Locked** entries are **constraints on every later round**, not suggestions. A variant that re-litigates a locked decision is a bug — the user already spent judgment on it. If you believe a locked decision is now wrong, say so explicitly and ask; never quietly vary it.

**Record the user's own words.** *"She needs to see a whole service without scrolling"* carries the reason; *"density: high"* doesn't. The reason is what tells a later round whether an exception is allowed.

**Not yet shown** is seeded from the required states in `<skills>/reference/UI-RULES.md` and from the stress cases in step 2. It's the coverage tracker — it tells you what a later round should cover, and at lock it tells you what you never actually looked at.

### 2. Pick the screens to prototype on

From the navigation derived in step 0. Default **2–3**, with **real content** — seed data or realistic placeholder, never lorem ipsum.

**Prototype a destination with its views, not a view alone.** A dashboard is its hero figures *and* the tables under them; a ledger is the tab bar *and* a populated tab. Where the merges in step 0 put several things on one page, the round has to test whether that page holds together — which is precisely what a single view in isolation cannot show.

The user can name specific screens or ask for more at any point.

Weight toward what stresses the design hardest:
- The densest data view
- The longest form
- A screen with an empty state
- **The destination that absorbed the most in step 0** — the biggest merge is the biggest risk

A design that survives those survives the app. If two shells were chosen, prototype at least one screen in each.

### 3. Build three structurally different variants

**Different layout, different information hierarchy, different primary action.** Not three colour schemes.

If two drafts come out similar, redo one with an explicit constraint — *"do not use a card grid"*. Three near-identical options is a false choice; the user picks one and is still not confident, which is exactly the failure this loop exists to prevent.

Hold each variant to the page's real data, and to the project's styling system.

### 4. Wire the switcher

- One route, gated by `?variant=A|B|C`
- All existing data fetching stays above the switcher; only the rendered subtree changes
- A floating bar at bottom-centre: previous / current variant name / next
- Arrow keys cycle, but not when an input or textarea is focused
- Visually distinct from the design being judged, so it's obviously not part of it
- **Hidden in production builds**

Prefer mounting variants **inside a real existing page** over creating a standalone route. A throwaway route is a vacuum — every variant looks fine in isolation.

### 5. Hand over

Give the user the URL and the variant keys. They'll flip through.

**End every handover with the fallback line:**

> If none of these are close, run `/design references` and I'll work from real examples instead.

A fallback the user has to remember isn't a fallback. This is the only place it's mentioned — never decide to enter that mode yourself.

### 6. Take the reaction, update the spec, run another round

Expect *"the header from B with the layout from C."* **That's not indecision — that's the real design emerging**, and it needs a round two to exist.

**First, update the design spec:**

- Move anything the user settled into **Locked**, in their words
- Move anything they reacted to but didn't settle into **Open**
- Strike anything from **Not yet shown** that this round actually showed

**Then build**, honouring every locked decision. The new round is the combination they asked for, plus one or two directions it suggests — and it should cover something from **Not yet shown** where the screen allows it.

Show the user the updated Locked block with the round. Two lines, and it's how they catch a decision recorded wrong before it constrains three more rounds.

### 7. Repeat until a round produces no improvement

**The stop condition, plainly: stop when a new round doesn't make it better.**

A typical shape:

- **Round 1** — three different layouts. *"B's header, C's table, but it's too cramped"*
- **Round 2** — that combination, looser. *"Better. Try the actions on the right"*
- **Round 3** — actions moved. *"Yes, that's it"*
- **Round 4** would just be fiddling

When the user looks at a round and thinks *"this isn't an improvement, it's just different,"* it's done. No metric — diminishing returns is the honest signal.

Before locking, check **Not yet shown**. If required states were never built, say which, and offer a round covering them. A design that converged without an empty state hasn't been stress-tested.

---

## When a round disappoints

**Converging on nothing good is not the same as converging.** If the user says a round didn't help — or three rounds pass with no convergence — stop building variants and say so plainly.

First, check whether the problem is visual at all. **If the same screen keeps failing to work in any layout, the screen is usually trying to do too much, or the domain model behind it is unclear.** No amount of layout variation fixes that. Say it, and ask whether to revisit the screen list from step 0.

If it is genuinely visual, **present the ladder and stop for the user's pick.** Do not climb it unprompted — each rung costs them something different, and which cost is acceptable is their call.

| Rung | What changes | Cost |
|---|---|---|
| **1. Add references** | Rerun this round against real-world examples. `/design references` | They go and find two to four examples |
| **2. Narrow the target** | Stop varying whole screens. Vary **one component** — the table row, the form field group, the page header | More rounds, smaller each |
| **3. Reproduce a layout wholesale** | Rebuild one reference's structure with real data, then adapt. Not "inspired by" — actually reproduce it | Feels crude. Works |
| **4. Buy a template** | A paid shadcn/Tailwind admin template supplies a designed shell and page templates | Money, and less of it is yours |

**Rung 2 is underrated.** It's far easier to say what's wrong with a table row than with a page, and a list page is mostly rows. When the user can't articulate what's off about a whole screen, shrinking the target usually unblocks them immediately.

**Rung 4 is not a defeat.** The workflow already starts from shadcn rather than from scratch; buying a template is that same decision one step further. For internal business software, a professionally designed shell is a legitimate purchase.

---

## Working from references

Entered by `/design references`, never automatically.

### 1. Ask for references

Ask for **two to four** products whose interface the user would be happy to be compared to. State the three ways to supply one, strongest first:

| How | Why it ranks here |
|---|---|
| **Paste screenshots** | Strongest. Read directly — no imagining required. Ask for the *densest* screen of each, not the marketing page |
| **Name products** | Good. Real products you can reason about — "Linear's issue list", "Stripe's dashboard" |
| **Describe structure** | Works, but asks the user for vocabulary they may still be building |

Screenshots of **direct competitors or the client's existing tools** are worth more than screenshots of beautiful consumer apps. The job is enterprise software.

### 2. Write the reference brief — before building anything

**This step is the actual mechanism.** Do not skip from screenshot to build; that produces a bad tracing.

For each reference, write what it is doing **structurally**:

- Information density — how much fits above the fold, how tight the rows are
- How hierarchy is signalled — weight, colour, size, whitespace, rules
- Where the primary action sits, and how many compete with it
- How much chrome — borders, cards, shadows, background shifts
- How it handles a long list, and what it does when there's nothing to show

Then, across all of them: **what do these have in common that the variants were missing?** That sentence is the point of the exercise.

**Append the brief to the design spec** so it constrains every later round, not just this one.

### 3. Rerun the round

Build against **the brief and the locked decisions together**. If they conflict, say so and ask — a reference that contradicts something the user already locked is a real question, not something to resolve silently.

Then hand over as normal and rejoin the loop at step 6.

---

## Lock

Once converged:

1. **Extract the winner into theme tokens.** Values live in the theme file — that's the source of truth
2. **Build the app shell** — the persistent frame: nav, header, content area, collapsible sidebar with persisted state
3. **Build the page templates.** The piece almost nobody builds and the highest-leverage thing here, because layout is where generic AI output is most visible:
   - **List page** — header, toolbar with search and filters, table, pagination footer
   - **Detail page** — breadcrumb, header with actions, key-facts strip, tabs or sections
   - **Form page** — single column, sections, sticky action bar for long forms
   - **Dashboard page** — stat row, chart grid, recent activity
   - **Settings page** — sub-navigation, independently saveable panels
   - **Empty / onboarding** and **error / permission-denied** states
4. **Write Storybook stories** for every component — default, hover, disabled, loading, error, empty
5. **Write `docs/design.md`**, distilled from the design spec
6. **Move losing variants to a throwaway branch** and delete the switcher from main
7. **Hand over the design spec** — see below

### `docs/design.md`

**Intent only.**

- The design philosophy in a paragraph
- When to use which component
- When to use which page template
- **The locked decisions, with the reason for each** — carried over from the design spec's Locked block. *"Dense rows, not cards — a whole service has to be visible without scrolling."* The reason is what lets a future ticket judge whether an exception is warranted
- The rule that new UI composes existing components and never invents a pattern
- Anything about this project's design that isn't visible in the code

**No token values. No component prop lists.** Those are in code, and a doc restating them will drift.

A locked decision stated here becomes checkable by `/critique`. That's the payoff for recording the reason rather than just the choice.

### Handing over the design spec

The spec has done its job once `docs/design.md` is written. It stays outside the repo.

Tell the user its path and that it's theirs to keep or bin — moving it into a personal design library is worth it, since the locked decisions accumulate into a house style across projects. **Never copy it into the repo.**

If anything is still in **Not yet shown**, list it explicitly in the handover. That's the honest record of what the design was never tested against.

---

## Never

- **Never build primitives from scratch.** Start from shadcn
- **Never present the raw derived view list.** It is a completeness check, not a deliverable. Convert it to navigation first — a forty-item list is unreviewable, and its length reads as a proposal to build forty pages
- **Never group screens by module when presenting to the user.** Modules describe where code lives. Group by person, because a working day is the only thing the user can judge
- **Never produce variants that differ only in colour or copy.** Real variants disagree about structure
- **Never judge a design on an empty page.** Real data, real density
- **Never write token values into `docs/design.md`**
- **Never leave losing variants or the switcher in main** — they rot fast and confuse the next reader, including the user in six months
- **Never wire a variant to a real mutation.** The question is what it should look like, not whether the backend works
- **Never write the design spec into the repo**
- **Never re-litigate a locked decision** in a later round without saying so and asking
- **Never enter `/design references` unprompted**, and never offer it before the user has seen a round. The default is that the model does its best work first

## Done when

A round produces no change the user cares about, the theme is set, the shell and templates are built, every component has stories, `docs/design.md` is written, and the design spec has been handed over.

Then tell the user to run **`/foundation`**.
