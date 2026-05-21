---
description: Verify the required AI-layer bootstrap branch before any product writes
argument-hint: <ai-layer bootstrap request>
---

# AI Layer Branch Gate

Request: $ARGUMENTS

## Goal Check

Read:
- `$ARTIFACTS_DIR/ai-layer/goal.md` and `$ARTIFACTS_DIR/ai-layer/goal.json` when present
- `$ARTIFACTS_DIR/ai-layer/branch-gate.json` when present
- `$ARTIFACTS_DIR/ai-layer/artifact-registry.json` when present
- `$ARTIFACTS_DIR/ai-layer/status.json` when present

Own only branch-gate behavior. Do not edit product files.

## Required Work

1. Create `$ARTIFACTS_DIR/ai-layer` if `$ARTIFACTS_DIR` is set. If it is not set, stop and report that artifact handoff is unavailable.
2. Verify the current working directory is the git root unless `ARCHON_AI_LAYER_REPO_ROOT` is set.
3. Verify the actual branch matches `ARCHON_AI_LAYER_REQUIRED_BRANCH` when that variable is set; otherwise record the branch without failing.
4. Record `git status --short`.
5. Write:
   - `$ARTIFACTS_DIR/ai-layer/branch-gate.md`
   - `$ARTIFACTS_DIR/ai-layer/branch-gate.json`
6. Set `canProceed=false` when the branch is wrong or the Archon repo is missing.

## Output

End with:
- status
- artifacts written
- acceptance criteria satisfied
- blockers
- next recommended node
- whether retry is needed
