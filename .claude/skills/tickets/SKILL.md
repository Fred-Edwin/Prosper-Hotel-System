---
name: tickets
description: Cut one tranche of vertical-slice tickets from settled architecture, each with a lifecycle check and a test-first/test-after declaration. Writes one file per ticket under .work/. Run after /plan and between tranches.
disable-model-invocation: true
---

# Tickets

Cut **one tranche** of vertical tickets. Not the whole project — enough to reach the next demoable thing.

Read `<skills>/reference/TICKET-FORMAT.md` for the template and the rules. Read `<skills>/reference/MODULES.md` for boundary vocabulary.

**Resolving `<skills>/`.** It is the directory holding the skill folders — `~/.claude/skills/` for a global install, or `<project>/.claude/skills/` for a per-project one. **It is not inside this skill's own folder, and it is not in the project root.** Check the global path first, then the project-local one.

**If a reference file cannot be found, stop and tell the user.** Do not proceed from memory — these files hold the discipline the skill depends on, and running without them silently produces work that looks right and isn't.

## 1. Read the settled decisions

- `CONTEXT.md` — ticket titles and descriptions use this vocabulary
- `docs/architecture.md` — module boundaries and the confirmed seam list
- `docs/scope.md` — what's in and what's explicitly out
- `docs/adr/` — decisions in the area you're touching, which you don't re-litigate
- Existing `.work/` tickets — what's already cut

**This skill works within settled architecture. It never re-decides boundaries.**

## 2. Explore the codebase

Understand the current state. Look for **prefactoring opportunities** — groundwork that makes the real change easy. *"Make the change easy, then make the easy change."* Prefactoring goes in the first tickets of the tranche.

## 3. Decide the tranche boundary

Cut only enough to reach **the next demoable thing** — typically five to eight tickets.

A tranche is roughly "the next thing you could show someone." Not a fixed count.

Don't cut the whole project. Slicing thirty tickets in week two means writing twenty-five of them at the moment you know least.

## 4. Draft vertical slices

Each ticket:

- Cuts a narrow but **complete** path through every layer — schema, logic, API, UI, tests
- Leaves the system **working and demoable** on its own
- Fits comfortably in one fresh session — **target ~150k tokens; ~250k means cut too coarsely**
- Declares what blocks it
- Declares **logic** (test-first) or **plumbing** (test-after or none)

**Logic** means rules: pricing, permissions, state transitions, validation, edge cases.
**Plumbing** means CRUD, wiring, config, layout, styling.

Never cut horizontally. "Build the API layer" has no observable behaviour to test and nothing to demo.

## 5. Apply the lifecycle check

**For every ticket that creates or modifies a record type**, state explicitly what happens for:

- **Create**
- **Read** — list and detail
- **Update** — what's editable, by whom, in which states
- **Delete** — soft, hard, or not allowed; what happens to things referencing it
- **Undo / reverse** — for actions with consequences: can a sent invoice be voided, a payment reversed, an approval withdrawn

**"You cannot delete these" is a fine answer — but it must be decided, not silent.**

Silence here is what produces missing delete flows and no way to recover from a mistake. The agent builds exactly what was described, and descriptions default to the optimistic case.

The Group B data-lifecycle decision in `docs/architecture.md` sets the default (soft vs hard delete). The ticket says how it applies here.

## 6. Handle wide refactors as the exception

A **wide refactor** is one mechanical change whose blast radius spans the codebase — renaming a column, retyping a shared symbol. No vertical slice can land green.

Sequence it **expand–contract** instead:

1. **Expand** — add the new form beside the old. Nothing breaks
2. **Migrate** — call sites in batches sized by blast radius, each batch its own ticket blocked by the expand. CI stays green because the old form still exists
3. **Contract** — delete the old form, blocked by every migrate batch

## 7. Quiz the user

Present the tranche as a numbered list. For each: **title**, **blocked by**, **type** (logic/plumbing), **what it delivers**.

Then ask:
- Does the granularity feel right — too coarse, too fine?
- Are the blocking edges correct?
- Should any be merged or split?

Iterate until approved.

## 8. Write the files

One file per ticket: `.work/NN-<slug>.md`, numbered from `01` in **dependency order** — blockers first.

Never a single combined file. One file per ticket means an agent opens exactly its own job with no distraction from the other forty.

Use the template in `<skills>/reference/TICKET-FORMAT.md`.

## Never

- **Never cut horizontal slices**
- **Never write file paths or line numbers** into a ticket — a ticket may sit for weeks while the codebase moves. Describe behaviour and interfaces
- **Never cut the whole project up front**
- **Never re-decide architecture.** If a ticket can't be cut inside existing module boundaries, **stop and tell the user Planning is needed** for this work
- **Never invent vocabulary.** If a needed word isn't in `CONTEXT.md`, surface the gap

## Done when

The tranche is written to `.work/` and approved.

Tell the user to run **`/build`** on ticket `01`, in a fresh session.
