# Skills

Eleven skills implementing [`workflow.md`](../workflow.md).

## Installing

Copy the skill folders into `.claude/skills/` in a project, or into `~/.claude/skills/` to have them available everywhere.

```bash
cp -r skills/* ~/.claude/skills/
```

The `reference/` folder must sit **alongside** the skill folders, never inside one:

```
~/.claude/skills/
├── plan/SKILL.md
├── build/SKILL.md
├── …
└── reference/          ← a sibling of the skills, not a child
    ├── INTERROGATION.md
    └── …
```

Skills write these as `<skills>/reference/NAME.md` and resolve `<skills>` themselves — global install first, then project-local. A skill that cannot find a reference file **stops and says so** rather than proceeding from memory.

## The flow

```
LIFECYCLE (once per project)

  /discovery ──► /plan ──► /design ──► /foundation
                   │
                   └──► /tickets ──┐
                                   │
LOOPS (forever)                    ▼
                            ┌─────────────┐
                            │   /build    │──► /review
                            │             │──► /verify
                            │             │──► /critique
                            └─────────────┘
                                   │
                            /fix ──┤
                                   │
                            /care ─┘──► /tickets (next tranche)
```

## The skills

| Skill | When | What it does |
|---|---|---|
| `/discovery` | Before and after a client meeting | Preps questions, or debriefs you and writes `docs/discovery.md` |
| `/plan` | Once per project | Interrogates you into architectural decisions. Writes `CONTEXT.md`, `architecture.md`, `scope.md` |
| `/tickets` | After `/plan`, and between tranches | Cuts one tranche of vertical tickets into `.work/` |
| `/design` | Once per project | Refinement rounds until converged, then locks theme, templates, and stories |
| `/design references` | When a round disappoints | Reruns the round against real-world examples you supply. Never entered automatically |
| `/foundation` | Once per project | The skeleton plus one real end-to-end slice. Writes `CLAUDE.md` |
| `/build` | Once per ticket, fresh session | The core loop. Interface plan → checkpoint → build → verify → commit |
| `/review` | After every ticket | Two-axis review — standards and ticket — in parallel sub-agents |
| `/verify` | After a UI or multi-role ticket | Playwright drives the flow, screenshots, hands you the judgment calls |
| `/critique` | After a ticket that built screens | Audits UI against written rules. Findings, not opinions |
| `/fix` | A bug whose cause is unknown | Six-phase diagnosis. Refuses to theorise before a red loop exists |
| `/care` | Between tranches | Scans for architectural friction, ranks candidates, stops for your pick |

## Reference files

Shared discipline, read by the skills. Not invoked directly.

| File | Holds |
|---|---|
| `reference/INTERROGATION.md` | How to interview. Used by `/discovery`, `/plan`, `/design`, `/care` |
| `reference/MODULES.md` | Module, interface, boundary, depth, seam vocabulary |
| `reference/TESTING.md` | Test types, seams, test-first rules, anti-patterns |
| `reference/TICKET-FORMAT.md` | The ticket template and the lifecycle check |
| `reference/UI-RULES.md` | The checkable design rules |

## Which checks after a ticket

`/build` recommends, you decide.

| Ticket touched | Run |
|---|---|
| Logic only | `/review` |
| UI | `/review`, `/verify`, `/critique` |
| A multi-step flow or multiple roles | `/verify` especially |

Run `/verify` before `/critique` — no point critiquing a flow that doesn't work.

## Structural rules

**All eleven are user-invoked.** They produce work or make decisions; you decide when to take that on.

Four carry no `disable-model-invocation` flag — `/review`, `/verify`, `/critique`, and `/fix` — so the agent can also reach for them when the task obviously fits. The rest are typed only.

**A skill never calls another skill.** Where one hands off, it *ends* and tells you what to run next. Shared behaviour lives in `reference/`, not in cross-skill calls.

## Porting to another agent

Skill bodies are plain markdown with no harness-specific syntax. Moving to Codex or another tool is a rename plus a frontmatter change.

Two things assume Claude Code:

- **Parallel sub-agents** in `/review` and `/care`. Fallback: run sequentially in separate sessions. Slower, slight cross-contamination, but the discipline survives
- **`CLAUDE.md`** as a filename. `AGENTS.md` is the cross-tool convention

## Revising these

Expect to. When a skill produces something wrong, fix the skill — that's the loop.

Two specific feedback paths worth honouring:

- **`/critique` findings should become `CLAUDE.md` lines.** If the same finding appears three times, that's a missing prevention rule, not a recurring fix
- **`/build` stop conditions that fire repeatedly** mean `/tickets` is cutting badly. Fix the upstream skill, not the symptom
