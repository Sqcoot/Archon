# Context Orchestrator Research Evidence

This directory contains committed research evidence that the ACO runtime reads as source data. It is not a scratch artifact directory.

Lifecycle:

- Consumer: `getGraphContext({ cwd })`, ACO status/ledger output, approval capsule generation, and final readiness handoff.
- Source input: upstream graph and waiver evidence produced during the STAB synchronization pass, then copied into this branch only where needed to preserve active graph waiver state.
- Regeneration command: do not regenerate during ordinary validation. Run research or graph refresh commands only after explicit approval, then rerun `bun run cli context status --cwd . --json` and `bun run validate`.
- Drift/removal policy: keep waiver entries until graph evidence is regenerated successfully or the related repository is removed from the required ACO evidence set. Do not remove waivers as cleanup.
- Owner surface: `packages/context-orchestrator/src/graph.ts`, `packages/context-orchestrator/src/ledgers.ts`, and `docs/context-orchestrator/source-disposition.md`.

Current committed files:

- `upstream-manifest.json`: pinned upstream graph metadata and named waiver state consumed by `getGraphContext({ cwd })`.
- `waivers.md`: human-readable waiver rationale, impact, and follow-up conditions.
