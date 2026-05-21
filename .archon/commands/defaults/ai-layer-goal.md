---
description: Define the durable goal and artifact contract for AI Layer Bootstrap
argument-hint: <provider=both|claude|codex --dry-run|--propose|--apply request>
---

# AI Layer Goal

Request: $ARGUMENTS

## Goal Check

Read `$ARTIFACTS_DIR/ai-layer/branch-gate.json` first. Stop if `canProceed` is not true.

Own only the durable goal/endgoal contract and initial routing gate.

## Required Work

1. Resolve the target repo from the workflow cwd. Distinguish:
   - Archon source repo: current workflow repository, or `ARCHON_AI_LAYER_REPO_ROOT` when set
   - required branch: `ARCHON_AI_LAYER_REQUIRED_BRANCH` when set; otherwise record current branch as evidence
   - optional Helpline reference repo: `ARCHON_HELPLINE_REFERENCE_ROOT` when set
   - target repo cwd
2. Infer provider target from `$ARGUMENTS`: `claude`, `codex`, or `both`; default to `both`.
3. Infer mode from `$ARGUMENTS`: `dry-run`, `propose`, `apply`, or `apply-safe-and-propose-risky`; default to `apply-safe-and-propose-risky`.
4. Define objective, non-goals, acceptance criteria, terminal conditions, stop rules, validation contract, evidence contract, and artifact contract.
5. Write:
   - `$ARTIFACTS_DIR/ai-layer/goal.md`
   - `$ARTIFACTS_DIR/ai-layer/goal.json`
   - `$ARTIFACTS_DIR/ai-layer/artifact-registry.json`
   - `$ARTIFACTS_DIR/ai-layer/status.json`
   - `$ARTIFACTS_DIR/ai-layer/routing-gate.json`

## Guardrails

- Preserve existing non-Claude/non-Codex providers.
- Do not treat model strings as provider selectors.
- Do not create `.archon/artifacts/ai-layer` in git.

## Output

End with:
- status
- artifacts written
- acceptance criteria satisfied
- blockers
- next recommended node
- whether retry is needed
