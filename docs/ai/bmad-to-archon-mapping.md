# BMAD to Archon Mapping

## Purpose

This document maps the committed BMAD support files into Archon's AI operating
layer without treating BMAD as a native workflow engine. BMAD is advisory in
this branch: it can inform routing, planning, review, and handoff decisions, but
Archon workflows remain the executable source of automation.

## Committed BMAD Assets

The repo carries only team-scoped, inert BMAD support files:

- `_bmad/config.toml`
- `_bmad/custom/config.toml`
- `_bmad/custom/.gitignore`
- `_bmad/_config/manifest.yaml`
- `_bmad/_config/bmad-help.csv`
- `_bmad/_config/files-manifest.csv`
- `_bmad/_config/skill-manifest.csv`
- `_bmad/core/config.yaml`
- `_bmad/core/module-help.csv`
- `_bmad/bmm/config.yaml`
- `_bmad/bmm/module-help.csv`
- `_bmad/scripts/resolve_config.py`
- `_bmad/scripts/resolve_customization.py`

User-scoped BMAD config and generated BMAD output remain local-only:

- `_bmad/config.user.toml`
- `_bmad/custom/*.user.toml`
- `_bmad-output/`

The context-intake gate blocks those local-only paths if they are ever tracked.

## Advisory Routing

BMAD roles map to existing Archon responsibilities rather than new workflow
node types:

| BMAD role or phase | Archon responsibility | Current status |
| --- | --- | --- |
| Analyst / research | gather project evidence and summarize constraints | advisory |
| Product manager / PRD | shape requirements and acceptance criteria | advisory |
| UX design | supply user-flow and interface review context | advisory |
| Architecture | review implementation strategy and tradeoffs | advisory |
| Development | support task execution and scoped validation choices | advisory |
| QA / review | challenge implementation, edge cases, and evidence | advisory |
| Correct course | inform ACO `needs_decision` or `blocked` outcomes | advisory |

Native BMAD workflows should be added only when there is repeated product value
that existing Archon workflows cannot cover. Required evidence for a future
native workflow:

1. A concrete BMAD artifact path supplied as workflow input.
2. A deterministic mapping from that artifact to Archon outputs.
3. Validation that runs without mutating product code.
4. A human checkpoint for story, phase, or graph promotion.
5. A clear owner and drift policy for generated artifacts.

## Resolver Contract

`_bmad/scripts/resolve_config.py` merges four config layers in this order:

1. `_bmad/config.toml`
2. `_bmad/config.user.toml`
3. `_bmad/custom/config.toml`
4. `_bmad/custom/config.user.toml`

Missing user layers are allowed. The committed team layers must resolve without
network access or dependency installation.

## Validation

Use these checks when BMAD support files change:

```bash
python3 _bmad/scripts/resolve_config.py --project-root . --key core --key agents
bun run aco:context-intake --json
bun run aco:gates:test
```

Do not claim BMAD runtime integration from this mapping alone. Runtime
availability must come from actual command output in the current session.
