# ACO Source Disposition

This document records the branch-level disposition for source synchronization artifacts that were intentionally not copied wholesale into the target branch.

Lifecycle:

- Consumer: final ACO handoff, code review, and future source synchronization work.
- Source input: `git diff --name-status` between the baseline, target, and source synchronization branches plus party-mode reviewer outputs.
- Regeneration command: rerun the branch comparisons and update this document when source synchronization scope changes.
- Drift/removal policy: remove an entry only when the related source artifact is ported, replaced by a committed target artifact, or explicitly falls out of ACO scope.
- Owner surface: `packages/context-orchestrator`, `.archon/commands/defaults`, `.archon/workflows/defaults`, and root validation scripts.

## Ported

| Source area | Target evidence | Disposition |
| --- | --- | --- |
| Context Orchestrator package and validation gates | `packages/context-orchestrator`, `scripts/context-orchestrator`, `bun run aco:gates:test` | Ported as repo-native package behavior. |
| CLI, API, Web, and slash surfaces | `packages/cli/src/commands/context.ts`, `packages/server/src/routes/api.ts`, `packages/web/src/routes/AcoStatusPage.tsx`, `packages/core/src/handlers/command-handler.ts` | Ported as native ACO coordination surfaces. |
| ACO workflow defaults | `.archon/workflows/defaults/context-orchestrate.yaml`, `.archon/workflows/defaults/archon-aco-adversarial-loop.yaml`; workflow provider override `--provider codex` | Ported with hardened workflow validation, explicit approval gates, and a canonical ACO closure path that can run under Codex without a Codex-named workflow fork or unsupported Codex tool-restriction claims. |
| SDD/ATDD traceability and selected acceptance | `docs/context-orchestrator/specs/traceability/aco-traceability.json`, `tests/acceptance/context-orchestrator` | Ported as selected enforced acceptance for API, slash, workflow, events, and traceability. |
| Active graph waiver evidence | `docs/context-orchestrator/research/upstream-manifest.json`, `docs/context-orchestrator/research/waivers.md` | Ported to preserve named waiver state without graph refresh or waiver cleanup. |

## Rejected

| Source area | Reason | Evidence |
| --- | --- | --- |
| Branch-local goal command | It overlaps Codex session control and would create confusing runtime semantics in bundled Archon commands. | Omitted from `.archon/commands/defaults`; `bun run cli validate commands --json` passed after bundled regeneration. |
| Live provider or user-local config edits | Trust-sensitive settings must remain user controlled or be proposed as inert artifacts. | No `.codex/hooks.json`, `.claude/settings.json`, provider auth, or MCP config mutation was ported. |
| Generated graph refresh outputs | Graph refresh and waiver cleanup require explicit approval and were outside the safe autonomous scope. | Waiver manifest and notes were preserved instead. |

## Deferred

| Source area | Reason | Next evidence required |
| --- | --- | --- |
| Full AI-layer bootstrap commands and workflow | They are broader than ACO slice completion and include policy-sensitive branch, goal, and end-goal control. | Separate design decision plus command/workflow validation for each promoted default. |
| Full research corpus and research scripts | Research refresh can fetch network data and write generated artifacts. | Explicit approval, lifecycle metadata, and a green research validation path. |
| Full source acceptance corpus | The source branch contains many acceptance files beyond the target product slice. | Promote additional IDs into `aco-traceability.json` only when the related product behavior is selected for target branch support. |
| Native BMAD workflow catalog | Target branch supports BMAD advisory routing, not a native BMAD workflow catalog. | A scoped BMAD implementation plan and validation for bundled workflow/command defaults. |

## Final Scope Decision

The target branch scope is the repo-native ACO coordination slice: package behavior, CLI/API/Web/slash surfaces, selected workflows, selected acceptance, policy, traceability, and preserved graph waiver evidence. Broader AI-layer bootstrap and full research parity remain deferred until they receive a separate product decision and validation contract.
