# Verification Goal

## Goal

Verify whether the party-mode uncertainty router implementation pack is truly implemented as intended, using the target repository or the implementation pack provided to the fresh session.

## Definition Of Done

- Inspect the implementation pack and confirm the expected files exist.
- Run the verification commands from `commands_to_run.md` in the fresh session context.
- Confirm hook behavior for `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `SubagentStart`, `SubagentStop`, and `Stop`.
- Confirm runtime paths are configurable with `PARTY_MODE_STATE_DIR`, `PARTY_MODE_ARTIFACT_DIR`, and `PARTY_MODE_ZIP_PATH`.
- Confirm reusable artifacts are generic and not tied to one chat session or local user path.
- Produce a findings report using `expected_findings_report.md`.

## Boundaries

In scope:

- Inspecting files, schemas, tests, hook config, policy artifacts, and zip contents.
- Running isolated verification commands in a temporary state/artifact directory.
- Reporting deviations and the next recommended implementation goal.

Out of scope:

- Installing hooks into a live user or project config.
- Editing the router implementation.
- Running migrations, dependency installs, commits, generated-code writes, or application source changes.
- Treating hooks as a replacement for a sandbox or permission profile.

## Success Criteria

The fresh session can independently state whether the router satisfies the party-mode uncertainty routing contract, with evidence for each event and a clear pass/fail result.
