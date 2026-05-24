# Graph Open Questions

- Does Graphify structured-summary merge provide enough cross-repository evidence, or does the architecture phase need a deeper Graphify merge run?
- Which ACO MVP surface should be chosen after SDD specs and ADR evidence: CLI, slash command, workflow, API, or a staged combination?
- Which third-party dependencies discovered in graph evidence need Context7 library ID resolution before implementation?

## Artifact Lifecycle

- Consumer: Context Orchestrator ACO research evidence and graph waiver closure checks.
- Source input: `docs/context-orchestrator/research/upstream-manifest.json` and ignored `research/graphs/` graph cache.
- Regeneration command: `bun scripts/research/render-graph-evidence-docs.ts --json` after approved graph evidence refresh.
- Drift/removal policy: update when upstream manifest or graph evidence changes; remove only if Context Orchestrator no longer consumes graph evidence.
- Owner surface: `docs/context-orchestrator/research/README.md` and `context-orchestrator` package research gates.
- Artifact: `graph-open-questions.md`
