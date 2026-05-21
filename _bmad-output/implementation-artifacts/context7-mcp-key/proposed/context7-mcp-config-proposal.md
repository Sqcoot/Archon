# Context7 MCP Config Proposal

Do not commit real keys. Keep secrets in environment or Keychain.

## Current Safe Shape

Codex config can keep this machine-local wrapper:

```toml
[mcp_servers.context7]
command = "/Users/edam/.codex/bin/context7-mcp"
startup_timeout_sec = 40
tool_timeout_sec = 120
enabled = true
```

Wrapper behavior:

```bash
export CONTEXT7_API_KEY="${api_key}"
exec npx -y @upstash/context7-mcp@latest --api-key "${CONTEXT7_API_KEY}"
```

## Direct MCP Shape

For clients that do not use the wrapper:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest", "--api-key", "YOUR_API_KEY"]
    }
  }
}
```

## Preferred Secret Handling

- macOS Keychain service: `Context7`
- fallback Keychain service: `CONTEXT7_API_KEY`
- environment variable: `CONTEXT7_API_KEY`

Avoid putting `YOUR_API_KEY` in tracked config, shell history, issue comments, or artifacts.
