# Context Orchestrator Status Demo Script

## Purpose

Show how Context Orchestrator status exposes approval-required graph readiness without claiming complete graph coverage.

## Demo Flow

1. Open the Context Orchestrator page for the selected registered project.
2. Confirm the status says `Needs approval`.
3. Confirm validation is `passed`, graph is `forbidden`, schema is `aco.ledger-bundle.v1`, and combined ledger totals are total `39` with graph-derived rows counted as `forbidden`, not `partial`.
4. Copy or inspect the forbidden graph confidence limits:
   - `graph-waiver.bmad-plugins-marketplace`
   - `graph-waiver.bmad-sample-data`
5. Open a workflow run detail page for the same registered project.
6. Confirm the workflow detail Context Orchestrator snapshot reports the same validation, graph, waiver, schema, and ledger-count evidence.
7. Copy the PR/handoff narrative and verify it repeats the same readiness evidence.

## Traceability

| Visible claim | Source field | Acceptance |
| --- | --- | --- |
| `Needs approval` | `readiness`, `approvalRequired`, `graphStatus`, `graphWaivers` | AC-P1-WEB, AC-P3-WF, AC-P2-DEMO |
| Validation passed | `validationStatus` | AC-P1-CLI, AC-P1-API, AC-P1-WEB |
| Graph forbidden | `graphStatus` | AC-P1-CLI, AC-P1-API, AC-P3-PR |
| Forbidden graph confidence limits | `graphWaiverIds` | AC-P3-WF, AC-P3-PR, AC-P2-DEMO |
| Ledger schema and counts | `ledgerSchemaVersion`, `ledgerSummary.combined` | AC-P1-CLI, AC-P1-API, AC-P3-WF |

## What This Proves

- Context Orchestrator validation passed for the selected repository state.
- Context Orchestrator graph readiness needs approval because failed waiver-required graph evidence remains unresolved.
- Context Orchestrator has a first-class status surface in CLI, API, Web, workflow detail, and PR/handoff text.
- The same canonical evidence is reused across surfaces.
- The two graph waivers are forbidden graph confidence limits and remain visible.

## What This Does Not Prove

- It does not prove complete graph coverage.
- It does not prove full marketplace/plugin graph certainty.
- It does not prove sample data is fully modeled.
- It does not prove production CI enforcement.
- It does not clean up or regenerate the forbidden graph waivers.
- It does not mean validation failed; the forbidden state is specific to graph readiness.
