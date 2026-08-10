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

App Shell tickets must be `done` before any feature ticket is claimed —
the shell provides the routes and layout every feature ticket wires
into. If App Shell tickets are still open, claim from those first
regardless of what else is `planned`.

1. Scan `.work/*.md` for tickets with `Status: planned` whose declared
   dependencies are all `Status: done`.
2. Pick one. If running as part of a deliberately parallel/looped batch,
   prefer tickets on unrelated areas of the codebase over multiple
   tickets touching the same module, to reduce merge conflicts.
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

   **If the ticket builds a new screen or changes an existing one**, check
   for design precedent before planning the implementation: look in the
   `prosper-hotel-design-reference` worktree (find its path with
   `git worktree list` if it isn't checked out at the usual sibling path;
   if the worktree is gone, check out branch `design-reference-a977bea`
   fresh) for a matching Storybook story or component. If precedent
   exists, build to match it — layout, components used, states — rather
   than re-deriving the screen from `docs/conventions.md` alone.

   **If nothing matches, stop and ask** rather than inventing the
   composition silently — same rule as `CLAUDE.md`'s "if a needed pattern
   doesn't exist, STOP and ask." Set `Status: blocked`, write into the
   ticket file which screen has no precedent, and present the user with
   options rather than a bare "blocked" notice:
   - the closest existing pattern/screen this could reuse or adapt, if
     one exists, and
   - an offer to design 2-3 variants for this screen (in the style of
     the project's existing screens, per `docs/conventions.md` and
     `references/design-principles.md`) for the user to pick from.

   Default toward offering variants when the screen is non-trivial —
   that's usually what's wanted — but the user may instead approve
   building the closest existing pattern directly; don't assume either
   way, ask.

2. **Decide test-first or not, then state a plan and wait for approval.**
   Tickets don't reliably carry a `TDD: true/false` field — decide per
   task instead: logic, calculations, and permission checks get tests
   written first (see below); plumbing, wiring, and pure UI composition
   get tests after, per the Verification section. Then present a short
   plan — files/modules touched, approach, the test-first-or-not call and
   why, and (for UI tickets) whether design precedent was found — and wait
   for explicit approval before writing any code.

3. **Implement the vertical slice** described in the ticket's Scope. Follow
   `docs/conventions.md` — use existing patterns and the canonical
   reference module(s) from `/foundation` rather than inventing new
   approaches. If the ticket is responsible for wiring a feature's data
   into a screen slot on a different feature's shell (per the cross-feature
   note in `/tickets`), do that wiring as part of this same ticket, not a
   separate one.

   **If test-first:** for the logic portion of the ticket, write the
   tests implied by the Acceptance Criteria *first*, run them, and confirm
   they fail for the expected reason (not a typo or setup error — an
   actual absence of the behavior being specified). Only then implement,
   iterating until they pass. Do not write the implementation first and
   backfill tests afterward — that defeats the purpose of choosing
   test-first in the first place. Pure UI-composition portions of a mixed
   ticket don't need this discipline even when the logic portion is
   test-first — apply it to the logic, not the markup.

   **If test-after:** implement normally. Tests are still required by
   the Verification section below, just not written test-first.

4. **Stop and flag instead of guessing** whenever something in the ticket
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

5. **Self-verify** using the ticket's Verification section: run tests,
   lint, and typecheck — all must pass before moving on.

   **If the ticket touches UI**, also check the rendered result against
   `references/ui-rules.md` item by item, visually, not just by reading
   the code. Default to whatever native browser capability the running
   agent already has (e.g. Codex's built-in browser) to load the changed
   screen(s)/Storybook stories and check states. If no native browser
   capability is available (e.g. running under Claude Code) or it's
   having issues, fall back to the Playwright MCP server; if that also
   isn't available or approved, fall back to a throwaway script driving
   Playwright's bundled `chromium` directly (see `docs/gotchas.md`'s
   Testing/Playwright section for both fallbacks' setup notes). If none
   of these are usable, stop and flag it to the user rather than skipping
   the visual check or reporting it as passed.

   This is mechanical verification; it is not a substitute for `/review`,
   which checks things a machine can't.

6. **Open a PR** against main, referencing the ticket file. Set the
   ticket's `Status: in-review`.

7. **Stop.** `/build`'s job for this ticket ends at the PR. Do not merge —
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
- No writing code before the plan (step 2 of Process) is approved.
