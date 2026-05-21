---
description: Apply safe AI-layer edits and write proposed artifacts for risky config
argument-hint: <ai-layer bootstrap request>
---

# AI Layer Implement

Request: $ARGUMENTS

## Goal Check

Read from `$ARTIFACTS_DIR/ai-layer`: `goal.md`, `goal.json`, `branch-gate.json`, `artifact-registry.json`, `status.json`, `implementation-plan.md`, `file-plan.json`, `risk-register.json`, and `write-gate.json`.

Own only applying safe edits and creating proposed artifacts.

## Required Work

1. Stop if `write-gate.json` does not allow product writes.
2. Write only files allowed by `file-plan.json`.
3. Preserve existing config and do not overwrite high-risk files.
4. Write proposed hook/MCP/config templates under `$ARTIFACTS_DIR/ai-layer/proposed/`.
5. Regenerate bundled defaults if bundled command/workflow files changed.
6. Write:
   - `$ARTIFACTS_DIR/ai-layer/implementation-summary.md`
   - `$ARTIFACTS_DIR/ai-layer/implementation-diff-summary.md`
   - `$ARTIFACTS_DIR/ai-layer/changed-files.json`
7. Update `$ARTIFACTS_DIR/ai-layer/status.json`.

## Guardrails

- Do not run `git clean`.
- Do not commit.
- Do not add pyright.
- Do not live-edit `.claude/settings.json`, `.codex/hooks.json`, `.codex/config.toml`, or `.mcp.json` unless explicitly planned and validated.

## Output

End with:
- status
- artifacts written
- acceptance criteria satisfied
- blockers
- next recommended node
- whether retry is needed
