# 011 Command Contract

## Purpose

Define slash command contract candidates.

## Scope

Potential `/context` commands, inputs, outputs, and errors.

## Non-Goals

- Do not implement slash commands until ADR selects the surface.

## Generic Behavior

- Command contract maps user prompt to route, compile, docs, graph, accept, validate, and status operations.

## Archon-Specific Behavior

- If selected, slash commands route through Archon command handler as deterministic top-level commands.

## Inputs

- conversation id
- command name
- arguments
- codebase context

## Outputs

- compact response
- artifact paths
- validation status

## Known Unknowns

- whether slash command is MVP or phase two

## Evidence References

- AGENTS.md
- packages/core/src/handlers

## Acceptance Scenarios

- Given `/context compile <prompt>`, when slash command surface is selected, then output includes archive path and validation status.

## Failure Behavior

- Unknown subcommands return explicit help and do not call AI.

## Security Constraints

- Do not echo secrets or raw env values into chat responses.

## Open Questions

- Should `/context` become a deterministic command or workflow shortcut first?
