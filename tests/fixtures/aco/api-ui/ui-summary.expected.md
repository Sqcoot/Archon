# ACO API/UI Parity

schemaVersion: aco.api-ui-parity-bundle.v1
id: aco.api-ui.s10.parity
status: terminal
readiness: complete-with-approval-gates
nextSlice: null

## Public Surfaces

- GET /api/aco/parity: contractual; readOnly=true
- GET /aco: contractual; readOnly=true

## Workflow Parity

- context-orchestrate: committed; default=context-orchestrate.yaml; nodes=7
- archon-aco-adversarial-loop: committed; default=archon-aco-adversarial-loop.yaml; nodes=6

## Remaining Gates

- bun run aco:role-contracts: deferred
- bun run research:graph: approval-gated
