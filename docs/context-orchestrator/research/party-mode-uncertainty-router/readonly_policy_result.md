# Policy Result

This package contains implementation artifacts plus live user-level hook install validation.

Implementation, installation, validation, and packaging used normal write permissions. The installed runtime router still enforces the party-mode read-only investigation contract when party mode is active, because that is the feature being implemented.

## Installed state

- Router installed at `${CODEX_HOME:-$HOME/.codex}/hooks/party_mode_router.py`.
- User hook config updated at `${CODEX_HOME:-$HOME/.codex}/hooks.json`.
- Party-mode hook commands resolve the router through `PARTY_MODE_ROUTER`, then `${CODEX_HOME:-$HOME/.codex}/hooks/party_mode_router.py`.
- Trust hashes were persisted under `[hooks.state]` in `${CODEX_HOME:-$HOME/.codex}/config.toml` at install time; refresh through `/hooks` if a client marks the portable command as changed.
- Existing caveman `SessionStart` hook preserved.
- Backups created:
  - `${CODEX_HOME:-$HOME/.codex}/hooks.json.party-mode-backup-20260524-204843`
  - `${CODEX_HOME:-$HOME/.codex}/config.toml.party-mode-backup-20260524-204843`

## Runtime policy implemented

- Party-mode activation writes small state outside the source tree.
- Runtime source edits, dependency changes, commits, migrations, generated-code writes, and mutating MCP calls are denied while party mode is active.
- Artifact writes are allowed under the configured artifact directory and final zip path.
- A final handoff must be a valid zip with required files before `Stop` allows completion.

## Compatibility note

Codex builds expose different hook event sets. The router contains `SubagentStart` and `SubagentStop` handlers; current live install can only trust and validate the hook events exposed by the active Codex build.

## Rollout decision

End-to-end Codex smoke validation passed for normal non-activation, explicit activation, and mutation denial. Keep the current rollout user-level only; do not promote to managed or project-standard hooks yet.
