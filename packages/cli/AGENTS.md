# CLI Package Instructions

Purpose: command-line entry point and CLI command implementations.

- Use explicit argument parsing and clear error messages.
- Workflow and isolation commands must respect git worktree guardrails.
- Do not run destructive git commands such as `git clean`.
- Validate CLI behavior with targeted CLI tests or command invocations before broad validation.
