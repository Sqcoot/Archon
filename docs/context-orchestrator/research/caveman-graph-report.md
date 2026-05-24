# caveman Graph Evidence

Repository: caveman

Graph status: complete

Clone status: fetched

Branch: main

Commit: 63a91ecadbf4c4719a4602a5abb00883f9966034

Nodes: 276

Edges: 494

Waiver required: no

Graph: research/graphs/caveman/graph.json

Report: research/graphs/caveman/GRAPH_REPORT.md

Metadata: research/graphs/caveman/graph-metadata.json

Error: none

## Evidence Use

Use caveman graph evidence for ACO discovery where this repository is the relevant source. Do not treat this graph as architecture approval by itself; route findings through specs, ADRs, and acceptance tests.

## Artifact Lifecycle

- Consumer: Context Orchestrator ACO research evidence and graph waiver closure checks.
- Source input: `docs/context-orchestrator/research/upstream-manifest.json` and ignored `research/graphs/` graph cache.
- Regeneration command: `bun scripts/research/render-graph-evidence-docs.ts --json` after approved graph evidence refresh.
- Drift/removal policy: update when upstream manifest or graph evidence changes; remove only if Context Orchestrator no longer consumes graph evidence.
- Owner surface: `docs/context-orchestrator/research/README.md` and `context-orchestrator` package research gates.
- Artifact: `caveman-graph-report.md`
