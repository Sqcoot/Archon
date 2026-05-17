# ACO Adversarial Review

Date: 2026-05-17
BMAD action: `bmad-review-adversarial-general`

## Findings

| ID | Severity | Finding | Required response |
| --- | --- | --- | --- |
| AR-001 | high | ACO could become a hidden implementation agent instead of a prompt compiler. | Keep MVP command limited to compile/status/validate. |
| AR-002 | high | Archive writer could leak prompt-provided secrets or target repo `.env` values. | Redaction tests and env leakage acceptance tests required. |
| AR-003 | medium | Context7 library IDs could be hallucinated into prompt packages. | Docs planner must represent unresolved IDs explicitly. |
| AR-004 | medium | Caveman compression could corrupt structured artifacts. | Golden preservation tests required. |
| AR-005 | medium | Adding API/slash/workflow surfaces too early expands blast radius. | ADR 0009 must restrict MVP to CLI. |

## Result

Approved for acceptance test harness after the above responses are represented in ADRs and tests.
