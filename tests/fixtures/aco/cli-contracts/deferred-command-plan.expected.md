# ACO Command Plan

command: bun run aco:role-contracts
id: bun.aco.role-contracts
surface: script
owner: aco-gates
status: deferred
mutates: read-only
safety: read-only
approvalRequired: false
outputModes: text, json

## Arguments

- none

## Options

- none

## S7 Boundary

- Deferred in S7; command is discoverable but returns a stable nonzero diagnostic.
