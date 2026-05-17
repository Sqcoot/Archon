# 003 Evidence Model

## Purpose

Define how ACO records evidence before decisions.

## Scope

Evidence sources, packets, references, trust level, waivers, and unknowns.

## Non-Goals

- Do not treat evidence as proof when it is indirect.
- Do not require all evidence for all routes.

## Generic Behavior

- EvidencePacket records source, capture time, trust, summary, paths, and limitations.
- Waivers are explicit evidence gaps, not silent success.

## Archon-Specific Behavior

- Archon stores evidence in artifacts for MVP and may emit workflow events for evidence milestones.

## Inputs

- manifest
- graph reports
- docs MCP outputs
- source files
- validation output

## Outputs

- EvidencePacket
- waiver records
- open questions

## Known Unknowns

- whether evidence JSON becomes public API
- best traceability format

## Evidence References

- docs/context-orchestrator/research/upstream-manifest.json
- docs/context-orchestrator/research/waivers.md

## Acceptance Scenarios

- Given a required upstream graph fails, when evidence is indexed, then a waiver is recorded with status, reason, and path.

## Failure Behavior

- Missing controlling evidence blocks architecture approval.

## Security Constraints

- Evidence must not include secrets, `.env` values, or credentials.

## Open Questions

- Should graph evidence be summarized per route or globally per run?
