# ACO API/UI Parity Migration

S10 closes the first-principles rewrite at the public API/UI boundary.

This package is pure contract code. It summarizes committed S1-S9 ACO
packages, workflow parity, context parity, command coverage, and the two
remaining approval/deferred gates without reading files, executing workflows,
calling providers, or running server/browser code.

`@archon/server` may expose the bundle through a read-only route, and
`@archon/web` may render it through a compact parity view. Runtime behavior,
research graph execution, role-contract script implementation, providers,
adapters, graph cache writes, and artifact persistence remain outside S10.
