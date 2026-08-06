# Walkthrough — A Restaurant Project

A concrete run through the whole workflow, showing exactly what to type and what happens.

**The client:** Maria owns a 40-seat restaurant. She wants software to manage her menu, take reservations, and see how the business is doing. Right now she uses a paper diary for bookings and a spreadsheet for costing dishes.

---

## Day 1 — Before the meeting

**You type:**

```
/discovery prep — meeting Maria tomorrow, she owns a small restaurant,
40 seats, currently uses a paper diary for bookings and a spreadsheet
for menu costing
```

**What happens:** you get a grouped question list — how the day actually runs, who does what, where bookings go wrong, what happens when someone doesn't show up, what she'd want to see at the end of a week. It flags the highest-value ones so a short meeting covers the right ground.

Nothing is written to the repo. You take the list to the meeting.

---

## Day 1 — After the meeting

Do this **immediately**, while you still remember what she said.

**You type:**

```
/discovery debrief
```

**What happens:** it interviews you. *"What did she say twice?" "What surprised you?" "What words does she use for things?" "What couldn't she answer?"*

You mention she kept saying "covers" for the number of diners and "service" for a lunch or dinner sitting. You mention she couldn't say whether staff should see each other's shifts. You mention she has a whiteboard in the kitchen that's doing real work.

**Output:** `docs/discovery.md`, with a dated entry. Her vocabulary is captured raw — "covers", "service", "the pass" — and her unanswered questions become Planning's agenda.

---

## Day 2 — Planning

The big one. Set aside a proper block; this runs in one session.

**You type:**

```
/plan
```

**What happens:** it reads `docs/discovery.md` and interrogates you, one question at a time, always leading with a recommendation.

**Group A — sequential:**

> *"Maria says 'covers' for diners and 'service' for a sitting. I'd make both first-class terms — a Reservation is for N covers within a Service. Sound right?"*

You accept. It writes to `CONTEXT.md` immediately.

> *"She said 'menu item' and 'dish' interchangeably. I think they're the same thing and we should pick one — I'd use Dish, since 'menu item' sounds like a row in a list. Agree?"*

You agree. Written down.

Then the domain model — *can a Reservation exist without a Service? What happens to a Reservation when a Service is cancelled?* Then modules:

> *"I'd propose four modules: **menu** (dishes, costing), **reservations** (bookings, services, tables), **staff** (people, shifts), **reporting** (takings, covers over time). Each is something Maria would recognise as a distinct part of her business. Four to eight is typical. Does that split feel right?"*

You say reporting is really just views over the other three, not its own thing. It agrees, drops it to three modules.

Then seams, then stack, then scope — including the out-of-scope list: *no online ordering, no payment processing, no supplier management in v1.*

**Group B — batched, because they're independent:**

> *"Six platform questions, and these don't depend on each other so I'll batch them. My recommendations up front..."*

Identity: Maria plus a manager plus waiting staff, three roles. Data lifecycle: **soft delete with history** — she'll want to see a cancelled booking. Integrations: none in v1. Environments: Vercel plus a droplet, so one shared staging backend for previews. Observability: error tracking plus uptime. Non-functionals: 40 seats, nothing special.

**Output:** `CONTEXT.md`, `docs/architecture.md`, `docs/scope.md`, and one ADR recording why reservations own tables rather than tables being their own module.

---

## Day 3 — Design

**You type:**

```
/design
```

**What happens, step 0:** it reads the domain model and derives the screen list:

> *"From the three modules, here are the screens: Dish list, Dish detail/costing form, Reservations calendar, Reservation form, Today's service board, Staff list, Shift roster, Dashboard. Anything missing?"*

You add a "walk-in" quick-add screen.

Then it asks the device question:

> *"Discovery says Maria checks bookings from home on her phone and does menu costing on a laptop. Those are different jobs, not the same job at different sizes — I'd recommend **two shells**: a desktop shell for management work, and a mobile shell for the at-a-glance and quick-add tasks. Agree?"*

You agree.

**Step 1:** installs shadcn, sets starting theme tokens.

**Step 2:** picks screens to prototype on — the reservations calendar (densest), the dish costing form (longest form), and the mobile today-view.

**Step 3–5:** builds **three structurally different versions** of each, with realistic data in them. Not mockups — working screens. Gives you a URL:

```
http://localhost:3000/reservations?variant=A
Arrow keys or the bar at the bottom to switch.
```

**You look.** Variant A is a week grid, B is a day-by-day list, C is a timeline. You say:

> "B's list is right for how Maria thinks, but I want C's timeline strip at the top. And it's too airy — she needs to see a whole service without scrolling."

It records that in the design spec before building anything:

```
Locked
  List style   r1  Rows, not a grid. "Right for how Maria thinks"
  Density      r1  Dense. "She needs to see a whole service without scrolling"

Open
  Header       r1  Wants C's timeline strip on B's list

Not yet shown
  Empty state · Error state · 200-char name · Permission-denied
```

The spec lives in a temp file outside the repo. Those locked lines now constrain every later round — round three can't quietly go back to cards.

**Round 2:** it builds that. Denser, list with a timeline header.

> "Better. Move the cover count to the left so it's the first thing you read."

**Round 3:** done. You look and think *this is right*.

**Stop condition reached** — round 4 would just be fiddling.

Before locking, it checks the spec: *"Empty state and the 200-char name were never shown. Want a round covering those?"* You do — a service with no bookings is a real Tuesday.

---

### What if round 1 had been bad?

Suppose instead all three variants came back mediocre. You say so. It doesn't build three more — it stops and offers the ladder:

```
1. Add references     — you supply 2–4 examples, I work from those
2. Narrow the target  — vary just the reservation row, not the page
3. Reproduce wholesale— rebuild one reference's layout with real data
4. Buy a template     — a paid admin template supplies the shell
```

You pick 1:

```
/design references
```

You screenshot the densest screen of two booking tools you rate, and name Linear's issue list. It writes a **reference brief** first — what each does structurally, how tight the rows are, where the primary action sits, how much chrome — and ends with the sentence that matters: *"All three use a single-line row with the key number left-most and no card wrapper. The variants all wrapped rows in cards."*

Then it rebuilds the round against that brief **and** the locked decisions together, and hands over again.

**The brief is the point, not the screenshots.** Going straight from image to build gets you a bad tracing. Making it say *why* the reference works is what turns it into constraints.

**Lock:** it extracts the winning screen's spacing, type sizes, and colours into theme tokens; builds the desktop shell, the mobile shell, and the page templates; writes Storybook stories; writes `docs/design.md` (intent only — no values, those are in the theme file).

---

## Day 4 — Foundation

**You type:**

```
/foundation
```

**What happens:** it walks ten items in order, confirming at branch points.

Repo and tooling. Folders as `src/modules/menu/`, `reservations/`, `staff/` — **named after Maria's business, not technical layers**. A lint rule banning deep imports between them. Database with soft-delete built in from the start. Auth with three roles, working. Both shells wired to routing. Test harness with one integration test passing against a real test database. Storybook running. Seed data — three staff accounts one per role, 200 reservations across past and future, dishes with costs, plus a booking with a 200-character name and a service with zero covers. Deploy pipeline, rollback tested, error tracking live.

**Then the tracer slice:** log in as Maria, see this week's reservations from the real database. Tested. Deployed. Live.

**Then it writes `CLAUDE.md`** — under 150 lines, the rules every future session reads.

**Done when** that slice works in production and you can say how the second feature would go in.

---

## Day 5 — First tickets

**You type:**

```
/tickets
```

**What happens:** it reads the architecture and cuts **one tranche** — enough to reach the first thing worth showing Maria. Maybe six tickets.

It presents them and quizzes you:

```
1. Add a dish with name, price, and ingredient costs    [logic]
2. Edit and archive a dish                              [logic]
3. Dish list with search and margin column              [plumbing]
4. Take a reservation for a service                     [logic]
5. Reservation list for a service, with covers total    [plumbing]
6. Cancel a reservation, with undo                      [logic]

Does the granularity feel right? Are the blocking edges correct?
```

Notice **ticket 6 exists** — cancel and undo. That's the lifecycle check working. Under your old workflow, nobody would have asked, and Maria would have discovered in month two that a mis-typed booking couldn't be removed.

You approve. It writes `.work/01-*.md` through `06-*.md`.

---

## Day 5 onward — Build

**One ticket per session. Start a fresh session each time.**

**You type:**

```
/build .work/01-add-dish.md
```

**What happens:** it reads the ticket, `CLAUDE.md`, `CONTEXT.md`, and the menu module. Then it stops:

> **Checkpoint**
>
> `menu/index.ts` would export: `createDish`, `getDish`, `listDishes`, and the `Dish` type. Costing logic stays internal.
>
> Tests at the menu module interface — the seam listed in architecture.md.
>
> One concern: the ticket says "ingredient costs" but doesn't say whether an ingredient can be shared across dishes. I've assumed not, for now.

**You reply:** "Interface is right. Ingredients aren't shared yet — leave it."

That's your one minute. **This is the highest-value minute in the whole loop** — correcting an interface now is free; correcting it after implementation is a rewrite.

Then it builds. Logic ticket, so test-first: one failing test for margin calculation, watch it fail, implement, watch it pass, next behaviour.

Then it hands you the manual check:

```
Ready at http://localhost:3000/menu
Login: maria@bistro.test / test1234

1. Click "New dish" → form opens
2. Add "Ribeye", price 28.00, ingredient cost 11.50
3. Save → appears in list, margin column shows 59%
4. Submit with no name → inline error, your input is preserved
```

And recommends: *"UI ticket — run `/review`, `/verify`, `/critique`."*

**You type:**

```
/review main
```

Two reports side by side. Standards flags nothing. Ticket flags that the acceptance criteria mentioned archiving and it wasn't built — you check, that's actually ticket 2, so you dismiss it.

```
/verify
```

It drives the browser, screenshots each step, checks the empty state and the long-name case. All pass. Hands you two things to eyeball.

```
/critique
```

```
1. Margin column not right-aligned and missing tabular-nums
   → modules/menu/ui/dish-table.tsx

2. No empty state on the dish list — page collapses at zero dishes
   → modules/menu/ui/dish-table.tsx
```

You approve both fixes. It commits.

**Then ticket 02, in a fresh session.** Repeat.

---

## Week 3 — Between tranches

Six tickets done. Something is working and demoable.

**You type:**

```
/care
```

**What happens:** it walks git history for hot spots, scans for friction, and writes a ranked report to a temp file:

```
1. [Strong] Reservation and Service logic are tangled
   Reservations module reaches into service internals in 4 places.
   Deleting the boundary would concentrate the covers-counting logic
   in one place instead of three.

2. [Worth exploring] Dish costing has no seam
   ...
```

It stops and asks which to explore. You pick 1. It grills you through the shape, checks tests exist first, and hands to `/tickets`.

It also runs the hygiene pass — prunes two stale gotchas, removes an unused dependency, notes `CLAUDE.md` still matches reality.

**Then:**

```
/tickets
```

Next tranche, informed by what the first six taught you.

---

## Month 2 — A bug

Maria calls: "Sometimes the covers total is wrong on a Saturday."

**You type:**

```
/fix covers total sometimes wrong on Saturday services
```

**What happens:** it refuses to theorise. First it builds a failing command — an integration test that seeds a Saturday service with the exact booking pattern and asserts the total. It runs it. Red.

Then it minimises: turns out it only fails when a reservation spans two services.

Then it gives you five ranked hypotheses with predictions. You look and say "we changed the service boundary logic three weeks ago" — which re-ranks instantly.

It instruments, finds it, writes a regression test at the reservations module seam, fixes it, watches it pass, re-runs the original loop, removes its tagged debug logs, and states the correct hypothesis in the commit message.

Post-mortem: *"What would have prevented this? The service boundary is implicit — nothing enforces that a reservation belongs to exactly one service. That's a Care candidate."*

---

## Year 2 — A new feature

Maria wants online ordering.

That needs a new domain concept (Order) and a new module. So:

```
/plan scoped — adding online ordering. New module, new concepts.
```

Then `/tickets`, then `/build`. **Same loop as day one.** There's no "post-launch" mode — a feature in year two goes through the same path as a feature in week three.

If instead she'd asked for "show the margin on the dish list too" — that fits existing vocabulary and boundaries, so it skips Planning and goes straight into the next tranche of tickets.

---

## The cheat sheet

| Situation | Type this |
|---|---|
| Meeting a client tomorrow | `/discovery prep — <context>` |
| Just left a client meeting | `/discovery debrief` |
| Ready to make architectural decisions | `/plan` |
| Big new feature needing new concepts | `/plan scoped — <what>` |
| Need to sharpen or add a domain term | `/plan vocabulary — <the term>` |
| Ready to settle the visual language | `/design` |
| The variants didn't impress you | `/design references` |
| Decisions made, ready to build the skeleton | `/foundation` |
| Need the next batch of work | `/tickets` |
| Building one ticket | `/build .work/NN-name.md` |
| Check the code | `/review main` |
| Check it works in a browser | `/verify` |
| Check the UI follows the rules | `/critique` |
| Something's broken, cause unknown | `/fix <symptom>` |
| Between tranches | `/care` |

## The rhythm, in one line

**Plan once → design once → foundation once → then forever: cut a few tickets, build them one per session, care between tranches.**

## Three rules to remember

1. **Fresh session per ticket.** Always. Never build two tickets in one session
2. **The `/build` checkpoint is not optional.** It's one minute and it's where architecture quality actually comes from
3. **When a skill stops and asks, that's the system working** — not friction. It's stopping because it's about to invent something you should decide
