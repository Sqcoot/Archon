# Party Mode Uncertainty Handoff Pack

This pack treats **party mode** as the entry point for uncertainty: a read-only investigation router that can delegate to tools, subagents, research, docs, adapters, manifests, ledgers, graphing, and other project machinery without editing source code.

The intended operating pattern is:

1. Detect uncertainty as early as possible, usually at `UserPromptSubmit`.
2. Activate a read-only investigation context with an explicit end condition.
3. Guard tool calls with `PreToolUse` / `PermissionRequest` so party mode does not mutate code.
4. Review outputs with `PostToolUse` and continue unfinished investigations with `Stop` / `SubagentStop`.
5. End by producing a zip that contains the investigation report, evidence artifacts, and one next implementation goal.

## Contents

- `artifacts/01_goal_end_condition_4000_chars.md` — the concise end condition to pass to the investigator.
- `artifacts/02_uncertainty_trigger_matrix.yaml` — signals that should activate party mode.
- `artifacts/03_readonly_tool_policy.yaml` — allowed and denied actions during investigation.
- `artifacts/04_investigation_manifest_template.yaml` — what evidence to collect.
- `artifacts/05_output_report_template.md` — final report shape.
- `artifacts/06_next_goal_template.md` — implementation handoff goal shape.
- `artifacts/07_party_mode_integration_design.md` — architecture and hook placement.
- `hooks/hooks.json` — example Codex hook config.
- `hooks/party_mode_router.py` — sample hook script for uncertainty detection and read-only enforcement.
- `schemas/party_mode_state.schema.json` — small schema for persisted hook state.
- `prompts/party_mode_investigation_prompt.md` — prompt to start a read-only party-mode run.
- `examples/expected_output_tree.txt` — expected output zip contents from an investigation run.

## Installation status

The router has been installed for this Codex user:

- `${CODEX_HOME:-$HOME/.codex}/hooks/party_mode_router.py`
- `${CODEX_HOME:-$HOME/.codex}/hooks.json`

The hook command is portable: it uses `PARTY_MODE_ROUTER` when set, otherwise `${CODEX_HOME:-$HOME/.codex}/hooks/party_mode_router.py`.

Trust status and live validation are recorded in `artifacts/09_live_hook_install_validation.md`.

## Installation sketch

Copy `hooks/party_mode_router.py` to a trusted hook location, wire it from `hooks/hooks.json`, review it with `/hooks`, then run party-mode investigations under a read-only or restricted profile. Prefer user-level hooks or managed hooks if project-local `.codex/` is protected.

Use the optional profile sketch in `examples/config_profile_party_mode.toml` to select Codex's built-in `:read-only` permission profile when your installed version supports permission profiles. Hooks are enabled by default in current Codex builds, but the router still expects review/trust through `/hooks` before a non-managed command hook runs.

By default, the router writes small per-turn state under `~/.local/state/codex-party-mode`, writes party-mode artifacts under `./party-mode-output`, and expects a final `./party-mode-output.zip`. Override these paths with:

- `PARTY_MODE_STATE_DIR`
- `PARTY_MODE_ARTIFACT_DIR`
- `PARTY_MODE_ZIP_PATH`

Useful control switches:

- `PARTY_MODE=force` activates party mode for a run.
- `PARTY_MODE=off` disables party-mode enforcement for a run.
- `PARTY_MODE_THRESHOLD=NUMBER` changes uncertainty activation threshold.

## Verification

Run:

```bash
python3 -m unittest discover -s tests
```

Covered checks:

- Explicit party-mode prompts inject read-only context.
- Normal low-risk prompts do not activate strict mode.
- `sed -i`, `apply_patch`, and mutating MCP calls are denied while active.
- Artifact-only writes are allowed.
- `SubagentStart` receives the read-only contract.
- `Stop` blocks missing handoff zips and allows valid complete zips.

This pack is a hook implementation/handoff artifact. Installing the hook into a live user or project config is a separate trust decision.
