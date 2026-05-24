# BMAD Graph Evidence

BMAD evidence is aggregated across the BMAD method, module, testing, automation, UI, and sample-data upstreams.

| Repository | Graph status | Commit | Nodes | Edges | Waiver required |
| --- | --- | --- | ---: | ---: | --- |
| bmad-method | complete | 71136bc6af77 | 650 | 1122 | no |
| bmad-cis | complete | 0a3413af3a4d | 32 | 46 | no |
| bmad-wds | complete | 35500f44eb44 | 70 | 119 | no |
| bmad-builder | complete | 3410d952eafe | 739 | 1204 | no |
| bmad-plugins-marketplace | complete | 9a4b2371004f | 30 | 29 | no |
| bmad-tea | complete | 34a242c1379a | 95 | 150 | no |
| bmad-sample-data | complete | ebc678d11367 | 222 | 221 | no |
| bmad-automator | complete | 956198ca52bb | 532 | 1465 | no |
| bmad-ui | complete | ff3e33c7bfd6 | 413 | 468 | no |

## Evidence Use

Use this evidence to choose BMAD routing, assumption gates, ATDD traceability expectations, and correct-course triggers. Failed or waived graph entries remain evidence gaps, not blockers unless an architecture decision depends on them.

## Artifact Lifecycle

- Consumer: Context Orchestrator ACO research evidence and graph waiver closure checks.
- Source input: `docs/context-orchestrator/research/upstream-manifest.json` and ignored `research/graphs/` graph cache.
- Regeneration command: `bun scripts/research/render-graph-evidence-docs.ts --json` after approved graph evidence refresh.
- Drift/removal policy: update when upstream manifest or graph evidence changes; remove only if Context Orchestrator no longer consumes graph evidence.
- Owner surface: `docs/context-orchestrator/research/README.md` and `context-orchestrator` package research gates.
- Artifact: `bmad-graph-report.md`
