# Next Goal for Implementation

## Goal

Revisit party-mode router promotion after a Codex upgrade or an explicit project request.

## Definition of done

- Installed Codex hook events are rechecked with `hooks/list`.
- If `SubagentStart` or `SubagentStop` appears in the installed Codex build, live validation is added for those events.
- A target project explicitly accepts the party-mode read-only policy before project-standard installation.
- The rollout decision remains documented in `artifacts/10_rollout_smoke_decision.md`.

## Boundaries

In scope:

- Re-running live Codex turn smoke testing after a Codex upgrade or project request.
- Hook trust/status checks with `hooks/list`.
- Small compatibility patches if the live payload differs from documented behavior.
- Documentation of rollout decision and rollback path.

Out of scope:

- Changing the router policy model unless live payloads require it.
- Implementing application code during party mode.
- Treating hooks as a sandbox replacement.

## Inputs from current package

- Installed router: `${CODEX_HOME:-$HOME/.codex}/hooks/party_mode_router.py`
- User hook config: `${CODEX_HOME:-$HOME/.codex}/hooks.json`
- Router command override: `PARTY_MODE_ROUTER`
- Validation report: `artifacts/09_live_hook_install_validation.md`
- Tests: `tests/test_party_mode_router.py`
- Policy reference: `artifacts/03_readonly_tool_policy.yaml`

## Suggested implementation steps

1. Run `hooks/list` for the target workspace and confirm enabled hooks; refresh trust through `/hooks` if the client reports the portable command as changed.
2. Recheck schema and `hooks/list` for `SubagentStart` and `SubagentStop`.
3. Re-run normal, explicit party-mode, and mutation-denial Codex turn smoke tests.
4. If a project-standard install is requested, add a project-local hook config only after reviewing the read-only policy with the project owner.
5. Record the new rollout decision and any compatibility patch.

## Verification

- `python3 -m unittest discover -s tests` passes.
- `hooks/list` reports no warnings or errors.
- Party-mode activation and normal non-activation are proven from current state.
- Mutating action denial is visible in the live Codex turn or an equivalent app-server hook execution path.
- Updated rollout decision is committed with the package artifacts.

## Rollback / safety notes

- Restore `${CODEX_HOME:-$HOME/.codex}/hooks.json.party-mode-backup-20260524-204843`.
- Restore `${CODEX_HOME:-$HOME/.codex}/config.toml.party-mode-backup-20260524-204843`.
- Remove `${CODEX_HOME:-$HOME/.codex}/hooks/party_mode_router.py`.
