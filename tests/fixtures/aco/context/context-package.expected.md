# ACO Context Package

schemaVersion: aco.context-package.v1
id: aco.context.s8.context-package
promptDigest: 496d706c656d656e7420533820636f6e7465787420636f6e7472616374730000
contextDigest: 61636f2e636f6e746578742d7061636b6167652e76317c61636f2e636f6e7465
selectedRoute: archon context compile <prompt>

## Ledger Summaries

- artifact: present (12 rows)
- capability: present (17 rows)
- command: present (12 rows)
- risk: present (8 rows)
- tool: present (10 rows)
- unknowns: present (6 rows)
- workflow: present (5 rows)

## Graph State

status: closed
command: none

## Role Constraints

- generators cannot claim goal completion
- evaluator verdicts are required for completion claims
- workflow completion claims require S9 workflow contract evidence

## Capability Constraints

- research graph refresh requires explicit approval
- artifact persistence is not implemented in S8
- provider/runtime behavior is outside the context package

## Approval Requirements

- bun run research:graph: required=true scope=network, writes-graph-cache

## Deferred Items

- bun run aco:role-contracts remains deferred
- bun run research:graph remains approval-required
