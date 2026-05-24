---
description: Emit a Codex-ready ACO bootstrap capsule with capability snapshot and evidence artifacts
argument-hint: '[--event SessionStart] [--max-bytes 4000] [--format markdown|json] [--write-artifact] [prompt]'
---

# ACO Bootstrap Codex

Emit a compact ACO bootstrap capsule for Codex using Archon's registered command surfaces.

Canonical slash usage:

```bash
/aco:bootstrap-codex --event SessionStart --max-bytes 4000 --format markdown --write-artifact
```

CLI usage:

```bash
archon aco bootstrap-codex --event SessionStart --max-bytes 4000 --format markdown --write-artifact
archon aco bootstrap-codex --event Stop --format json --evaluator "Continue validation and handoff"
```

## Contract

- Reuse `buildAcoBootstrapContext({ cwd, prompt, event, maxBytes })` and `CapabilitySnapshot`.
- Support `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `SubagentStart`, `SubagentStop`, and `Stop`.
- Emit markdown paste mode or JSON attach mode.
- Write repo-conventional ACO capsule, snapshot, and evidence artifacts when `--write-artifact` is enabled.
- Keep hook activation, graph refresh, auth, MCP OAuth, provider credentials, and user-level Codex config approval-gated and unmodified.
- Mark unsupported claims `unknown`, `blocked`, or `deferred`; do not invent capability availability.

## Codex Paste Workflow

Run the command at session start, after compaction, before subagent launch, or at Stop/evaluator boundaries. Paste the markdown capsule into Codex, or attach the JSON payload when the receiving workflow supports sidecar attachments.

For guard events, prefer:

```bash
/aco:bootstrap-codex --event PreToolUse --max-bytes 4000 --format markdown --write-artifact "$ARGUMENTS"
/aco:bootstrap-codex --event PermissionRequest --max-bytes 4000 --format markdown --write-artifact "$ARGUMENTS"
```

These capsules summarize forbidden ledgers, graph refresh risk, destructive operations, secret exposure, and approval requirements without activating hooks.
