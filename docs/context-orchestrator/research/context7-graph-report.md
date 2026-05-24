# context7 Graph Evidence

Repository: context7

Graph status: complete

Clone status: fetched

Branch: master

Commit: 61de754d48e57d5c22dadd4540a74203fd55ecf1

Nodes: 306

Edges: 589

Waiver required: no

Graph: research/graphs/context7/graph.json

Report: research/graphs/context7/GRAPH_REPORT.md

Metadata: research/graphs/context7/graph-metadata.json

Error: none

## Evidence Use

Use context7 graph evidence for ACO discovery where this repository is the relevant source. Do not treat this graph as architecture approval by itself; route findings through specs, ADRs, and acceptance tests.

## Artifact Lifecycle

- Consumer: Context Orchestrator ACO research evidence and graph waiver closure checks.
- Source input: `docs/context-orchestrator/research/upstream-manifest.json` and ignored `research/graphs/` graph cache.
- Regeneration command: `bun scripts/research/render-graph-evidence-docs.ts --json` after approved graph evidence refresh.
- Drift/removal policy: update when upstream manifest or graph evidence changes; remove only if Context Orchestrator no longer consumes graph evidence.
- Owner surface: `docs/context-orchestrator/research/README.md` and `context-orchestrator` package research gates.
- Artifact: `context7-graph-report.md`
