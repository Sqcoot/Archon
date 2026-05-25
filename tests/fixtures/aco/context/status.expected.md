# ACO Context Status

schemaVersion: aco.context-status.v1
id: aco.context.s8.status
readiness: degraded
promptDigest: 496d706c656d656e7420533820636f6e7465787420636f6e7472616374730000
nextSlice: S10 API/UI parity after workflow contracts are committed

## Required Ledgers

- artifact: present (12 rows)
- capability: present (17 rows)
- command: present (12 rows)
- risk: present (8 rows)
- tool: present (10 rows)
- unknowns: present (6 rows)
- workflow: present (5 rows)

## Graph Waiver

status: closed
command: none

## Deferred Surfaces

- bun run aco:role-contracts
- bun run research:graph

## Findings

- 2 surfaces remain deferred or approval-gated
