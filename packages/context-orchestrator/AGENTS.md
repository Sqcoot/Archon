# Context Orchestrator Package Instructions

Purpose: ACO routing, compile, ledgers, policy, dossier, approval, target boundary, traceability, and validation.

- Follow SDD/ATDD: specs first, acceptance scenarios next, implementation last.
- Preserve active graph waivers unless the user approves graph refresh or waiver cleanup.
- Avoid commands marked forbidden in the current ACO ledger.
- Validate with `bun run aco:traceability`, targeted acceptance tests, and `bun run aco:test:acceptance` when changing ACO behavior.
- Keep artifacts explicit and machine-readable where downstream agents depend on them.
