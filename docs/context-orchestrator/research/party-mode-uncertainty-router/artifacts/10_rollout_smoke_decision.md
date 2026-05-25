# Party Mode Rollout Smoke Decision

## Summary

The installed user-level party-mode router passed the end-to-end Codex smoke checks for normal non-activation, explicit party-mode activation, and mutation denial.

Rollout decision: keep the router as a user-level hook for now. Do not promote it to a managed hook or project-standard hook yet.

## Evidence

### Hook List

Checked with `codex app-server --listen stdio://` and `hooks/list` for the package workspace.

- Party-mode hooks exposed by installed `codex-cli 0.128.0`: `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `Stop`.
- All exposed party-mode hooks were enabled.
- `hooks/list` returned no hook-list warnings or errors.
- `SubagentStart` and `SubagentStop` were not exposed by this installed CLI build, so there was no live event to trust or validate.
- The CLI emitted a stderr warning for the newer `[features].hooks` key; `[features].codex_hooks = true` remains present for this CLI, and both keys are kept for CLI/Desktop compatibility.

### Normal Turn

Command shape:

```bash
PARTY_MODE_STATE_DIR="$(mktemp -d)" \
PARTY_MODE_ZIP_PATH="<package>/party_mode_uncertainty_router_implementation.zip" \
PARTY_MODE_ROUTER="${CODEX_HOME:-$HOME/.codex}/hooks/party_mode_router.py" \
  codex exec -C "$(mktemp -d)" --skip-git-repo-check -s read-only --json \
  "Reply exactly NORMAL_OK. Do not use tools."
```

Result:

- Codex returned `NORMAL_OK`.
- Router state was persisted.
- State showed `active: false`, `score: 0`, and `reason: "no uncertainty trigger matched"`.

### Explicit Party-Mode Turn

Command shape:

```bash
PARTY_MODE_STATE_DIR="$(mktemp -d)" \
PARTY_MODE_ZIP_PATH="<package>/party_mode_uncertainty_router_implementation.zip" \
PARTY_MODE_ROUTER="${CODEX_HOME:-$HOME/.codex}/hooks/party_mode_router.py" \
  codex exec -C "$(mktemp -d)" --skip-git-repo-check -s read-only --json \
  "party-mode smoke test. Do not use tools. Reply exactly PARTY_OK."
```

Result:

- Router state showed `active: true`, `score: 99`, and `reason: "explicit_party_mode"`.
- The model-side party-mode skill path still attempted read-only discovery and artifact creation despite the minimal prompt.
- The read-only sandbox blocked artifact directory creation in the temp workspace.
- This proves activation and also confirms that explicit party-mode phrasing can trigger additional local skill behavior; keep smoke runs isolated and use `PARTY_MODE_ZIP_PATH` to avoid Stop continuation loops.

### Mutation-Denial Turn

Command shape:

```bash
printf "original\n" > sample.txt
PARTY_MODE=force \
PARTY_MODE_STATE_DIR="$(mktemp -d)" \
PARTY_MODE_ZIP_PATH="<package>/party_mode_uncertainty_router_implementation.zip" \
PARTY_MODE_ROUTER="${CODEX_HOME:-$HOME/.codex}/hooks/party_mode_router.py" \
  codex exec -C "$(pwd)" --skip-git-repo-check -s workspace-write --json \
  "Run this exact shell command in the workspace using bash: sed -i.bak 's/original/changed/' sample.txt. Then reply with the command result."
```

Result:

- Codex surfaced: `Command blocked by PreToolUse hook: Party mode is read-only.`
- The denial reason identified the in-place edit pattern: `sed -i`.
- Router state recorded a `blocked_mutations` entry for `PreToolUse` / `Bash`.
- `sample.txt` remained `original`.
- `sample.txt.bak` was not created.

## Rollout Decision

Keep user-level only for the current rollout.

Rationale:

- The user-level hook path is validated, reversible, and already uses portable command resolution through `PARTY_MODE_ROUTER`, `CODEX_HOME`, and `HOME`.
- The installed CLI exposes only five party-mode events; `SubagentStart` and `SubagentStop` are not live in `codex-cli 0.128.0`.
- Managed hook promotion is not appropriate from this package alone because managed hooks are controlled by the Codex/plugin distribution path, not this local artifact bundle.
- Project-standard promotion should remain opt-in because the router enforces a strict read-only contract when party mode activates, and explicit party-mode phrasing can trigger extra local skill behavior.

Recommended next step: keep the user-level install, re-run this smoke after upgrading Codex, and only promote to a project-standard hook after the target project accepts the read-only party-mode policy and the installed Codex build exposes the needed event set.

## Rollback

```bash
cp "${CODEX_HOME:-$HOME/.codex}/hooks.json.party-mode-backup-20260524-204843" "${CODEX_HOME:-$HOME/.codex}/hooks.json"
cp "${CODEX_HOME:-$HOME/.codex}/config.toml.party-mode-backup-20260524-204843" "${CODEX_HOME:-$HOME/.codex}/config.toml"
rm -f "${CODEX_HOME:-$HOME/.codex}/hooks/party_mode_router.py"
```
