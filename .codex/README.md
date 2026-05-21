# Codex Project Hooks

This directory contains project-scoped Codex configuration for Archon contributors.

The `SessionStart` hook verifies a restored task list when `CODEX_TASK_LIST_ID` is set. The hook treats task IDs as untrusted input: IDs must contain only letters, digits, dot, underscore, or dash, and the resolved task directory must remain under `CODEX_TASKS_DIR` or `~/.codex/tasks`.

Default project hooks must not invoke private local tools. Optional status
integrations belong in user-local config or opt-in templates guarded by both an
environment variable and `command -v` checks.
