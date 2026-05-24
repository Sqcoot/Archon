# Research Waivers

## bmad-plugins-marketplace

Status: failed

Owner: ACO corrective-slice audit

Date: 2026-05-17

Repository: `research/upstreams/bmad-plugins-marketplace`

Pinned commit: `9a4b2371004ff0ef398ce4d37076c33aa69cd052`

Failing command: `bun run research:graph`

Observed failure: Graphify did not produce usable graph output for this repository. The upstream manifest recorded `Nothing to update or rebuild failed — check output above.`

Impact: BMAD marketplace distribution evidence is weaker than desired for architecture decisions that depend on plugin registry or marketplace packaging details.

Why non-blocking for CLI MVP: ADR 0009 limits the first milestone to CLI route/compile/status/validate behavior. The CLI MVP does not implement BMAD marketplace publishing, plugin registry integration, or module distribution behavior.

Follow-up condition: Re-run `bun run research:graph` after Graphify or repository-content issues are resolved. Remove this waiver only when `research/graphs/bmad-plugins-marketplace/GRAPH_REPORT.md`, `graph.json`, and `graph-metadata.json` are produced and referenced by the evidence index.

Graph path: research/graphs/bmad-plugins-marketplace/graph.json

## bmad-sample-data

Status: failed

Owner: ACO corrective-slice audit

Date: 2026-05-17

Repository: `research/upstreams/bmad-sample-data`

Pinned commit: `ebc678d11367a355227c4dcfbb0ad2a1777b11ca`

Failing command: `bun run research:graph`

Observed failure: Graphify did not produce usable graph output for this repository. The upstream manifest recorded `Nothing to update or rebuild failed — check output above.`

Impact: Route and acceptance-test fixture evidence is weaker than desired for future BMAD sample-data-driven route validation.

Why non-blocking for CLI MVP: The first milestone already has deterministic route, compile, archive, and security acceptance tests. The CLI MVP does not require sample-data corpus automation to expose the selected Archon-native surface.

Follow-up condition: Re-run `bun run research:graph` after Graphify or repository-content issues are resolved. Remove this waiver only when `research/graphs/bmad-sample-data/GRAPH_REPORT.md`, `graph.json`, and `graph-metadata.json` are produced and referenced by the evidence index.

Graph path: research/graphs/bmad-sample-data/graph.json
