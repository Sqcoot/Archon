# ACO Ledgers Migration Note

S3 originally kept `archon context ledgers [prompt]` out of CLI wiring; the preserved surface is now
`archon context ledgers [prompt] [--no-write-artifact]`, with default scoped artifact writes captured in
`@archon/aco-ledgers`.

Future `packages/context-orchestrator/src/ledgers.ts` should call `buildLedgerBundle` for pure
normalization and `ledgerFixtureParityGate` for compatibility checks, then adapt the resulting
`aco.ledger-bundle.v1` data into CLI, artifact, workflow, server, or UI surfaces in a later slice.

The copied oracle CSVs contain 70 data rows: artifact=12, capability=17, command=12, risk=8,
tool=10, unknowns=6, workflow=5. S3 treats that derived total as authoritative for parity.
