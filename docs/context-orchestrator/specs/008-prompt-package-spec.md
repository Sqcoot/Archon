# 008 Prompt Package Spec

## Purpose

Define the ACO prompt package.

## Scope

Prompt package fields, renderers, traceability, validation report, and Codex handoff.

## Non-Goals

- Do not execute the prompt package automatically unless ADR selects that surface.

## Generic Behavior

- PromptPackage includes runId, timestamp, original prompt, target codebase, intent, evidence, GraphContext, DocumentationPlan, MCP readiness, BmadRoute, AcceptancePlan, capabilities, CavemanPolicy, security constraints, unknowns, human prompt, Codex prompt, structured next command argv, and validation report.

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
- prompt-package.json
- final-prompt-package.md
- codex-prompt.md
- validation-report.md

`prompt-package.json` is the stable machine-readable policy input for ACO prompt-package validation. It includes `schema_version`, `package_id`, `generated_at`, `source_request`, `manifest`, artifact references, graph/docs/BMAD/acceptance/security evidence, and the validation report.

## Known Unknowns

- final archive root for CLI-only MVP

## Evidence References

- docs/context-orchestrator/specs/005-documentation-resolution-spec.md

## Acceptance Scenarios

- Given a compiled prompt package, when final-prompt-package.md is opened, then it references specs, acceptance criteria, graph status, docs plan, BMAD route, capabilities, and unknowns.
- Given a compiled prompt package, when prompt-package.json is opened, then it exposes the archived evidence contract consumed by the OPA prompt-package policy.

## Failure Behavior

- Compilation fails if acceptance plan or security constraints are missing.

## Security Constraints

- Redact secrets, validate all paths before writing, and represent follow-up commands as argv arrays rather than shell-interpolated strings.

## Open Questions

- Should prompt package JSON schema live in a new package or server schemas?
