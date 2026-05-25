# Party Mode Router Verification Handoff

This package is a fresh-session verification handoff for the party-mode uncertainty router implementation pack.

It is intentionally not an installer and not an execution script. During generation, do not install hooks, run the router, run the router tests, or mutate application source. The fresh session that receives this package should inspect the target repository or implementation pack, run the verification commands later, and report whether the router behavior matches the intended party-mode uncertainty routing contract.

## Target Implementation Pack

Use this repo-relative target by default:

```text
docs/context-orchestrator/research/party-mode-uncertainty-router/
```

Expected implementation zip:

```text
docs/context-orchestrator/research/party-mode-uncertainty-router/party_mode_uncertainty_router_implementation.zip
```

Observed generation metadata:

```yaml
observed_branch: codex/aco-stabilization-slices
observed_commit: a4c6fedc
metadata_role: evidence_only
```

If the fresh session works from another checkout, use the same repo-relative paths from that checkout root. Do not hard-code user-local paths. Prefer `PARTY_MODE_STATE_DIR`, `PARTY_MODE_ARTIFACT_DIR`, and `PARTY_MODE_ZIP_PATH` for runtime path overrides.

## Files In This Handoff

- `verification_goal.md` - bounded goal for the fresh session.
- `implementation_expectations.yaml` - machine-readable expected behavior by hook event.
- `artifact_inventory.yaml` - expected implementation-pack files to inspect.
- `verification_checklist.md` - human verification checklist.
- `fresh_session_prompt.md` - prompt to paste into a new chat with this zip attached.
- `expected_findings_report.md` - findings report template.
- `commands_to_run.md` - commands the fresh session may run later.

## Generation-Time Rule

The task that generated this package should only create these handoff files and the zip. It should not prove the router correct. Proof belongs to the fresh verification session.
