# Hook Event Mapping for Party Mode

| Event | Party-mode use | Output behavior to prefer |
|---|---|---|
| `SessionStart` | Load party-mode conventions and artifact paths. | Additional context only. |
| `UserPromptSubmit` | Detect uncertainty before the model acts. | Add read-only investigation context or block unsafe prompts. |
| `PreToolUse` | Prevent source edits, installs, commits, writes, and destructive MCP calls. | Deny mutating calls; add context for safe calls. |
| `PermissionRequest` | Deny escalation that would break read-only investigation. | Deny mutation approvals; otherwise decline to decide. |
| `PostToolUse` | Convert useful outputs into evidence requirements; detect accidental mutation. | Add context or block normal processing of unsafe output. |
| `SubagentStart` | Give delegated roles the same read-only contract. | Additional context. |
| `SubagentStop` | Require delegated evidence before returning. | Continue the subagent if artifact content is missing. |
| `Stop` | Ensure the final zip and next goal exist. | Continue the turn if required markers are missing. |

Do not assume event ordering between multiple matching hooks from separate sources. Keep the party-mode state small and idempotent.
