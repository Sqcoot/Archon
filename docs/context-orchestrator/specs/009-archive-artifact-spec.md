# 009 Archive Artifact Spec

## Purpose

Define archive files and path safety.

## Scope

Archive layout, manifest, deterministic tests, redaction, and workflow artifact paths.

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
- validation-report.md

## Known Unknowns

- final CLI artifact root
- whether retention policy belongs in MVP

## Evidence References

- docs/context-orchestrator/specs/008-prompt-package-spec.md

## Acceptance Scenarios

- Given an archive path containing `..`, when archive writer validates it, then write is blocked.

## Failure Behavior

- Fail closed on unsafe paths or redaction failures.

## Security Constraints

- No `.env` values, token-like secrets, or path traversal.

## Open Questions

- Should archives include hashes for every file in MVP?
