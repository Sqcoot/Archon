# S9 Workflow Parity Contracts

`@archon/aco-workflows` is the S9 contract package for the two workflow-ledger
surfaces that remained deferred after S8:

- `context-orchestrate`
- `archon-aco-adversarial-loop`

The package is intentionally pure. It models workflow manifests, bundled-default
identity, node contracts, approval/deferred requirements, and fail-closed checks
from structured inputs. It does not read files, run workflows, invoke providers,
grant approval, refresh graph evidence, or persist artifacts.

S9 marks workflow parity as contractual and bundled. It leaves API/UI parity,
provider adapters, extension behavior, `bun run aco:role-contracts`, and
approval-gated `bun run research:graph` outside this package.
