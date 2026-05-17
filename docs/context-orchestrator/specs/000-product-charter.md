# 000 Product Charter

## Purpose

Define ACO product direction before implementation.

## Scope

ACO as an Archon-native, Codex-focused, generic capability orchestration subsystem.

## Non-Goals

- Do not implement every Archon surface in MVP.
- Do not lock architecture before ADRs.

## Generic Behavior

- Turn a user prompt plus evidence into a spec-backed prompt package.
- Keep core concepts generic: evidence, capabilities, docs plans, routes, acceptance plans, archives.

## Archon-Specific Behavior

- Expose the selected MVP through at least one Archon-native surface.
- Use Archon artifacts and workflow events before considering database migrations.

## Inputs

- user prompt
- target codebase
- graph evidence
- documentation evidence
- BMAD route

## Outputs

- prompt package
- acceptance plan
- validation report
- archive manifest

## Known Unknowns

- first MVP surface
- package boundary
- whether workflow integration is in MVP

## Evidence References

- docs/context-orchestrator/research/graph-evidence-index.md
- docs/context-orchestrator/research/codex-official-docs.md

## Acceptance Scenarios

- Given a user prompt and Archon codebase, when ACO compiles a package, then it includes evidence, docs plan, BMAD route, acceptance criteria, unknowns, and Codex prompt.

## Failure Behavior

- Stop before implementation when required evidence or acceptance criteria are missing.

## Security Constraints

- Never archive target repo secrets.
- Never interpolate raw prompt text into shell commands.

## Open Questions

- Which Archon-native surface is first?
- Which feature subset is MVP?
