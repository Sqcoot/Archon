# ACO Sprint Plan

Date: 2026-05-17
BMAD action: `bmad-sprint-planning`

## Sprint Goal

Ship CLI-first ACO MVP that compiles and archives secure Codex-ready prompt packages.

## Story Order

1. Create acceptance test harness.
2. Add `@archon/context-orchestrator` package with domain types and schemas.
3. Implement capability registry, docs planner, BMAD router, acceptance planner, and Caveman policy.
4. Implement prompt package compiler and archive writer.
5. Add CLI `context` command.
6. Run security and release readiness checks.

## Exit Criteria

- Acceptance tests pass.
- `bun run test`, `type-check`, `lint`, `format:check`, and `build` pass.
- CLI `archon context compile --cwd . --json "Validate the ACO MVP."` produces archive paths and redacted artifacts.
