# Git Package Instructions

Purpose: typed git operations, repository sync, branches, worktrees, and exec wrappers.

- Use `execFileAsync` rather than shell string execution for git commands.
- Surface git errors directly when actionable.
- Trust git guardrails; do not hide conflicts or dirty-worktree failures.
- Never add `git clean -fd` behavior.
- Validate with package tests before full validation.
