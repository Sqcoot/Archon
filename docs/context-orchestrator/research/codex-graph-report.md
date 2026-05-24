# codex Graph Evidence

Repository: codex

Graph status: complete

Clone status: fetched

Branch: main

Commit: e7bffc5a20e92cbc64d6c16a1b257d0b2e4cd5df

Nodes: 39183

Edges: 113352

Waiver required: no

Graph: research/graphs/codex/graph.json

Report: research/graphs/codex/GRAPH_REPORT.md

Metadata: research/graphs/codex/graph-metadata.json

Error: none

## Evidence Use

Use codex graph evidence for ACO discovery where this repository is the relevant source. Do not treat this graph as architecture approval by itself; route findings through specs, ADRs, and acceptance tests.

## Artifact Lifecycle

- Consumer: Context Orchestrator ACO research evidence and graph waiver closure checks.
- Source input: `docs/context-orchestrator/research/upstream-manifest.json` and ignored `research/graphs/` graph cache.
- Regeneration command: `bun scripts/research/render-graph-evidence-docs.ts --json` after approved graph evidence refresh.
- Drift/removal policy: update when upstream manifest or graph evidence changes; remove only if Context Orchestrator no longer consumes graph evidence.
- Owner surface: `docs/context-orchestrator/research/README.md` and `context-orchestrator` package research gates.
- Artifact: `codex-graph-report.md`
