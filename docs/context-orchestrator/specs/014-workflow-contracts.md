# 014 Workflow Contracts

## Purpose

Define candidate bundled workflow contracts.

## Scope

context-orchestrate, context-sdd-atdd-implement, context-research, context-code-review, context-correct-course.

## Non-Goals

- Do not create workflows before ADR selects workflow surface.

## Generic Behavior

- Workflow contracts compose route, graph, docs, bmad, accept, compile, validate, review, and archive stages.

## Archon-Specific Behavior

- Workflows use `$ARGUMENTS`, `$USER_MESSAGE`, `$WORKFLOW_ID`, `$ARTIFACTS_DIR`, `$DOCS_DIR`, `$CONTEXT`, and node-output references.

## Inputs

- workflow arguments
- codebase context
- artifact root

## Outputs

- workflow artifacts
- workflow events
- validation report

## Known Unknowns

- which workflows are included in MVP

## Evidence References

- packages/workflows/src/schemas/workflow.ts
- .archon/workflows/defaults

## Acceptance Scenarios

- Given `context-orchestrate` workflow exists, when workflow validation runs, then validation passes before use.

## Failure Behavior

- Workflow fails with explicit blocker when required spec or acceptance plan is missing.

## Security Constraints

- No raw prompt text in shell commands; no secrets in workflow events.

## Open Questions

- Should context workflows be bundled defaults or repo-local examples first?
