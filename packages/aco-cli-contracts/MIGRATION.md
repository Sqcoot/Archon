# @archon/aco-cli-contracts Migration

S7 preserves the ACO/context command surface as contract-backed CLI parity.

This package is intentionally pure. It defines descriptors, safety metadata, result envelopes,
router behavior over injected handlers, renderers, and fixture gates. It does not parse
`process.argv`, write files, run graph refresh, execute workflow code, or call provider/runtime
adapters.

Runtime CLI code must consume these descriptors instead of duplicating command truth. Missing
domain behavior remains a deterministic deferred or approval-required response until later slices
implement context compilation, workflow parity, graph refresh, API/UI, or artifact writers.
