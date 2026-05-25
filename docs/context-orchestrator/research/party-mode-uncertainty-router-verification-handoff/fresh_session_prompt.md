# Fresh Session Prompt

Use this prompt in a new chat session with this verification handoff zip attached.

```text
You are verifying the party-mode uncertainty router implementation pack.

Goal: inspect the target repository or attached implementation pack and determine whether the router is truly implemented as intended. Use the verification handoff files as the source of expected behavior.

Target implementation pack, repo-relative default:
docs/context-orchestrator/research/party-mode-uncertainty-router/

Important rules:
- Verify behavior; do not assume it is correct.
- Do not install hooks into a live user or project config.
- Do not edit the router implementation unless explicitly asked in a later implementation goal.
- Use temporary directories for PARTY_MODE_STATE_DIR, PARTY_MODE_ARTIFACT_DIR, and PARTY_MODE_ZIP_PATH.
- Run only the verification commands needed to collect evidence.
- Produce a findings report using expected_findings_report.md.

Required checks:
- Confirm expected implementation artifacts exist.
- Confirm hook config and schema parse.
- Confirm explicit and inferred uncertainty activation.
- Confirm normal low-risk prompts do not activate strict mode.
- Confirm mutating shell/tool/MCP requests are denied during party mode.
- Confirm artifact-dir and final-zip writes are allowed.
- Confirm PostToolUse evidence guidance and accidental-mutation warning behavior.
- Confirm SubagentStart/SubagentStop read-only contract behavior.
- Confirm Stop blocks incomplete final handoff zips and accepts a complete final zip.
- Confirm reusable artifacts are generic and path-portable.

Report pass/fail by event, cite evidence, list deviations, assign risk, and recommend exactly one next goal if anything is incomplete.
```
