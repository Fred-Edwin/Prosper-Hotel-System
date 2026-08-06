---
name: fix
description: Diagnose a bug by building a reliable failing command first, then minimising, hypothesising, instrumenting, and fixing with a regression test. Refuses to theorise before a red-capable loop exists. Use when something is broken and the cause is unknown.
---

# Fix

A discipline for bugs whose cause is unknown.

**If the cause is already known, use `/build`.** "The label says Custmer" is not a diagnosis problem.

Read `<skills>/reference/TESTING.md` for seam rules. Read `CONTEXT.md` for the vocabulary of the modules involved, and check `docs/gotchas.md` — this may already be known.

**Resolving `<skills>/`.** It is the directory holding the skill folders — `~/.claude/skills/` for a global install, or `<project>/.claude/skills/` for a per-project one. **It is not inside this skill's own folder, and it is not in the project root.** Check the global path first, then the project-local one.

**If a reference file cannot be found, stop and tell the user.** Do not proceed from memory — these files hold the discipline the skill depends on, and running without them silently produces work that looks right and isn't.

---

## Phase 1 — Build the feedback loop

**This is the skill. Everything else is mechanical.**

With a reliable red signal, the bug is essentially found — bisecting, hypothesising, and instrumenting all just consume it. Without one, you are guessing, and agents guess *confidently*, which is worse than guessing slowly.

**Spend disproportionate effort here. Be aggressive. Be creative. Refuse to give up.**

### Ways to build one, roughly in order

1. **A failing test** at whatever seam reaches the bug
2. **A curl or HTTP script** against a running dev server
3. **A CLI invocation** with fixture input, diffed against known-good output
4. **A Playwright script** driving the UI, asserting on DOM, console, or network
5. **Replay a captured payload** — save the real request, event, or record to disk and push it through the code path in isolation
6. **A throwaway harness** — the minimum subset of the system that exercises the path in one call
7. **A fuzz loop** — if the bug is "sometimes wrong output", run 1000 inputs and look for the failure mode
8. **A bisection harness** — if it appeared between two known-good states, automate "boot at state X, check, repeat" so `git bisect run` can consume it

### Requirements — all four

- **Red-capable** — it drives the actual bug path and asserts the **user's exact symptom**. Not "runs without erroring". It must be able to catch *this* bug
- **Deterministic** — the same verdict every run. For intermittent bugs, raise the reproduction rate until it's debuggable. A 50% flake is workable; 1% is not
- **Fast** — seconds, not minutes
- **Unattended** — runnable without a human

**Paste the invocation and its output.** The command must have been run at least once.

### The hard rule

**If you catch yourself reading code to build a theory before this command exists, stop.** Jumping straight to a hypothesis is the exact failure this skill prevents. No red-capable command, no Phase 2.

### If you genuinely cannot build one

Stop and say so explicitly. List what you tried. Ask the user for one of:

- Access to an environment that reproduces it
- A captured artifact — HAR file, log dump, screen recording with timestamps
- Permission to add temporary production instrumentation

**Do not proceed to hypothesise without a loop.** A fix applied without one might work, applied to a cause that might be real, and you will have no way to tell.

---

## Phase 2 — Reproduce and minimise

Run the loop. Watch it go red.

Confirm:
- It produces **the symptom the user described** — not a different failure that happens to be nearby. Wrong bug means wrong fix
- It's reproducible across runs
- You've captured the exact symptom — error message, wrong output, timing — so later phases can verify the fix addresses it

**Then minimise.** Cut inputs, callers, config, data, and steps **one at a time**, re-running after each. Keep only what's load-bearing.

Done when removing **any** remaining element makes it go green.

Why bother: fewer moving parts means a smaller hypothesis space in Phase 3, and the minimised case becomes the clean regression test in Phase 5.

---

## Phase 3 — Hypothesise

**Generate 3–5 ranked hypotheses before testing any of them.** Single-hypothesis generation anchors on the first plausible idea and then finds evidence for it.

Each must be **falsifiable** — state the prediction:

> "If X is the cause, then changing Y will make the bug disappear."

If you can't state the prediction, it's a vibe. Sharpen it or discard it.

**Show the ranked list to the user before testing.** They often re-rank it instantly — "we deployed a change to #3 last week" — or know one is already ruled out. Cheap checkpoint, big saving. **Don't block on it**; proceed with your ranking if they're away.

---

## Phase 4 — Instrument

Each probe maps to a specific prediction from Phase 3. **Change one variable at a time.**

Tool preference:
1. **Debugger or REPL** if the environment supports it. One breakpoint beats ten logs
2. **Targeted logs** at the boundaries that distinguish hypotheses
3. **Never "log everything and grep"**

**Tag every debug log with a unique prefix** — `[DEBUG-a4f2]` — so cleanup is one search. Untagged logs survive forever.

**For performance bugs**, logs are usually wrong. Establish a baseline measurement first — a timing harness, a profiler, a query plan — then bisect. Measure first, fix second.

---

## Phase 5 — Fix with a regression test

Write the test **before** the fix — **but only if a correct seam exists.**

A correct seam is one where the test exercises the **real bug pattern as it occurs at the call site**. A seam that's too shallow — a unit test that can't replicate the chain that triggered it — gives false confidence.

### If no correct seam exists, that is the finding

Record it. **The architecture is preventing this bug from being locked down**, which is more valuable information than the fix itself. Hand it to `/care` with specifics.

### If a correct seam exists

1. Turn the minimised repro into a failing test at that seam
2. Watch it fail
3. Apply the fix
4. Watch it pass
5. **Re-run the Phase 1 loop against the original, un-minimised scenario**

**Regression tests: yes for logic bugs. No for cosmetic ones** — a misaligned button doesn't silently return.

---

## Phase 6 — Cleanup and post-mortem

Required before declaring done:

- [ ] The original repro no longer reproduces — re-run the Phase 1 loop
- [ ] The regression test passes, or the absence of a seam is recorded
- [ ] All `[DEBUG-…]` instrumentation removed — grep the prefix
- [ ] Throwaway scripts and harnesses deleted
- [ ] **The correct hypothesis stated in the commit message** — cheap, and the next person debugging nearby learns from it

Then two questions, asked **after** the fix, when you know more than you did at the start:

**What would have prevented this?** If the answer is structural — no good seam, tangled modules, hidden coupling — hand it to `/care` with the specifics.

**Does this belong in `docs/gotchas.md`?** Only if it cost real time and reading the code wouldn't have revealed it. **If the root cause is fixable, fix the root cause instead** — a gotcha is an admission you couldn't.

---

## Never

- **Never hypothesise before a red-capable loop exists**
- **Never generate a single hypothesis**
- **Never leave tagged debug logs behind**
- **Never claim it's fixed without re-running the original loop**
- **Never write a regression test at a seam that can't exercise the real bug pattern** — say so instead
