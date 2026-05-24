# Research Waivers

No graph waivers required.

## Artifact Lifecycle

- Consumer: Context Orchestrator ACO research evidence and graph waiver closure checks.
- Source input: `docs/context-orchestrator/research/upstream-manifest.json` and ignored `research/graphs/` graph cache.
- Regeneration command: `bun scripts/research/render-graph-evidence-docs.ts --json` after approved graph evidence refresh.
- Drift/removal policy: update when upstream manifest or graph evidence changes; remove only if Context Orchestrator no longer consumes graph evidence.
- Owner surface: `docs/context-orchestrator/research/README.md` and `context-orchestrator` package research gates.
- Artifact: `waivers.md`
