# Party Mode Integration Design

## Core idea

Party mode should be a **turn-level uncertainty router** with a read-only investigation contract. Hooks are the best entry points because they sit on the Codex lifecycle, but party mode should not rely on one hook as an enforcement boundary. Instead, use several hooks as a layered system:

- `UserPromptSubmit`: first chance to detect uncertainty and inject party-mode context.
- `PreToolUse`: block or rewrite unsupported/mutating tool calls before they run.
- `PermissionRequest`: deny escalation requests that would break read-only investigation.
- `PostToolUse`: review completed output, summarize evidence, and replace unsafe/irrelevant tool output with corrective context when needed.
- `SubagentStart`: give delegated agents the same read-only party-mode contract.
- `SubagentStop`: require a delegated role to continue if its required artifact is missing.
- `Stop`: final gate; continue the turn if the investigation package or next goal is missing.
- `SessionStart`: load workspace conventions, party-mode policy, and artifact paths.

## Why not only hook calls?

A hook can route and guard, but it cannot replace the agent's planning discipline or the runtime sandbox. Some hook events do not support every field, multiple matching hooks can run concurrently, and post-tool hooks cannot undo side effects that already happened. Therefore party mode should be enforced by four layers:

1. **Prompt contract:** explicit read-only end condition.
2. **Sandbox / permissions:** run under read-only or least-privilege profile where possible.
3. **Hook policy:** detect uncertainty, block writes, continue unfinished handoffs.
4. **Output contract:** require a zip containing the report, evidence, read-only attestation, and next goal.

## Recommended lifecycle

1. User asks an uncertain or broad coding question.
2. `UserPromptSubmit` scores uncertainty. If score crosses threshold, it adds developer context: "activate party mode; investigate only; produce handoff zip."
3. Codex investigates using read-only file reads, docs, MCP read tools, graph exports, subagent reports, and safe commands.
4. `PreToolUse` denies `apply_patch`, file writes, installs, commits, migrations, and other mutations while party mode is active.
5. `PermissionRequest` denies escalations that would enable mutation or network access unless the run explicitly permits read-only research.
6. `PostToolUse` watches command output for accidental mutations or missing evidence and adds corrective context.
7. `Stop` checks the final response. If the zip, next goal, or required artifacts are missing and this is not already a continuation, it asks Codex to continue.
8. The final answer reports the artifact path, confidence, and one next goal.

## Artifact-driven delegation

Party mode can delegate to BMAD roles, subagents, Context7/docs, Agentic Search, graph/Graphify, manifests, ledgers, adapters, MCP/tools, and provider manifests. Treat each delegated result as an input artifact. The orchestrator's job is not to make the best guess; it is to collapse uncertainty into a bounded implementation goal.

## Practical recommendation

Use a dedicated `party-mode` profile or command wrapper for uncertain tasks. Keep the hooks always available, but only enforce strict read-only blocking when party mode is active by state, environment variable, or profile. This prevents the uncertainty system from slowing down ordinary low-risk edits.
