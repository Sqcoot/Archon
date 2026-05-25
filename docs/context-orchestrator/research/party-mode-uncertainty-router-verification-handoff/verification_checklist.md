# Verification Checklist

Use this checklist in a fresh session. Record evidence paths, command output summaries, and pass/fail status in the findings report.

## Package Integrity

- [ ] Implementation pack directory exists.
- [ ] Implementation zip exists.
- [ ] Required package files from `artifact_inventory.yaml` exist.
- [ ] `hooks/hooks.json` is valid JSON.
- [ ] `schemas/party_mode_state.schema.json` is valid JSON.
- [ ] Implementation zip contains the required implementation-pack files.

## Activation Behavior

- [ ] Explicit `party mode` wording activates investigation context.
- [ ] Ambiguous or high-uncertainty prompt activates when score reaches threshold.
- [ ] Normal low-risk edit prompt does not activate party mode.
- [ ] `PARTY_MODE=force` activates without relying on prompt wording.
- [ ] `PARTY_MODE=off` disables activation/enforcement.

## Read-Only Enforcement

- [ ] Mutating shell commands such as `sed -i`, redirection outside artifacts, destructive file commands, dependency installs, commits, migrations, and generated-code writes are denied while active.
- [ ] `apply_patch`, `Edit`, and `Write` are denied while active.
- [ ] Mutating MCP/tool names are denied while active.
- [ ] Read-only shell commands and read-only tool names are allowed.
- [ ] Writes under `PARTY_MODE_ARTIFACT_DIR` are allowed.
- [ ] Writes to `PARTY_MODE_ZIP_PATH` are allowed.

## Evidence Guidance And Delegation

- [ ] `PostToolUse` adds evidence-capture guidance after useful read-only output.
- [ ] `PostToolUse` flags accidental mutation or output suggesting changes.
- [ ] `SubagentStart` injects the read-only investigation contract.
- [ ] `SubagentStop` continues the subagent if evidence or read-only confirmation is missing.

## Final Stop Gate

- [ ] `Stop` continues when no final handoff zip exists.
- [ ] `Stop` continues when the zip is invalid or missing required entries.
- [ ] `Stop` passes when the zip contains `investigation_report.md`, `next_goal.md`, `evidence_manifest.yaml`, `readonly_policy_result.md`, and `artifacts/`.

## Genericity

- [ ] Reusable templates avoid user-local absolute paths.
- [ ] Reusable templates avoid stale chat-specific or commit-specific wording.
- [ ] Environment variables are documented for state, artifact directory, and final zip paths.
- [ ] Literal hashes, dates, and local paths appear only in evidence-labeled sections.
