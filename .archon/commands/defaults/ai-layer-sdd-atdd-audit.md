---
description: Audit SDD and ATDD branch conventions before AI-layer implementation
argument-hint: <ai-layer bootstrap request>
---

# AI Layer SDD/ATDD Audit

Request: $ARGUMENTS

## Goal Check

Read required artifacts from `$ARTIFACTS_DIR/ai-layer`: `goal.md`, `goal.json`, `branch-gate.json`, `artifact-registry.json`, and `status.json`.

Own only SDD/ATDD discovery and branch-alignment evidence.

## Required Work

1. Search the Archon checkout for SDD, ATDD, acceptance, scenario, specification, spec, requirements, stabilization, and alignment.
2. Inspect relevant specs, ADRs, traceability manifests, acceptance tests, workflow definitions, and validation scripts.
3. Identify the exact validation commands for SDD/ATDD.
4. Record which files must not be changed casually.
5. Write `$ARTIFACTS_DIR/ai-layer/sdd-atdd-audit.md`.
6. Update `$ARTIFACTS_DIR/ai-layer/status.json`.

## Guardrails

- Do not edit SDD/ATDD files in this node.
- Preserve active ACO graph waivers unless separately approved.

## Output

End with:
- status
- artifacts written
- acceptance criteria satisfied
- blockers
- next recommended node
- whether retry is needed
