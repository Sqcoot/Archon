# ACO Workflow Parity

schemaVersion: aco.workflow-parity-bundle.v1
id: aco.workflows.s9.workflow-parity
status: contractual
nextSlice: S10 API/UI parity after workflow contracts are committed

## Workflows

- context-orchestrate: contractual; nodes=7; default=context-orchestrate.yaml
- archon-aco-adversarial-loop: contractual; nodes=6; default=archon-aco-adversarial-loop.yaml

## Deferred Commands

- bun run aco:role-contracts: deferred

## Approval Required Commands

- bun run research:graph: approval-required
