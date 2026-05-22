# BMAD to Archon Mapping

## Purpose

The branch name references BMAD current sync, so BMAD cannot remain an unrelated install artifact. This file maps observed `_bmad` assets and BMAD phases into the Archon operating layer.

## Inspected BMAD assets

Observed `_bmad` paths:

- `_bmad/config.toml`
- `_bmad/config.user.toml`
- `_bmad/_config/manifest.yaml`
- `_bmad/_config/bmad-help.csv`
- `_bmad/_config/files-manifest.csv`
- `_bmad/_config/skill-manifest.csv`
- `_bmad/bmm/config.yaml`
- `_bmad/bmm/module-help.csv`
- `_bmad/bmm/1-analysis/`
- `_bmad/bmm/1-analysis/research/`
- `_bmad/bmm/2-plan-workflows/`
- `_bmad/bmm/3-solutioning/`
- `_bmad/bmm/4-implementation/`
- `_bmad/core/config.yaml`
- `_bmad/core/module-help.csv`
- `_bmad/custom/config.toml`
- `_bmad/custom/config.user.toml`
- `_bmad/scripts/resolve_config.py`
- `_bmad/scripts/resolve_customization.py`

Observed install metadata:

- BMAD version: `6.7.1`
- Installed modules: `core`, `bmm`
- IDE target: `codex`
- Project name: `Archon`
- Planning artifacts: `_bmad-output/planning-artifacts`
- Implementation artifacts: `_bmad-output/implementation-artifacts`
- Project knowledge: `docs`

Important observation: `_bmad/_config/skill-manifest.csv` references skill paths under `_bmad/core/...` and `_bmad/bmm/...`, but this checkout does not contain those `SKILL.md` files under `_bmad`. Executable Codex skills are present under `.agents/skills/bmad-*`.

## Mapping table

| BMAD asset / phase / role | Observed source path | Archon workflow | Archon command | Archon artifact | Validation gate | Human approval gate | Status | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BMAD install metadata | `_bmad/_config/manifest.yaml` | `context-orchestrate` | `bun run cli context status --cwd .` | Status JSON / validation report | `bun run cli context status --cwd . --json` | Graph waiver approval when required | Covered | None. |
| BMAD help / route selection | `_bmad/_config/bmad-help.csv`, `.agents/skills/bmad-help/SKILL.md` | `context-orchestrate` | `bun run cli context route --cwd . "<prompt>"` | Route JSON and ledger summary | Context route confidence | Ask user if route is `unknown-help` | Partial | Current route for this patch was `unknown-help` with low confidence, so docs mapping uses explicit local evidence instead. |
| Analysis phase: research, document, brief | `_bmad/bmm/1-analysis/`, `.agents/skills/bmad-document-project`, `.agents/skills/bmad-technical-research`, `.agents/skills/bmad-product-brief` | `archon-ai-layer-bootstrap`, `context-orchestrate`, `archon-idea-to-pr` | `ai-layer-audit`, `ai-layer-study-reference`, `archon-create-plan` | `$ARTIFACTS_DIR/ai-layer/*`, `_bmad-output/planning-artifacts`, `docs/*` | `bun run validate`, docs review | Plan or graph approval if high risk | Partial | BMAD research outputs are not automatically injected into Archon workflows. |
| Planning phase: PRD | `_bmad/bmm/2-plan-workflows/`, `.agents/skills/bmad-prd/SKILL.md` | `archon-interactive-prd`, `archon-ralph-dag`, `archon-plan-to-pr` | `archon-ralph-prd`, `archon-create-plan`, `archon-plan-setup` | PRD, plan, story inputs | `bun run cli validate workflows`, targeted tests | PRD approval in interactive workflows | Partial | No direct `bmad-prd` Archon command wrapper. |
| UX planning | `.agents/skills/bmad-create-ux-design/SKILL.md` | `archon-idea-to-pr`, UI-specific future workflow | Existing plan/review commands | UX spec under planning artifacts | UI validation when changed | Design/plan approval | Partial | No dedicated Archon UX workflow in this branch. |
| Architecture solutioning | `_bmad/bmm/3-solutioning/`, `.agents/skills/bmad-create-architecture/SKILL.md` | `archon-architect`, `archon-ai-layer-bootstrap`, `archon-aco-adversarial-loop` | `ai-layer-design`, `archon-create-plan`, `archon-workflow-summary` | Architecture plan, decision artifacts | `bun run validate:ts-navigation`, type-check, review | Broad-change approval | Covered for Archon architecture, partial for BMAD artifact handoff | BMAD architecture artifacts are manual inputs unless passed through ACO/context package. |
| Epics and stories | `.agents/skills/bmad-create-epics-and-stories/SKILL.md`, `.agents/skills/bmad-create-story/SKILL.md` | `archon-ralph-dag`, `archon-plan-to-pr`, `archon-piv-loop` | `archon-ralph-generate`, `archon-implement-tasks` | Story files, sprint state, implementation progress | Story readiness, tests, review | Story approval before dev | Partial | Story lifecycle is not encoded as one BMAD-native Archon DAG. |
| Implementation | `_bmad/bmm/4-implementation/`, `.agents/skills/bmad-dev-story`, `.agents/skills/bmad-quick-dev` | `archon-plan-to-pr`, `archon-feature-development`, `archon-fix-github-issue`, `archon-aco-adversarial-loop` | `archon-implement`, `archon-implement-tasks`, `archon-fix-issue` | `$ARTIFACTS_DIR/implementation*`, validation logs | `bun run type-check`, `bun run lint --max-warnings 0`, `bun run test`, `bun run validate` | PR or readiness approval | Covered by Archon implementation workflows | BMAD dev-story is a skill path, not an Archon node type. |
| Code review | `.agents/skills/bmad-code-review/SKILL.md`, `.agents/skills/bmad-review-adversarial-general`, `.agents/skills/bmad-review-edge-case-hunter` | `archon-smart-pr-review`, `archon-comprehensive-pr-review`, `archon-aco-adversarial-loop` | `archon-code-review-agent`, `archon-synthesize-review`, `ai-layer-review` | Review findings, verdicts, feedback | Review synthesis and validation rerun | PR approval | Covered | BMAD review layers are parallel to Archon review agents, not yet unified. |
| Sprint planning/status | `.agents/skills/bmad-sprint-planning`, `.agents/skills/bmad-sprint-status` | `archon-piv-loop`, `archon-ralph-dag`, `archon-workflow-summary` | `archon-workflow-summary` | Sprint status / run summary | Summary review | Human checkpoint | Partial | No direct sprint status Archon command wrapper. |
| Correct course | `.agents/skills/bmad-correct-course/SKILL.md` | `context-orchestrate`, `archon-assist`, future correction workflow | `ai-layer-endgoal-gate`, `ai-layer-stop-gate` | Decision dossier, next-decision JSON | ACO status/validate | Required when graph/route readiness is blocked | Partial | Current ACO next decision handles approval/waivers, not full BMAD correct-course workflow. |
| Customization | `_bmad/custom/config.toml`, `_bmad/scripts/resolve_customization.py` | None | None | Custom BMAD overrides | Python resolver scripts | Team review for committed overrides | Partial | Archon does not validate BMAD customization merge in workflow validation. |

## Interpretation rules

- BMAD phases become workflow phases when the phase has repeatable routing value.
- BMAD roles become agents, skills, or command responsibilities.
- BMAD artifacts become `$ARTIFACTS_DIR` outputs, `_bmad-output` outputs, or docs.
- BMAD gates become approval nodes, validation nodes, or explicit human checkpoint policy.
- BMAD scripts become deterministic Archon `script` or `bash` nodes only when they are stable and required.
- BMAD recurring process becomes reusable workflow assets only after enough repeated usage proves the need.

## Gaps

- `_bmad` contains manifests and config, but not the referenced `SKILL.md` files under `_bmad/core` and `_bmad/bmm`.
- Actual BMAD skills are installed under `.agents/skills/bmad-*`; workflows do not automatically discover or route those skills.
- `bun run cli context route` selected `unknown-help` for this docs-only operationalization prompt, so BMAD route confidence is intentionally marked partial.
- `bun run cli context route` also selected `unknown-help` for the runtime-enforcement follow-up, so this patch does not add a first-class BMAD workflow.
- BMAD planning and implementation artifact folders are configured but not wired as default Archon workflow inputs.
- No repo-local MCP configs exist for BMAD or external documentation.

## Runtime enforcement decision

Runtime-enforcement v1 keeps BMAD mapped/advisory and does not add `.archon/workflows/archon-bmad-story-to-plan.yaml`.

Required evidence before adding that workflow:

1. A concrete BMAD story or phase artifact under `_bmad-output`.
2. A repeated need that existing `archon-plan-to-pr`, `archon-ralph-dag`, or `context-orchestrate` workflows do not satisfy.
3. Stable mapping from BMAD skill outputs to `$ARTIFACTS_DIR`.
4. Deterministic validation that can run without product-code side effects.
5. A human gate for story readiness or phase promotion.

## Next actions

1. Keep using `bun run cli context route --cwd . "<prompt>"` before broad BMAD/ACO work.
2. When route output is `unknown-help`, use `.agents/skills/bmad-help/SKILL.md` plus `_bmad/_config/bmad-help.csv` rather than inventing a route.
3. For implementation work sourced from BMAD, pass the exact BMAD artifact path into `archon-plan-to-pr` or `archon-ralph-dag`.
4. Add a BMAD-native Archon workflow only after there is a repeated need that cannot be satisfied by existing workflows.
