# 009 Archive Artifact Spec

## Purpose

Define archive files and path safety.

## Scope

Archive layout, manifest, deterministic tests, redaction, policy-decision evidence, and workflow artifact paths.

## Non-Goals

- Do not require database storage for MVP archives.

## Generic Behavior

- ArchiveArtifact stores named files, metadata, checks, redaction status, and validation results.

## Archon-Specific Behavior

- Workflow archives use `$ARTIFACTS_DIR/context-orchestrator/<run-id>/`; CLI MVP may use an ADR-selected Archon-native artifact directory.

## Inputs

- PromptPackage
- runId
- timestamp
- artifact root

## Outputs

- archive directory
- manifest.json
- prompt-package.json
- policy-decision.json
- validation-report.md

## Known Unknowns

- final CLI artifact root
- whether retention policy belongs in MVP

## Evidence References

- docs/context-orchestrator/specs/008-prompt-package-spec.md

## Acceptance Scenarios

- Given an archive path containing `..`, when archive writer validates it, then write is blocked.
- Given a prompt package is archived, when policy validation runs, then OPA evaluates the archived prompt-package.json artifact rather than compiler internals.
- Given OPA returns a valid decision, when archive writing completes, then policy-decision.json is written beside prompt-package.json.
- ACO-POLICY-DECISION-002: Given OPA denies the archived prompt-package.json, when archive admission runs, then policy-decision.json is written and compile/archive validation fails with stable deny codes.

## Failure Behavior

- Fail closed on unsafe paths or redaction failures.
- Fail closed if archive-time OPA admission cannot run, returns malformed output, or returns a denial.

## Security Constraints

- No `.env` values, token-like secrets, or path traversal.

## Open Questions

- Should archives include hashes for every file after the policy-decision artifact proves useful?
