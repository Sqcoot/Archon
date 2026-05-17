# 002 Capability Model

## Purpose

Define generic capability routing before implementation.

## Scope

Capability registry, availability, route selection, and capability evidence.

## Non-Goals

- Do not hardcode every future capability.
- Do not make Graphify or Context7 mandatory for all prompts.

## Generic Behavior

- A Capability describes a named ability, requirements, optional dependencies, output contracts, and safety constraints.
- A CapabilityRoute selects only capabilities needed for the prompt.

## Archon-Specific Behavior

- Archon adapters expose capabilities through chosen CLI, command, workflow, or API surfaces.
- Provider and workflow details stay outside the generic core.

## Inputs

- prompt intent
- graph readiness
- docs readiness
- BMAD route
- user flags

## Outputs

- CapabilityRegistry
- CapabilityRoute
- selected capability report

## Known Unknowns

- initial registry implementation host
- runtime extension mechanism

## Evidence References

- docs/context-orchestrator/research/graph-evidence-index.md

## Acceptance Scenarios

- Given a prompt does not need graph evidence, when ACO routes capabilities, then Graphify is optional-skipped instead of required.

## Failure Behavior

- Unsupported required capabilities produce explicit blockers.

## Security Constraints

- Capabilities must declare whether they can read files, write files, call tools, or emit prompts.

## Open Questions

- Should capabilities be data-only JSON or TypeScript objects in MVP?
