---
name: build
description: Build one ticket in a fresh session — plan the module interface, checkpoint with the user, build test-first for logic, prepare the manual check, then review and commit. The core development loop.
disable-model-invocation: true
---

# Build

One ticket. One fresh session. One commit.

Read `<skills>/reference/MODULES.md` for interface vocabulary, `<skills>/reference/TESTING.md` for the test rules, and `<skills>/reference/TICKET-FORMAT.md` if the ticket looks malformed.

**Resolving `<skills>/`.** It is the directory holding the skill folders — `~/.claude/skills/` for a global install, or `<project>/.claude/skills/` for a per-project one. **It is not inside this skill's own folder, and it is not in the project root.** Check the global path first, then the project-local one.

**If a reference file cannot be found, stop and tell the user.** Do not proceed from memory — these files hold the discipline the skill depends on, and running without them silently produces work that looks right and isn't.

## 0. Ask: worktree or main checkout?

**Before reading anything else**, ask the user whether this ticket should
build in a new git worktree or directly in the current checkout. Default
suggestion: a worktree if other unblocked tickets exist in `.work/` that
could plausibly run at the same time (worth naming which ones); the
current checkout otherwise.

If the user says worktree:

1. Create it from the repo root: `git worktree add ../<repo-name>-ticket-<NN> -b ticket/<NN>-<slug>`
2. `cd` into it for the rest of this session — every later step (reading,
   building, testing, committing) happens there, not in the original
   checkout.
3. Run whatever setup the project needs in a fresh worktree before
   anything else works: `pnpm install` (separate `node_modules`), copy
   untracked files the app needs (`.env*`). Then work through every
   shared resource below — a worktree is a separate checkout, but it is
   **not** a separate machine: one Postgres instance and one set of TCP
   ports are shared by every worktree unless a session explicitly claims
   its own. Pick a per-ticket number (`NN`, the ticket number) and reuse
   it consistently for every port/name below, so collisions are
   predictable rather than discovered mid-session.

   - **Postgres schema, if this ticket touches it at all** (a new
     migration, a new model, a new field — check the ticket before
     assuming it doesn't): give this worktree its own local database,
     not the shared dev/test one. Two worktrees migrating one shared
     database collide — whichever runs `prisma migrate dev`/`reset`
     second either fails against the other's uncommitted migration
     history or silently resets it, destroying that session's
     in-progress data. This happened for real running tickets 13 and 15
     in parallel. Create `<db-name>_ticket<NN>` on the same Postgres
     instance, point this worktree's `DATABASE_URL` and
     `TEST_DATABASE_URL` at it, and migrate there, fully isolated. The
     vitest integration suite (`pnpm test`) reads the same
     `TEST_DATABASE_URL`, so it's automatically isolated too — no
     separate fix needed. Reconcile at merge time: whoever merges second
     regenerates their migration against `main`'s now-current schema.
     If the ticket touches no schema, the shared database is fine.
   - **Storybook**, if this ticket needs it (any new screen composition —
     see step 4a): the `pnpm storybook` script hardcodes `-p 6006`
     (`package.json`), and a second worktree binding 6006 fails. Don't
     run `pnpm storybook -- -p 63<NN>` — `--` appends your flag after the
     script's own `-p 6006` rather than replacing it, so the port pick
     doesn't take effect. Bypass the script instead: `pnpm exec
     storybook dev -p 63<NN>` (ticket 15 → `6315`), and hand the user
     that port's URL, not the bare default.
   - **`next dev`**, for the manual check (step 5): defaults to port
     `3000`, same collision as Storybook if another worktree already has
     a dev server running there — worse, a silently-successful bind to
     someone else's already-running server means you review the wrong
     ticket's code. Run `pnpm dev -- -p 30<NN>` (Next's CLI accepts `-p`
     natively as its own flag, so this one *does* pass through correctly,
     unlike Storybook's wrapped script) and use that port for every
     manual check and screenshot in step 5.
   - **Playwright e2e** (`pnpm test:e2e`), if this ticket needs it:
     `playwright.config.ts` reads `PLAYWRIGHT_PORT` (defaults to 3000)
     for both its `baseURL` and its own `build && start` server, so run
     it as `PLAYWRIGHT_PORT=30<NN> pnpm test:e2e` to keep it off whatever
     port `next dev` or another worktree's e2e run is using.

   Each worktree is a fully separate checkout — own `node_modules`, own
   files on disk, never symlinked — so there is no risk of one
   worktree's dev server or Storybook instance serving *another*
   ticket's component changes. Every conflict above is a port or
   database collision, never a code-isolation one.
4. Proceed through the rest of this skill normally, staying on that
   branch — never create a second branch or switch branches inside it.
5. **Stop at commit (step 7).** Commit in the worktree, then tell the
   user the branch and worktree path are ready to merge into `main` —
   merging, and removing the worktree afterward (`git worktree remove
   ../<repo-name>-ticket-<NN>`), is the user's call, not this session's.

If the user says main checkout: proceed as normal, no worktree.

**Never create a worktree without asking first** — this decision is the
user's, made once per ticket, not inferred from whether other tickets
happen to be unblocked.

## 0a. Ask, once: permission to run resource-intensive processes

Four kinds of process in this project are heavyweight and long-lived —
**Storybook, `next dev`, Vitest, Playwright** — as distinct from cheap,
short-lived ones (typecheck, lint, `pnpm install`) that need no gate.
Each one committed adds real, permanent memory/CPU pressure on the whole
machine for as long as it runs, and that pressure is shared across every
worktree — a worktree isolates files, never CPU or RAM. This has caused
real problems: running several of these across parallel worktrees at
once has driven the machine to full swap exhaustion.

**Ask once, before the first time this session needs to start any of the
four**, whether it's approved to run resource-intensive processes for
the rest of *this session*. Frame it plainly: which of the four this
ticket is likely to need, and that approval covers all of them for the
session's remaining duration — the user should not be asked again this
session unless they've since revoked it.

**The approval is session-scoped, not permanent and not global.** A
fresh `/build` session on a different ticket — including a sibling
session in another worktree — asks again; it does not inherit another
session's approval.

**Approval is not a license to leave things running.** Whatever this
session starts under that approval, it stops once no longer needed for
this ticket:

- A `next dev` or Storybook instance started for a manual check (step 5
  / step 4a) is killed once that check is done — not left running
  "in case," and not left running after the ticket is committed.
- A Vitest or Playwright run is not a long-lived process at all — it
  exits on its own — but if anything was left in watch mode, stop it
  before ending the session.
- Before ending the session (after step 7's commit), confirm nothing
  this session started is still running.

If the user declines resource-intensive processes for this session,
proceed without them where possible (e.g. rely on typecheck and the
existing test suite rather than a live `next dev` check) and tell the
user plainly which steps had to be skipped or degraded as a result —
don't silently start the process anyway.

## 1. Read

- The ticket file in `.work/`
- `CLAUDE.md` — conventions, prohibitions, pointers
- `CONTEXT.md` — vocabulary, before naming anything
- `docs/architecture.md` — the confirmed seam list
- The module being touched, including its `index.ts`

Read `docs/gotchas.md` **only if something looks strange** — it's a conditional reference, not a per-session read.

## 2. Plan the interface

**Before writing any code**, work out:

- **What this module will expose** through `index.ts`, and what stays internal
- **Which seam the tests sit at** — from `docs/architecture.md`. Never a new one
- **Anything the ticket appears to have got wrong** — too big, contradicts an ADR, needs a decision it doesn't contain

Aim for **few exports**. Four exports means four ways for other modules to become entangled. A lot of behaviour behind a small interface.

For UI work, identify which existing components and which page template this composes from. **If the ticket needs a screen shape Design never prototyped** — check `docs/design.md` and the Storybook stories under `components/patterns/` and `components/layout/` for precedent, **and separately, explicitly, run a search of the design-reference worktree** (a sibling checkout, typically `../<project>-design-reference` — find it with `git worktree list` if the name isn't obvious) for the destination or component name before concluding no precedent exists. This repo does not keep `components/design/` after Foundation — Design's raw output stays behind in that worktree, so "not in this repo" is not the same as "never designed." Only after that search comes up empty does "no precedent" hold, and only then does this checkpoint carry a visual review instead of an interface review — see below.

**State which of two paths you're taking, and why, before building either:**

- **One composition** — when the user already has a settled intuition and this is a course-correction on something close to known-good (e.g. "make the existing pattern feel right for this new data"). Cheaper, and right when three options would just be three ways of saying the same thing.
- **2–3 structurally different variants** — Design's own default for anything genuinely novel, and for the same reason Design mandates it: *"a single prototype tells you what you don't like, not what you want."* A single build risks anchoring the user to whatever was built first.

**Don't default silently to the cheap path.** Say which you're building and why — "this is a course-correction, going with one" or "no precedent exists for this shape, building three structurally different options" — and let the user override either way. This is the same discipline `<skills>/design/SKILL.md` step 3 already uses when choosing 1 vs 3; it does not lapse just because Foundation is over.

## 3. Checkpoint — the one involvement point

Present to the user:

1. The interface plan — what's exposed, what's internal
2. The seam the tests will sit at
3. Any concerns about the ticket
4. **For a new screen composition with no Design precedent:** the rendered result, not a description. Build the composition (one or several — see above) as Storybook stories first (see step 4a), **run the same pre-checklist scan Design runs before every handover** (`UI-RULES.md`'s cheapest checks: accent count, arbitrary values, table/row density, the primary action not disabled or off-screen) and fix anything it catches before the user ever sees it — don't spend their attention on something the rules already knew was wrong. Populate every story with **real seed data, never lorem ipsum or an empty form with nothing else on the page** — Design's own rule ("never judge a design on an empty page") applies here too.

   **Give the user the running Storybook URL and let them browse it themselves** (`pnpm storybook`, default `http://localhost:6006`) — every state, live and interactive, is strictly better than a static frame, and matches how Design itself hands over a round for reaction. **Fall back to a screenshot only when the user genuinely cannot reach a local URL** — a remote or fully headless session — and say explicitly that's why a screenshot is being used instead of the real thing, so it doesn't read as a shortcut.

   Get explicit visual approval — "looks right," a correction, or which variant — the same way Design got approval by showing built variants, not by describing them. **A screen already covered by Design's locked set skips this entirely** — it was already approved during Design.

**Wait for approval or correction.**

This is the highest-value minute in the loop. **Correcting an interface before implementation is nearly free; afterwards it's a rewrite — and the same is true of a screen's visual composition, not just its data interface.** A checklist (`UI-RULES.md`) can confirm a screen isn't broken; it cannot confirm it looks considered. Only a human comparing the rendered result can. Do not treat passing the checklist as equivalent to passing this checkpoint.

**Why this step exists at all.** Design's own "Done when" gate promises that `/build` should be able to make any destination Design didn't prototype "without inventing anything," from its templates alone. When that promise holds, this step is nearly instant — there's a template, precedent is obvious, the preview is a formality. When it doesn't hold (a screen shape genuinely has no precedent — this has already happened twice in this project), this step is the only thing standing between that gap and a screen nobody looked at before it shipped. Treat a frequent need for this step as a signal the template library is still incomplete, worth mentioning to the user, not just working around ticket by ticket.

Keep it short. The user approves in a sentence most of the time.

## 4. Build

### If the ticket is type **logic** — test-first, per behaviour

1. Write **one** failing test
2. Run it. **Watch it fail** — a test that passes immediately is testing nothing
3. Write the minimum implementation to pass it
4. Run it. Watch it pass
5. Next behaviour

**Never write all the tests up front.** Bulk tests verify *imagined* behaviour. One at a time lets each test learn from the last.

### If the ticket is type **plumbing** — build, then test if useful

CRUD, wiring, config, layout. Test after, or not at all where a test would add nothing.

### 4a. New screen compositions — Storybook first, always

**Every new screen or reusable UI composition gets a Storybook story, no exception, written before (for a new composition needing the checkpoint's visual approval) or immediately alongside the page that uses it.**

This is not optional polish — it's the mechanism that makes both this checkpoint's visual review and future consistency possible:

1. Build the composition as a component taking props/state, not a page tied to routing or a live fetch — same shape as `stock-list.tsx`'s `StockListView` split from `StockList`. A page component wired to `useRouter()` or a real `fetch()` can't be rendered in isolation; split the presentational half out so it can.
2. Write the story covering the states `docs/design.md`/`UI-RULES.md` require: default, loading, empty, error, and any permission-denied state that applies.
3. Start `pnpm storybook` and hand the user the URL to browse themselves — real, interactive, every state — per the checkpoint above. Only fall back to a screenshot if they genuinely can't reach a local URL.
4. The story stays in the repo afterward — it's the precedent the *next* ticket checks for before assuming a screen shape doesn't exist yet.

**Retrofitting stories after the fact is the failure this exists to prevent** — a screen built without one gets shipped on a plan-only checkpoint, which is exactly how the login page passed every checkable rule in `UI-RULES.md` and still landed visually flat: nobody looked at it before it existed as real code.

### Throughout

- **Typecheck continuously** — the cheapest real feedback available
- **Run the tests you touched continuously**
- **Full suite once, at the end**
- Never mock our own code. Real test database
- Compose UI from `components/ui/`, `components/patterns/`, and `components/layout/`
- Follow the module boundary: cross-module imports through `index.ts` only

## 5. Prepare the manual check

For any ticket with a **user-facing change**, do the setup so the user only has to look:

1. Start the dev server
2. Ensure the data exists — run the seed command if needed
3. **Load every new or changed page yourself, in an actual browser, before handing anything to the user.** Typecheck and `curl` prove a route responds; neither executes client-side rendering, so a server/client boundary violation, a runtime type mismatch (e.g. a `Date` that arrived as a JSON string), or a hydration error will pass both and still crash the first time a human opens the page. This is not optional for pages doing anything beyond a static render — it is the check step, not a nice-to-have on top of it.
   Prefer the Playwright MCP server (`.mcp.json`) for this — direct
   navigate/click/screenshot tool calls instead of a throwaway script.
   It runs over stdio, not a listening port, so it doesn't collide with
   this worktree's `next dev` port or a sibling worktree's. Falls under
   step 0a's resource-approval gate the same as any other heavyweight
   process — it launches its own headless browser. If it isn't available
   or approved, fall back to the throwaway-script pattern in
   `docs/gotchas.md`'s Testing/Playwright section.
4. Hand over: the **exact URL**, the **login to use**, and a **numbered list** of what to click and what should happen

```
Ready at http://localhost:3000/invoices
Login: sarah@acme.test / test1234  (manager role)

1. You should see 12 invoices, 3 marked overdue in red
2. Click "New invoice" → form opens, customer dropdown has 8 options
3. Submit with no customer → inline error under the field, input preserved
4. Create one → appears at top of list, status "Draft"
5. Filter to "Overdue" → 3 rows. Clear filter → back to 12

Also worth a look: the empty state at /invoices?status=paid
```

Ninety seconds of the user's attention instead of fifteen minutes of setup. **The friction is why manual testing gets skipped — remove the friction.**

## 6. Recommend post-ticket checks

Tell the user which to run:

| Ticket touched | Run |
|---|---|
| Logic only | `/review` |
| UI | `/review`, `/verify`, `/critique` |
| A multi-step flow or multiple roles | `/verify` especially |

Run `/verify` before `/critique` — no point critiquing a flow that doesn't work.

## 7. Commit

Once checks pass and findings are resolved. **One commit per ticket**, so each is independently revertable.

Reference the ticket in the message.

## Stop conditions

Three. Each is you about to invent something the user should decide. **Stop immediately and ask** — do not proceed on a plausible assumption.

1. **A needed UI component doesn't exist.** Do not build one inline. The user will say: use an existing one instead, add it to the library properly, or build it as a marked one-off
2. **The ticket is wrong, or too big for one session.** It was sliced wrong. Say so rather than pushing through
3. **A decision is needed that the ticket doesn't cover**

**"Stop and ask" is always preferred to guessing.**

## Fast path

Small, well-understood changes — a copy fix, a config tweak — skip steps 2 and 3 and run 4 through 7 only.

**`/review` still runs.** That's what stops the fast path becoming the default.

## Never

- **Never write to `CONTEXT.md` unless explicitly asked.** Vocabulary is decided in Planning and grilling, not invented mid-ticket. An agent adding terms unprompted fills the glossary with implementation nouns and destroys its value
- **Never test at a seam that isn't in `docs/architecture.md`**
- **Never mock our own code**
- **Never invent a UI component, page layout, or design token**
- **Never use arbitrary values** — `p-[13px]`, raw hex. Theme tokens only
- **Never leave a ticket half-done across two sessions.** If it doesn't fit, it was sliced wrong
- **Never write a per-ticket handoff file.** The code, tests, and git history describe the state completely

## Gotchas

If you solved something that **cost real time and isn't obvious from the code**, add an entry to `docs/gotchas.md`:

```markdown
## <one-line title>
**Symptom:** <what you observe — a future agent recognises this, not the cause>
**Cause:** <why>
**Fix:** <what to do>
**Added:** <date>
```

**The bar:** it cost more than about fifteen minutes, and reading the code wouldn't have revealed it.

**If the root cause can be fixed, fix the root cause instead.** A gotcha is an admission you couldn't.
