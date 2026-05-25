# Agentic Search Report

schemaVersion: aco.agentic-search-report.v1
id: aco.research.s6.agentic-search

## Objective and Intent Hash

objective: Implement S6 as pure Research and Graphify evidence contracts without implicit mutation.
intentHash: 53363a40617263686f6e2f61636f2d72657365617263683a707572652d657669

## Candidate Implementation Surfaces

- packages/aco-research/src/schemas.ts (@archon/aco-research): Define graph evidence, waiver closure, upstream manifest, and search report schemas.
- packages/aco-research/src/builders.ts (@archon/aco-research): Build deterministic evidence fixtures and fail-closed closure results.
- tests/fixtures/aco/research/ (@archon/aco-research): Preserve complete, failed, waived, not-started, stale, and report golden outputs.

## Candidate Tests and Acceptance Markers

- bun --filter @archon/aco-research test: graph evidence parsing, waiver closure, deterministic report fixtures
- bun x eslint packages/aco-research/src --max-warnings 0 --no-cache: production source imports only local modules, zod, and @archon/aco-core

## Dependency and Context Graph References

- archon: complete, nodes=1842, edges=4130, waiverRequired=false
- bmad-automator: complete, nodes=421, edges=736, waiverRequired=false
- bmad-builder: complete, nodes=612, edges=1104, waiverRequired=false
- bmad-cis: complete, nodes=388, edges=654, waiverRequired=false
- bmad-method: complete, nodes=1290, edges=2610, waiverRequired=false
- bmad-plugins-marketplace: complete, nodes=378, edges=611, waiverRequired=false
- bmad-sample-data: complete, nodes=214, edges=319, waiverRequired=false
- bmad-tea: complete, nodes=535, edges=901, waiverRequired=false
- bmad-ui: complete, nodes=486, edges=844, waiverRequired=false
- bmad-wds: complete, nodes=452, edges=790, waiverRequired=false
- caveman: complete, nodes=153, edges=221, waiverRequired=false
- codex: complete, nodes=9250, edges=21480, waiverRequired=false
- context7: complete, nodes=704, edges=1328, waiverRequired=false

## Evidence Gaps

- Live graph cache freshness cannot be inferred without an explicitly approved graph refresh.

## Disallowed Assumptions

- Do not infer graph freshness from the presence of a report path.
- Do not run network, shell, CLI, or Graphify execution from this package.
- Do not treat markdown as source of truth when JSON evidence exists.

## Recommended Next Slice

id: S7
package: CLI parity
reason: After pure research evidence exists, thin CLI adapters can consume it explicitly.
