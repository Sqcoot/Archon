# Merged Ecosystem Graph Report

Generated: 2026-05-24T03:29:52.817Z

Merge mode: structured summary fallback

Merged graph: research/merged/ecosystem.graph.json

## Graph Inputs

- archon: research/graphs/archon/graph.json (nodes: 1825, edges: 3053, source: tracked index)
- bmad-automator: research/graphs/bmad-automator/graph.json (nodes: 532, edges: 1465, source: tracked index)
- bmad-builder: research/graphs/bmad-builder/graph.json (nodes: 739, edges: 1204, source: tracked index)
- bmad-cis: research/graphs/bmad-cis/graph.json (nodes: 32, edges: 46, source: tracked index)
- bmad-method: research/graphs/bmad-method/graph.json (nodes: 650, edges: 1122, source: tracked index)
- bmad-plugins-marketplace: research/graphs/bmad-plugins-marketplace/graph.json (nodes: 30, edges: 29, source: graph cache)
- bmad-sample-data: research/graphs/bmad-sample-data/graph.json (nodes: 222, edges: 221, source: graph cache)
- bmad-tea: research/graphs/bmad-tea/graph.json (nodes: 95, edges: 150, source: tracked index)
- bmad-ui: research/graphs/bmad-ui/graph.json (nodes: 413, edges: 468, source: tracked index)
- bmad-wds: research/graphs/bmad-wds/graph.json (nodes: 70, edges: 119, source: tracked index)
- caveman: research/graphs/caveman/graph.json (nodes: 276, edges: 494, source: tracked index)
- codex: research/graphs/codex/graph.json (nodes: 39183, edges: 113352, source: tracked index)
- context7: research/graphs/context7/graph.json (nodes: 306, edges: 589, source: tracked index)

## Artifact Lifecycle

- Consumer: Context Orchestrator ACO research evidence and graph waiver closure checks.
- Source input: ignored `research/graphs/` graph cache and tracked graph evidence reports under `docs/context-orchestrator/research/`.
- Regeneration command: `bun scripts/research/merge-graphs.ts --json` after approved graph evidence refresh.
- Drift/removal policy: update when upstream graph evidence changes; remove only if Context Orchestrator no longer consumes merged ecosystem graph evidence.
- Owner surface: `docs/context-orchestrator/research/README.md` and `context-orchestrator` package research gates.
