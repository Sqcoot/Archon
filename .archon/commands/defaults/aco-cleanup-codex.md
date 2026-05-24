---
description: Dry-run or apply cleanup for ACO-owned Codex bootstrap and hook-smoke artifacts
argument-hint: '--run-id <runId> [--manifest path] [--dry-run|--apply] [--json]'
---

# ACO Cleanup Codex

Remove only ACO-owned files listed in a cleanup manifest for one run.

Canonical slash usage:

```bash
/aco:cleanup-codex --run-id aco-bootstrap-codex-20260524 --dry-run
/aco:cleanup-codex --run-id aco-bootstrap-codex-20260524 --apply --json
```

CLI usage:

```bash
archon aco cleanup-codex --run-id aco-bootstrap-codex-20260524 --dry-run --json
archon aco cleanup-codex --run-id aco-bootstrap-codex-20260524 --apply --json
archon aco cleanup codex --run-id aco-bootstrap-codex-20260524 --apply
```

## Contract

- Defaults to `--dry-run`.
- Deletes only manifest entries with `ownedBy: "aco"` and matching `runId`.
- Refuses auth, active Codex config, MCP OAuth, provider credentials, graph evidence, graph waivers, unmanaged `.codex` files, and files outside cwd after symlink resolution.
- Running `--apply` twice must succeed; second run is a no-op.
- Emits planned, deleted, skipped, refused, before/after digest, and cleanup ledger row evidence.
