# STAB-002 Cleanup Validation Report

Timestamp: 2026-05-22T19:00:00Z
Baseline: `origin/dev...HEAD`
Branch: `stabilization/stab-002-bmad-method-current-sync`

## Scope

This report covers phase-gated merge-hygiene cleanup and verification for STAB-002. It compares the branch against `origin/dev`, inventories the branch diff, inspects Archon workflows/commands/scripts, BMAD assets, hooks, MCP references, and AI governance assets, applies only safe reversible cleanup, and records validation evidence.

This is not a feature-building report.

## Environment

- Repository: `/Users/edam/Documents/TODA/Archon`
- Current branch: `stabilization/stab-002-bmad-method-current-sync`
- Baseline commit: `origin/dev` at `7bdf931aad5adecc862c30f54584ede8d8c86a21`
- Merge base: `7bdf931aad5adecc862c30f54584ede8d8c86a21`
- HEAD at preflight: `4be5764ed516ac4fca88dc447af0d847f2f9e2f2`
- Branch commit count over `origin/dev`: 56
- Changed files in `origin/dev...HEAD`: 367
- Shortstat: `367 files changed, 43318 insertions(+), 1249 deletions(-)`

## Files Added

- `docs/ai/goals/stab-002-phase-gated-cleanup-and-verification.goal.md`
- `docs/context-orchestrator/stabilization/stab-002-goal-state.md`
- `docs/context-orchestrator/stabilization/stab-002-checkpoint-log.md`
- `docs/context-orchestrator/stabilization/stab-002-dev-diff-inventory.md`
- `docs/context-orchestrator/stabilization/stab-002-file-analysis-matrix.md`
- `docs/context-orchestrator/stabilization/stab-002-party-mode-consensus.md`
- `docs/context-orchestrator/stabilization/stab-002-keep-move-remove-split-matrix.md`
- `docs/context-orchestrator/stabilization/stab-002-cleanup-decision-ledger.md`
- `docs/context-orchestrator/stabilization/stab-002-cleanup-validation-report.md`

## Files Edited

- `docs/context-orchestrator/stabilization/aco-stabilization-scorecard.md`
- `docs/context-orchestrator/stabilization/aco-stabilization-scorecard.json`
- `docs/context-orchestrator/stabilization/aco-pr-hygiene-report.md`
- `docs/context-orchestrator/stabilization/stab-002-goal-state.md`
- `docs/context-orchestrator/stabilization/stab-002-checkpoint-log.md`
- `docs/context-orchestrator/stabilization/stab-002-file-analysis-matrix.md`
- `docs/context-orchestrator/stabilization/stab-002-keep-move-remove-split-matrix.md`
- `docs/context-orchestrator/stabilization/stab-002-cleanup-decision-ledger.md`

## Files Moved

None.

## Files Removed

None by this cleanup batch.

The branch diff already removes these transient tracked build-cache files relative to `origin/dev`, and the cleanup matrix keeps that removal:

- `packages/core/tsconfig.tsbuildinfo`
- `packages/server/tsconfig.tsbuildinfo`

## Files Intentionally Kept

- Product code and tests under `packages/**` and `tests/**`
- ACO specs and traceability docs under `docs/context-orchestrator/specs/**`
- Product-facing ACO workflows such as `context-orchestrate`
- Referenced default workflow/command surfaces that validate but require policy signoff before moving
- BMAD sync/config assets that are tracked and documented
- Research evidence with references in docs, traceability, scripts, or package scripts
- Codex/Claude/agent config surfaces pending human policy decision

## Files Requiring Human Decision

The detailed queue is maintained in `stab-002-cleanup-decision-ledger.md`. The main categories are:

- Project Codex hooks and agents shipping to `dev`
- Claude hooks/settings and changed agent/skill defaults shipping to `dev`
- Required vs path-scoped ACO policy/OPA in CI
- BMAD advisory/mapped status vs native Archon workflows
- Branch-specific `/goal`, `ai-layer-*`, and `solidify-poc` default command status
- `archon-ai-layer-bootstrap` and `archon-aco-adversarial-loop` default workflow status
- Generated research retention and graph waiver policy
- Repo-local MCP template policy
- Whether this branch should split into multiple PRs

## Inspected Surfaces

Archon workflows inspected:

- 23 repo default workflow files discovered under `.archon/workflows/defaults`
- 42 total workflows discovered by `bun run cli workflow list --cwd . --json`
- Named workflows inspected include `context-orchestrate`, `archon-aco-adversarial-loop`, `archon-ai-layer-bootstrap`, `archon-assist`, `archon-validate-pr`, and `archon-smart-pr-review`

Archon commands inspected:

- 55 repo default command files discovered under `.archon/commands/defaults`
- 81 commands/scripts validated by `bun run cli validate commands --cwd .`
- Named command groups inspected include `goal.md`, `ai-layer-*`, core `archon-*` commands, and `solidify-poc`

Archon scripts inspected:

- 15 repo scripts discovered under `.archon/scripts`
- Validated scripts include `check-artifact-completeness`, `check-complete-preconditions`, `validate-branch-name`, maintainer standup scripts, marketplace scripts, and echo test scripts

BMAD assets inspected:

- `_bmad/_config/**`
- `_bmad/bmm/**`
- `_bmad/core/**`
- `_bmad/custom/**`
- `_bmad/scripts/**`
- `.agents/skills/bmad-*`
- `docs/ai/bmad-to-archon-mapping.md`

Hooks inspected:

- `.codex/hooks.json`
- `.codex/hooks/verify-task-list.sh`
- `.codex/README.md`
- `.claude/settings.json`
- `.claude/agents/ai-layer-explorer.md`
- `.claude/skills/scoped-tests/SKILL.md`
- Archon per-node workflow hook references
- Git hook references were inspected only; `.git/hooks` was not modified

MCP references inspected:

- `.archon` MCP references
- Optional guarded `.archon/mcp/ntfy.json` warning in `archon-smart-pr-review`
- Context7/OpenAI Docs MCP references in docs and ACO evidence
- No live repo-local MCP config was added

## Generated Defaults

Generated defaults regenerated: yes.

`bun run generate:bundled` wrote `packages/workflows/src/defaults/bundled-defaults.generated.ts` with 55 commands and 23 workflows. Git status did not show generated-default drift after regeneration.

## Commands Attempted

| Command | Status | Output excerpt | Failure classification | Follow-up |
|---|---|---|---|---|
| `git fetch origin` | pass | baseline `origin/dev` verified | none | none |
| `git diff origin/dev...HEAD` preflight suite | pass | 367 files, 43318 insertions, 1249 deletions | none | none |
| `bun run cli validate workflows --cwd .` | pass | `Results: 42 valid, 0 with errors, 1 with warnings` | warning only | Guarded optional MCP warning documented |
| `bun run cli validate commands --cwd .` | pass | `Results: 81 valid, 0 with errors` | none | none |
| Fixed-string search for old machine-local supplemental report path | pass | no hits after cleanup | none | none |
| Fixed-string search for old non-`origin/dev` PR review branch | pass | no hits after cleanup | none | none |
| `jq empty docs/context-orchestrator/stabilization/aco-stabilization-scorecard.json` | pass | `json-ok` | none | none |
| `git diff --check` after Batch 1 | pass | no output | none | none |
| `git diff --name-only origin/dev...HEAD` reconciliation | pass | 367 paths | none | none |
| Inventory/matrix coverage Node check | pass | 0 missing inventory paths, 0 missing matrix paths | none | none |
| Local leakage scan | pass-with-notes | 1259 hits, dominated by tests, fixtures, docs, and goal-command snippets | expected fixture/docs hits | Do not treat as accidental leakage unless future review finds changed non-fixture local data |
| Transient tracked-file scan | pass | 0 hits | none | none |
| `bun run cli workflow list --cwd . --json` | pass | 42 workflows discovered | warning logs only | none |
| `archon workflow list --cwd . --json` | pass | 42 workflows discovered | warning logs only | optional duplicate complete |
| `archon validate workflows --cwd .` | pass | `Results: 42 valid, 0 with errors, 1 with warnings` | warning only | Guarded optional MCP warning documented |
| `archon validate commands --cwd .` | pass | `Results: 81 valid, 0 with errors` | none | optional duplicate complete |
| `bun run generate:bundled` | pass | `55 commands, 23 workflows` | none | none |
| `bun run check:bundled` | pass | `bundled-defaults.generated.ts is up to date` | none | none |
| `bun run check:bundled-skill` | pass | `bundled-skill.ts is up to date (21 files)` | none | none |
| `bun run aco:traceability` | pass | `ACO traceability validation passed` | none | none |
| BMAD package script discovery | skipped | no BMAD-specific package scripts found | not applicable | BMAD validation remains through mapping/docs and general validation |
| `bun run aco:policy` | pass | OPA tests pass and fixture decisions match | none | none |
| `bun run aco:policy:test` | pass | `PASS: 9/9` | none | none |
| `bun run format:check` | pass | `All matched files use Prettier code style` | none | none |
| `bun run validate` | pass | bundled, traceability, typecheck, lint, format, and package tests passed | none | none |
| Final `git diff --check` | pass | no output | none | none |
| `bun run test` | pass | package test suite exited 0 | none | none |
| Final artifact `git diff --check` | pass | no output after final audit/report edits | none | none |
| Final artifact `bun run format:check` | pass | `All matched files use Prettier code style` | none | none |
| Optional no-edit `archon-assist` smoke | skipped | skipped by safety condition | not applicable | Schema/discovery validation used instead |

## Validation Warnings

- `archon-smart-pr-review` reports one guarded optional MCP warning for missing `.archon/mcp/ntfy.json`; the validator says the node is guarded by an upstream file-existence check and will be skipped when absent.
- Workflow discovery logs `deprecated_workflow_defaults_found` for repo-local `.archon/workflows/defaults`; this is existing project behavior and not a validation failure.
- Local leakage scan reports many `/tmp`, localhost, and fixture absolute-path examples. Targeted cleanup checks for the accidental old supplemental report path and earlier PR-review branch are clean.

## Acceptance Checklist

- Comparison uses `origin/dev` baseline: pass
- Every changed file is inventoried or explicitly grouped: pass
- Every changed file/group has a classification: pass
- Archon workflows inspected: pass
- Archon commands inspected: pass
- Archon scripts inspected: pass
- BMAD assets inspected: pass
- Codex hooks inspected: pass
- Claude hooks/settings inspected: pass
- Archon per-node hooks inspected: pass
- MCP references inspected: pass
- Reference checks were run for move/remove/split candidates: pass
- Party-mode consensus exists: pass
- Keep/move/remove/split matrix exists: pass
- Dry-run cleanup plan exists: pass
- Cleanup was applied in batches or consciously deferred: pass
- Post-cleanup reconciliation was completed: pass
- Local path leakage removed or justified: pass
- Wrong-baseline evidence corrected or labeled historical: pass
- STAB-specific docs moved or intentionally kept: pass
- Branch-specific default commands reviewed: pass
- Branch-specific default workflows reviewed: pass
- Generated defaults regenerated if needed: pass
- Workflow validation passed or failure documented: pass
- Command validation passed or failure documented: pass
- Bundle checks passed or failure documented: pass
- ACO traceability passed or failure documented: pass
- Repo validation passed or failure documented: pass
- `git diff --check` passed or failure documented: pass
- Human decision queue exists: pass
- Goal state file is up to date: pass
- Checkpoint log is up to date: pass
- Final adversarial audit exists: pass

## Sufficiency Verdict

Sufficient for merge hygiene.

Final blocker: none.

Recommended next step: have the release owner review and approve the documented human decision queue before merge, especially trust-sensitive hooks/config, CI/OPA scope, and branch/default workflow-command surfaces.
