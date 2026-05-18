# 008 Prompt Package Spec

## Purpose

Define the ACO prompt package and its derived policy-decision artifact.

## Scope

Prompt package fields, renderers, traceability, validation report, archived OPA policy decision evidence, and Codex handoff.

## Non-Goals

- Do not execute the prompt package automatically unless ADR selects that surface.
- Do not treat the derived `policy-decision.json` artifact as an input to OPA policy evaluation.

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
- policy-decision.json
- final-prompt-package.md
- codex-prompt.md
- validation-report.md

`prompt-package.json` is the stable machine-readable policy input for ACO prompt-package validation. It includes `schema_version`, `package_id`, `generated_at`, `source_request`, `manifest`, artifact references, graph/docs/BMAD/acceptance/security evidence, and the validation report.

`policy-decision.json` is the deterministic machine-readable OPA decision artifact derived from the archived `prompt-package.json` bytes. It records the normalized allow/deny/warn decision, stable finding codes, counts, duplicate suppression count, SHA-256 hashes for the input and policy files, and OPA CLI version metadata. It must not contain wall-clock evaluation time.

## Known Unknowns

- final archive root for CLI-only MVP

## Evidence References

- docs/context-orchestrator/specs/005-documentation-resolution-spec.md

## Acceptance Scenarios

- Given a compiled prompt package, when final-prompt-package.md is opened, then it references specs, acceptance criteria, graph status, docs plan, BMAD route, capabilities, and unknowns.
- Given a compiled prompt package, when prompt-package.json is opened, then it exposes the archived evidence contract consumed by the OPA prompt-package policy.
- ACO-POLICY-DECISION-001: Given a compiled prompt package, when policy-decision.json is opened, then it exposes the deterministic OPA decision derived from the archived prompt-package.json artifact.

## Failure Behavior

- Compilation fails if acceptance plan or security constraints are missing.
- Compilation fails if archive-time OPA admission denies the archived prompt-package.json.
- Compilation fails with a clear diagnostic and writes no policy-decision.json if OPA is unavailable, OPA evaluation fails, or OPA output is malformed.

## Security Constraints

- Redact secrets, validate all paths before writing, and represent follow-up commands as argv arrays rather than shell-interpolated strings.

## Open Questions

- Should prompt package JSON schema live in a new package or server schemas?
