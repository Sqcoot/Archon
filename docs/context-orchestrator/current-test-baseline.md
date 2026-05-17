# Current Test Baseline

Date: 2026-05-17

## Passed

- `bun run test`
- `bun run type-check`
- `bun run build`
- `bun run lint`
- `bun run format:check`
- `bun run research:validate-corpus`
- `bun run research:validate-sdd`
- `bun run cli doctor`
- `bun run cli workflow list --cwd .`
- `bun run cli validate commands --cwd .`

## Failed

- `bun run cli validate workflows --cwd .`

Failure:

```text
archon-smart-pr-review ERRORS
ERROR [mcp] Node 'notify': MCP config file not found: '.archon/mcp/ntfy.json'
```

Interpretation:

The failing workflow has an optional push-notification node gated by a `check-ntfy` node. The validator currently checks the `mcp:` path without evaluating that runtime guard. Treat this as a baseline workflow-validation waiver until the workflow or validator handles optional MCP configs explicitly.

## Local Determinism Fix

`packages/workflows/src/validator.test.ts` now sets `ARCHON_HOME` to a temporary empty directory for general validator tests. This prevents user-level `~/.archon/commands` from leaking into tests that are meant to exercise repo-only command discovery, while preserving the dedicated home-scoped command tests.

## Research Validation

Research corpus validation passed. Graph waivers remain for:

- `bmad-plugins-marketplace`
- `bmad-sample-data`

Both are recorded in `docs/context-orchestrator/research/waivers.md` and `docs/context-orchestrator/research/upstream-manifest.json`.
