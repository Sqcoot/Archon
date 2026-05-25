# Next Goal for Implementation

## Goal

Run an end-to-end Codex turn smoke test for the installed party-mode router and decide whether to promote it from user-level hooks to managed or project-standard hooks.

## Definition of done

- One explicit party-mode prompt is run through Codex and confirms party-mode activation in the resulting state or model-visible context.
- One normal low-risk prompt is run through Codex and confirms no party-mode activation.
- One active party-mode turn attempts a mutating action and confirms the hook denial is surfaced correctly.
- `SubagentStop` support is rechecked against the installed Codex version; if the event appears in `hooks/list`, it is trusted and validated.
- A rollout decision is recorded: keep user-level only, install per-project, or promote to a managed hook path.

## Boundaries

In scope:

- Live Codex turn smoke testing.
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
2. Start a fresh Codex turn with an explicit party-mode prompt and inspect persisted router state.
3. Start a fresh Codex turn with a normal low-risk prompt and inspect persisted router state.
4. Trigger or simulate a mutating tool request under active party mode and confirm denial UX.
5. Recheck schema and `hooks/list` for `SubagentStop`.
6. Record rollout decision and any compatibility patch.

## Verification

- `python3 -m unittest discover -s tests` passes.
- `hooks/list` reports no warnings or errors.
- Party-mode activation and normal non-activation are proven from current state.
- Mutating action denial is visible in the live Codex turn or an equivalent app-server hook execution path.

## Rollback / safety notes

- Restore `${CODEX_HOME:-$HOME/.codex}/hooks.json.party-mode-backup-20260524-204843`.
- Restore `${CODEX_HOME:-$HOME/.codex}/config.toml.party-mode-backup-20260524-204843`.
- Remove `${CODEX_HOME:-$HOME/.codex}/hooks/party_mode_router.py`.
