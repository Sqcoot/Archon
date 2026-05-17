# Codex Project Hooks

This directory contains project-scoped Codex configuration for Archon contributors.

The `SessionStart` hook verifies a restored task list when `CODEX_TASK_LIST_ID` is set. The hook treats task IDs as untrusted input: IDs must contain only letters, digits, dot, underscore, or dash, and the resolved task directory must remain under `CODEX_TASKS_DIR` or `~/.codex/tasks`.

The `UserPromptSubmit` and `Stop` hooks update optional local agent status through `kild`. Those status updates are advisory telemetry only and intentionally fail open so missing or unavailable local status tooling cannot block Codex work.
