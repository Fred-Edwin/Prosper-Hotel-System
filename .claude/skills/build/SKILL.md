---
name: build
description: Claim one eligible ticket, implement it on its own branch, self-verify, and open a PR for /review. Use during the bootstrap build pass after /tickets, and repeatedly during steady state whenever tickets exist in planned status.
---

# Build

Closes out the bootstrap sequence once the App Shell and first feature's
tickets are all `done` — at that point the project is genuinely live, and
`/build` becomes the main steady-state workhorse: re-run every time
`/tickets` cuts a new feature's tickets, or `/fix`/`/add` hand off new
ones. There is no fixed "phase 6 of 6" — `/tickets` now runs per-feature,
just-in-time, so `/build` simply runs continuously alongside it for the
life of the project.

## Purpose

Take one ticket from `planned` to `in-review`: implement it, verify it
locally, and open a PR — without making scope or architecture decisions
that aren't already settled in `docs/conventions.md`, `docs/architecture.md`,
or the ticket itself.

## Claiming a ticket

App Shell tickets (`docs/tickets/app-shell/`) must be `done` before any
feature ticket is claimed — the shell provides the routes and layout
every feature ticket wires into. If App Shell tickets are still open,
claim from those first regardless of what else is `planned`.

1. Scan `docs/tickets/**/*.md` for tickets with `Status: planned` whose
   declared dependencies are all `Status: done`.
2. Pick one. If running as part of a deliberately parallel/looped batch,
   prefer tickets in different features (feature folders) over multiple
   tickets in the same feature, to reduce merge conflicts.
3. Set `Status: in-progress`, note the session/agent and timestamp, commit
   this status change immediately — this is the claim. If another agent
   later finds this ticket already `in-progress`, it moves on to a
   different eligible ticket rather than duplicating work.
4. Create a branch for this ticket (e.g. `ticket/<ticket-id>-<slug>`).

## Process

1. **Read the ticket in full**, plus everything its Context section points
   to: the relevant feature folder, `docs/conventions.md`, relevant
   sections of `docs/architecture.md`, relevant Storybook stories from
   `docs/screens.md`.

2. **Implement the vertical slice** described in the ticket's Scope. Follow
   `docs/conventions.md` — use existing patterns and the canonical
   reference module(s) from `/foundation` rather than inventing new
   approaches. If the ticket is responsible for wiring a feature's data
   into a screen slot on a different feature's shell (per the cross-feature
   note in `/tickets`), do that wiring as part of this same ticket, not a
   separate one.

   **If `TDD: true`:** for the logic portion of the ticket, write the
   tests implied by the Acceptance Criteria *first*, run them, and confirm
   they fail for the expected reason (not a typo or setup error — an
   actual absence of the behavior being specified). Only then implement,
   iterating until they pass. Do not write the implementation first and
   backfill tests afterward — that defeats the purpose of marking a ticket
   `TDD: true` in the first place. Pure UI-composition portions of a mixed
   ticket don't need this discipline even when the ticket overall is
   `TDD: true` — apply it to the logic, not the markup.

   **If `TDD: false`:** implement normally. Tests are still required by
   the Verification section below, just not written test-first.

3. **Stop and flag instead of guessing** whenever something in the ticket
   conflicts with `docs/conventions.md` or `docs/architecture.md`, or
   requires a scope decision the ticket doesn't already make. Do not
   silently resolve this by picking an approach. Set `Status: blocked`,
   write the specific conflict/question directly into the ticket file, and
   surface it — this is the same "ask, don't assume" principle used in
   every earlier phase, just triggered mid-implementation. Local
   implementation judgment calls (naming a variable, structuring a helper
   within the established pattern) are fine and don't need escalation —
   the bar is: does resolving this require a decision `/alignment` or
   `/design` should have made.

4. **Self-verify** using the ticket's Verification section: run tests,
   lint, typecheck, and — if the ticket touches UI — check the result
   against `references/ui-rules.md` directly. All of this must pass before
   moving on. This is mechanical verification; it is not a substitute for
   `/review`, which checks things a machine can't.

5. **Open a PR** against main, referencing the ticket file. Set the
   ticket's `Status: in-review`.

6. **Stop.** `/build`'s job for this ticket ends at the PR. Do not merge —
   that happens after `/review` approves.

## On review feedback

If `/review` rejects the PR, `/build` resumes: read the review findings,
address them on the same branch, re-verify, and update the PR. Ticket
status returns to `in-progress` while addressing findings, then back to
`in-review` once pushed.

## Output

One PR per ticket, ticket status accurately reflecting where it is in the
pipeline (`in-progress` / `in-review` / `blocked` / `done`).

## Explicit non-goals

- No merging — `/review` gates that.
- No scope or architecture decisions — flag and stop instead.
- No working multiple tickets in one session/branch — one ticket, one
  branch, one PR, keeps blast radius and review scope contained.
