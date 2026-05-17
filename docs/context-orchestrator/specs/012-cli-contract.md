# 012 CLI Contract

## Purpose

Define CLI contract candidates.

## Scope

`archon context` commands, flags, JSON output, and validation behavior.

## Non-Goals

- Do not implement CLI before ADR 0009 selects MVP surface.

## Generic Behavior

- CLI exposes route, compile, graph, docs, bmad, accept, validate, and status operations.

## Archon-Specific Behavior

- Archon CLI command should live under `packages/cli/src/commands` if selected.

## Inputs

- --cwd
- prompt
- --json
- --graph
- --docs
- --context7
- --openai-docs
- --caveman

## Outputs

- human summary
- JSON response
- archive path
- exit code

## Known Unknowns

- whether CLI or workflow is first MVP

## Evidence References

- packages/cli/src/commands/validate.ts
- packages/cli/src/cli.ts

## Acceptance Scenarios

- Given `archon context compile --cwd . --json "prompt"`, when CLI surface is selected, then output is valid JSON and includes prompt package paths.

## Failure Behavior

- Exit nonzero for blockers; include machine-readable error in JSON mode.

## Security Constraints

- Do not print secrets in stdout/stderr.

## Open Questions

- Should CLI command be available in binary builds for MVP?
