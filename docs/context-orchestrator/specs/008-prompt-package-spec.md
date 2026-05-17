# 008 Prompt Package Spec

## Purpose

Define the ACO prompt package.

## Scope

Prompt package fields, renderers, traceability, validation report, and Codex handoff.

## Non-Goals

- Do not execute the prompt package automatically unless ADR selects that surface.

## Generic Behavior

- PromptPackage includes runId, timestamp, original prompt, target codebase, intent, evidence, GraphContext, DocumentationPlan, MCP readiness, BmadRoute, AcceptancePlan, capabilities, CavemanPolicy, security constraints, unknowns, human prompt, Codex prompt, next command, and validation report.

## Archon-Specific Behavior

- Archive prompt packages under `$ARTIFACTS_DIR/context-orchestrator/<run-id>/` for workflow runs or selected equivalent artifact surface.

## Inputs

- PromptRequest
- CapabilityRoute
- EvidencePacket
- DocumentationPlan
- BmadRoute
- AcceptancePlan

## Outputs

- manifest.json
- final-prompt-package.md
- codex-prompt.md
- validation-report.md

## Known Unknowns

- final archive root for CLI-only MVP

## Evidence References

- docs/context-orchestrator/specs/005-documentation-resolution-spec.md

## Acceptance Scenarios

- Given a compiled prompt package, when final-prompt-package.md is opened, then it references specs, acceptance criteria, graph status, docs plan, BMAD route, capabilities, and unknowns.

## Failure Behavior

- Compilation fails if acceptance plan or security constraints are missing.

## Security Constraints

- Redact secrets and validate all paths before writing.

## Open Questions

- Should prompt package JSON schema live in a new package or server schemas?
