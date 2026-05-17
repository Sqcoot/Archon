# Codex Official Documentation Notes

## Sources

Evidence captured: 2026-05-17

- Codex config reference: `https://developers.openai.com/codex/config-reference`
- Codex slash commands: `https://developers.openai.com/codex/cli/slash-commands`
- Docs MCP: `https://developers.openai.com/learn/docs-mcp`

## Configuration Findings

Codex configuration lives in `~/.codex/config.toml`, with optional project-scoped `.codex/config.toml` files loaded only when the project is trusted.

The config reference documents MCP server configuration keys under `mcp_servers.<id>`, including:

- `command`
- `args`
- `env`
- `env_vars`
- `cwd`
- `url`
- `bearer_token_env_var`
- `enabled`
- `required`
- `startup_timeout_sec`
- `tool_timeout_sec`
- `enabled_tools`
- `disabled_tools`

For ACO, this means docs resolvers should check MCP availability and document setup, but must not silently rewrite `~/.codex/config.toml`.

## Goal Findings

The Codex CLI slash-command docs state that `/goal` is experimental and requires `features.goals`.

The docs describe enabling it either through `/experimental` or by adding:

```toml
[features]
goals = true
```

The docs also define `/goal <objective>`, `/goal`, `/goal pause`, `/goal resume`, and `/goal clear`.

For ACO, this means persistent goals are a Codex runtime capability, not an Archon data-model requirement for the first MVP.

## Docs MCP Findings

OpenAI hosts a public Docs MCP server at:

```text
https://developers.openai.com/mcp
```

The official page describes it as read-only documentation access for developers.openai.com and platform.openai.com. It is documentation-only and does not call the OpenAI API.

Codex setup command:

```bash
codex mcp add openaiDeveloperDocs --url https://developers.openai.com/mcp
```

Verification command:

```bash
codex mcp list
```

## ACO Constraints From Official Docs

ACO must:

- Prefer OpenAI Docs MCP for OpenAI/Codex behavior.
- Record MCP readiness, not assume it.
- Treat OpenAI Docs MCP as read-only documentation access.
- Document setup commands without mutating user-level config unless explicitly approved.
- Preserve `/goal` as a user/Codex session control, not as an internal Archon migration requirement.

## Open Questions

- Whether ACO needs to expose Codex App Server goal APIs is deferred until architecture ADRs decide whether App Server integration is in MVP.
- Whether ACO should generate project-scoped `.codex/config.toml` snippets is deferred until the security model ADR.
