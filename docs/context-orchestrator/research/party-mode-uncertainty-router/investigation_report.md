# Party Mode Router Implementation Report

## Summary

Implemented and installed a Codex hook router that activates party mode from uncertainty signals, injects investigation context, enforces the configured party-mode policy during tool use, propagates the contract to subagents, and gates final completion on a valid handoff zip.

The router is implemented in `hooks/party_mode_router.py`; hook wiring is in `hooks/hooks.json`; tests are in `tests/test_party_mode_router.py`.

The live user-level install is at `${CODEX_HOME:-$HOME/.codex}/hooks/party_mode_router.py` with hook wiring in `${CODEX_HOME:-$HOME/.codex}/hooks.json`. The hook command resolves the router through `PARTY_MODE_ROUTER`, then `${CODEX_HOME:-$HOME/.codex}/hooks/party_mode_router.py`.

## Implemented behavior

1. `UserPromptSubmit` scores explicit and inferred uncertainty signals, persists per-turn state, and injects party-mode context when the threshold is met.
2. `PreToolUse` denies `apply_patch`, write/edit tools, dependency changes, commits, migrations, generated-code writes, unsafe shell writes, and mutating MCP calls while party mode is active.
3. Artifact writes remain allowed only under `PARTY_MODE_ARTIFACT_DIR` / `./party-mode-output` and the final zip path from `PARTY_MODE_ZIP_PATH` / `./party-mode-output.zip`.
4. `PermissionRequest` denies approval requests that would violate the active party-mode policy.
5. `PostToolUse` adds evidence-capture context and flags possible accidental mutation based on tool identity and output.
6. `SubagentStart` passes the same party-mode contract to delegated agents.
7. `SubagentStop` continues incomplete subagent passes when an artifact-ready finding is missing.
8. `Stop` validates a real zip file and requires `investigation_report.md`, `next_goal.md`, `evidence_manifest.yaml`, `readonly_policy_result.md`, and at least one supporting file under `artifacts/`.

## Key files

| File | Purpose |
|---|---|
| `hooks/party_mode_router.py` | Stateful router and policy gate implementation. |
| `hooks/hooks.json` | Example lifecycle hook wiring for Codex. |
| `tests/test_party_mode_router.py` | Unit tests for activation, denial, subagent context, artifact writes, and stop gate. |
| `schemas/party_mode_state.schema.json` | Persisted party-mode state shape. |
| `artifacts/02_uncertainty_trigger_matrix.yaml` | Activation scoring reference. |
| `artifacts/03_readonly_tool_policy.yaml` | Runtime party-mode policy reference. |
| `examples/config_profile_party_mode.toml` | Optional read-only permission-profile sketch. |

## Verification

Commands run:

```bash
python3 -m py_compile hooks/party_mode_router.py tests/test_party_mode_router.py
python3 -m unittest discover -s tests
python3 -m json.tool hooks/hooks.json
python3 -m json.tool schemas/party_mode_state.schema.json
python3 -m zipfile -l party_mode_uncertainty_router_implementation.zip
```

Additional live-install validation is recorded in `artifacts/09_live_hook_install_validation.md`. Result: all 9 tests passed, JSON files parsed, supported user-level hooks are enabled, and the installed router passed Codex-shaped hook-payload checks for activation, normal non-activation, mutation denial, subagent context, and Stop zip gates.

## Notes

- This package implements the hook router and artifacts, and the router has been installed into the user-level Codex hook directory.
- Runtime party-mode behavior still intentionally blocks source mutation while party mode is active. The implementation work and packaging used normal write permissions.
- Hooks are guardrails, not a full sandbox replacement. A Codex `:read-only` permission profile remains recommended for investigation-only runs.
- Codex builds expose different hook event sets; the environment-specific differences are documented in `artifacts/09_live_hook_install_validation.md`.
