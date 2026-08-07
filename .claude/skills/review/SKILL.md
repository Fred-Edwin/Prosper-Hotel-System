---
name: review
description: Two-axis review of a diff — Standards (conventions, module boundaries, code smells) and Ticket (does it do what was asked). Runs as parallel sub-agents and reports them side by side, never merged. Use after a ticket or on any diff.
---

# Review

Two-axis review of the diff between `HEAD` and a fixed point.

- **Standards** — does this follow the project's conventions and keep the module boundaries intact?
- **Ticket** — does this faithfully do what the ticket asked?

Both run as **parallel sub-agents** so they don't pollute each other's context. The reports are then presented side by side and **never merged**.

## Why two axes

A change can pass one and fail the other:

- Follows every convention but implements the wrong thing → **Standards pass, Ticket fail**
- Does exactly what the ticket asked but breaks the project's conventions → **Ticket pass, Standards fail**

Reporting them separately stops one from masking the other. **Do not rerank across axes** — that's the exact masking the separation exists to prevent.

## 1. Pin the fixed point

Whatever the user named — a commit, `main`, `HEAD~3`. If they didn't say, ask.

Capture `git diff <fixed-point>...HEAD` (three-dot, against the merge-base) and `git log <fixed-point>..HEAD --oneline`.

**Confirm the ref resolves and the diff is non-empty before spawning anything.** A bad ref should fail here, not inside two sub-agents.

## 2. Find the ticket

In order: the ticket referenced in the commit messages; a path the user passed; a file in `.work/` matching the branch or feature. If nothing is found, ask. If there genuinely isn't one, the Ticket sub-agent is skipped and the report says so.

## 3. Spawn both sub-agents in parallel

One message, two `Agent` calls, `general-purpose` for both. **Fresh agents — never the one that wrote the code**, which already believes it's correct.

### Standards sub-agent

Give it: the diff command, the commit list, the contents of `CLAUDE.md` and `docs/architecture.md`, and the baseline below pasted in full.

> Report, per file or hunk: (a) every place the diff violates a documented project standard — cite the standard; (b) any baseline smell you spot — name it and quote the hunk. Distinguish hard violations from judgement calls: documented-standard breaches can be hard, baseline smells are always judgement calls, and a documented project standard overrides the baseline. Skip anything the linter enforces. Under 400 words.

**The baseline, in priority order:**

1. **Module boundary violation** — importing another module's internals rather than its `index.ts`. **The highest-priority check.** → route through the interface, or move the code
2. **Shallow module** — a large interface with little behind it. Apply the deletion test: if this were deleted, would complexity vanish or reappear across many callers? → merge it into its caller, or give it more to do
3. **Duplicated logic** — the same shape in more than one hunk → extract, call from both
4. **Mysterious name** — doesn't reveal what it does or holds → rename; if no honest name comes, the design is murky
5. **Data clumps** — the same few parameters travelling together, a type wanting to be born → bundle them
6. **Primitive obsession** — a string or number standing in for a domain concept → give the concept a small type
7. **Shotgun surgery** — one logical change forcing scattered edits across many files → gather what changes together
8. **Divergent change** — one file edited for several unrelated reasons → split so each changes for one reason
9. **Speculative generality** — abstraction, parameters, or hooks for needs the ticket doesn't have → delete; inline back until a real need shows
10. **Feature envy** — a function reaching into another object's data more than its own → move it to the data
11. **Message chains** — long `a.b().c().d()` navigation → hide the walk behind one call
12. **Middle man** — mostly just delegating onward → cut it, call the real target

### Ticket sub-agent

Give it: the diff command, the commit list, and the full ticket contents.

> Report: (a) requirements the ticket asked for that are missing or partial; (b) behaviour in the diff nobody asked for — scope creep; (c) requirements that look implemented but where the implementation looks wrong; (d) **lifecycle actions the ticket declared that the code doesn't have** — if the ticket's Lifecycle section says records are deletable, check a delete path exists. Quote the ticket line for each finding. Under 400 words.

## 4. For UI tickets, add the states checklist

Check the diff for each. Anything missing is a finding.

- Empty — first use
- Empty — no results from a filter (a **different** message from first-use)
- Loading — skeleton matching real dimensions
- Error — with retry, and typed input preserved
- Permission-denied
- One item
- Many items
- Very long text
- Null and missing values

## 5. Aggregate

Present under `## Standards` and `## Ticket` headings. The sub-agents may use precise jargon (module boundary, N+1, feature envy, etc.) — that vocabulary is what makes their analysis specific, so don't ask them to avoid it. But **when presenting each finding to the user, translate it**, don't just relay the sub-agent's raw wording:

- **Name the term once, then say what it means in plain words** — a sentence a non-specialist can follow, not the jargon alone.
- **State the concrete consequence** — what actually breaks, or could break, and under what condition (e.g. "if yield is ever 0, this divides by zero and shows a broken number" beats "missing validation").
- **State severity plainly** — is this urgent, or a minor cleanup? Say so directly ("not urgent, nobody can hit this yet because X" or "worth fixing now because Y"), don't leave the user to infer it from category names.

Keep the underlying finding (file/line, quoted hunk) intact — translate the framing, not the evidence.

End with one line: total findings per axis, and the worst issue **within each axis**. **Don't pick a single winner across axes.**

## 6. Report; don't fix

The user decides what's real — some findings are wrong, some are deliberate. Fix only what they approve.

## Fallback without sub-agents

If parallel sub-agents aren't available, run the two reviews sequentially in separate sessions. Slower, with slight cross-contamination, but the discipline survives.

## Never

- **Never merge the two reports or rerank across axes**
- **Never auto-fix before the user has seen the findings**
- **Never flag what the linter already enforces**
