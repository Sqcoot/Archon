# archon Graph Evidence

Repository: archon

Graph status: complete

Clone status: fetched

Branch: dev

Commit: 7bdf931aad5adecc862c30f54584ede8d8c86a21

Nodes: 1825

Edges: 3053

Waiver required: no

Graph: research/graphs/archon/graph.json

Report: research/graphs/archon/GRAPH_REPORT.md

Metadata: research/graphs/archon/graph-metadata.json

Error: none

## Evidence Use

Use archon graph evidence for ACO discovery where this repository is the relevant source. Do not treat this graph as architecture approval by itself; route findings through specs, ADRs, and acceptance tests.

## Artifact Lifecycle

- Consumer: Context Orchestrator ACO research evidence and graph waiver closure checks.
- Source input: `docs/context-orchestrator/research/upstream-manifest.json` and ignored `research/graphs/` graph cache.
- Regeneration command: `bun scripts/research/render-graph-evidence-docs.ts --json` after approved graph evidence refresh.
- Drift/removal policy: update when upstream manifest or graph evidence changes; remove only if Context Orchestrator no longer consumes graph evidence.
- Owner surface: `docs/context-orchestrator/research/README.md` and `context-orchestrator` package research gates.
- Artifact: `archon-graph-report.md`
