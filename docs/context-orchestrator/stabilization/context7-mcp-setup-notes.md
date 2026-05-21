# Context7 MCP Setup Notes

Classification: durable documentation

These notes preserve the reusable Context7 MCP setup guidance without carrying
machine-local wrapper paths, Keychain service names, or personal investigation
details into product source.

## Safe Configuration Shape

Prefer user-local MCP configuration. Do not commit live `.mcp.json`,
`.codex/config.toml`, `.claude/settings.json`, API keys, wrapper paths, or
credential-store service names.

Direct stdio shape:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest", "--api-key", "<api-key>"]
    }
  }
}
```

Wrapper shape for local users who need one:

```toml
[mcp_servers.context7]
command = "<local-codex-wrapper-path>"
startup_timeout_sec = 40
tool_timeout_sec = 120
enabled = true
```

Wrapper behavior should read credentials from `<environment-variable-name>` or
`<keychain-service-name>` and then exec the Context7 MCP package. The wrapper
path and credential-store names are local machine configuration, not repository
defaults.

## ACO Readiness Impact

Context7 MCP availability must be runtime-verified or reported as
`not_configured`, `configured_but_not_reachable`, `unknown`, or
`deferred_by_design`. Prompt text or committed setup notes are not evidence that
Context7 MCP is available.

## Validation

The Context7 documentation lookup attempted during this stabilization pass was
blocked by monthly quota exhaustion. That does not change ACO readiness because
the retained ACO integration model already treats Context7 MCP as deferred or
runtime-verified rather than assuming it is available.
