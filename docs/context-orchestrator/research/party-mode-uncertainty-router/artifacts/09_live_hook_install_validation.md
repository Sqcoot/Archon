# Live Hook Install Validation

## Install target

- Router installed at `${CODEX_HOME:-$HOME/.codex}/hooks/party_mode_router.py`.
- User hook config updated at `${CODEX_HOME:-$HOME/.codex}/hooks.json`.
- Party-mode hook commands resolve the router through `PARTY_MODE_ROUTER`, then `${CODEX_HOME:-$HOME/.codex}/hooks/party_mode_router.py`.
- Existing caveman `SessionStart` hook preserved.
- Backups created:
  - `${CODEX_HOME:-$HOME/.codex}/hooks.json.party-mode-backup-20260524-204843`
  - `${CODEX_HOME:-$HOME/.codex}/config.toml.party-mode-backup-20260524-204843`

## Installed file hashes

```text
697400fa8ecf15280d2905dd9ca61dd50a4a85476b5b7d6d2cc310e650f29e0d  ${CODEX_HOME:-$HOME/.codex}/hooks/party_mode_router.py
5ea046595a9377219fc5fbcc544bff1dbfa29eb2bdde250c09fd28c4fcf6025e  ${CODEX_HOME:-$HOME/.codex}/hooks.json
39287b0e6ca15e7ca18f6e362e8f1725a59125a8f780dd27b1039e266fcced51  ${CODEX_HOME:-$HOME/.codex}/config.toml
```

## Trust status

Validated with `codex app-server --listen stdio://` and `hooks/list` for target workspace `$PARTY_MODE_PACKAGE_DIR`.

All party-mode hooks exposed by the local Codex CLI build are enabled and `hooks/list` returned no hook-list warnings or errors. The `0.128.0` CLI emits a stderr warning for the newer `[features].hooks` key while still accepting `[features].codex_hooks`; both keys are kept for CLI/Desktop compatibility. The `0.128.0` app-server schema used for validation does not return trusted-hash fields; trusted hash values are command-string-specific and should be refreshed through `/hooks` if a newer client marks the portable command as changed.

## Environment-specific difference

The local Codex CLI app-server used for validation is `0.128.0`, which exposes `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, and `Stop` from the user hook file. The router and packaged hook config also include `SubagentStart`, and the router includes a `SubagentStop` handler for future-compatible payloads; clients that do not expose those events ignore them.

## Behavior validation

Target workspace: `$PARTY_MODE_PACKAGE_DIR/validation_workspace`.

Validation executed the installed router with Codex-shaped hook payloads and isolated `PARTY_MODE_STATE_DIR`, `PARTY_MODE_ARTIFACT_DIR`, and `PARTY_MODE_ZIP_PATH` values.

Checks passed:

- Explicit party-mode prompt activated `UserPromptSubmit` and injected investigation context.
- Normal low-risk edit prompt returned `{"continue": true}` and did not activate party mode.
- Active party-mode `PreToolUse` denied `sed -i`.
- Active party-mode `PermissionRequest` denied `apply_patch`.
- Active party-mode `PreToolUse` denied dependency install command `npm install left-pad`.
- Active party-mode `PreToolUse` denied migration command `python manage.py migrate`.
- Active party-mode `PreToolUse` denied generated-code command `prisma generate`.
- Active party-mode `PreToolUse` denied mutating MCP call `mcp__github__create_issue`.
- `SubagentStart` injected the read-only party-mode contract.
- `Stop` blocked when no handoff zip existed.
- `Stop` allowed a complete valid zip containing:
  - `investigation_report.md`
  - `next_goal.md`
  - `evidence_manifest.yaml`
  - `readonly_policy_result.md`
  - `artifacts/notes.md`

## Real Codex turn smoke

Normal prompt:

```bash
PARTY_MODE_STATE_DIR="$(mktemp -d)" \
  codex exec -C $PARTY_MODE_PACKAGE_DIR/validation_workspace \
  --skip-git-repo-check -s read-only --json "Reply exactly NORMAL_OK."
```

Result:

- Turn completed with final agent message `NORMAL_OK`.
- Router state was written by the real `UserPromptSubmit` path.
- State showed `active: false`, `score: 0`, `reason: "no uncertainty trigger matched"`.

Explicit party-mode prompt:

```bash
PARTY_MODE_STATE_DIR="$(mktemp -d)" \
PARTY_MODE_ZIP_PATH="$PARTY_MODE_PACKAGE_DIR/party_mode_uncertainty_router_implementation.zip" \
  codex exec -C $PARTY_MODE_PACKAGE_DIR/validation_workspace \
  --skip-git-repo-check -s read-only --json \
  "Use party mode. Do not use tools. Reply exactly PARTY_OK."
```

Result:

- The real `UserPromptSubmit` path activated party mode.
- Router state showed `active: true`, `score: 99`, `reason: "explicit_party_mode"`.
- `PostToolUse` recorded possible-mutation observations when the model followed the `bmad-party-mode` skill trigger and started running read-only commands despite the smoke prompt. The smoke was manually stopped after activation was proven because it had left the intended minimal validation path.
- This is a skill-trigger interaction, not a router install failure. Direct hook-payload validation above remains the proof for denial and Stop-gate behavior.

Config compatibility:

- `${CODEX_HOME:-$HOME/.codex}/config.toml` keeps both `[features].codex_hooks = true` and `[features].hooks = true` so older CLI builds and newer Desktop builds can recognize the hook feature flag they expect.

Local package tests also passed:

```bash
python3 -m unittest discover -s tests
```

Result: 9 tests passed.

## Rollback

Restore backups if needed:

```bash
cp ${CODEX_HOME:-$HOME/.codex}/hooks.json.party-mode-backup-20260524-204843 ${CODEX_HOME:-$HOME/.codex}/hooks.json
cp ${CODEX_HOME:-$HOME/.codex}/config.toml.party-mode-backup-20260524-204843 ${CODEX_HOME:-$HOME/.codex}/config.toml
rm -f ${CODEX_HOME:-$HOME/.codex}/hooks/party_mode_router.py
```
