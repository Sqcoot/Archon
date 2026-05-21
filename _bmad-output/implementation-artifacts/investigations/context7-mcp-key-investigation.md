# Context7 MCP Key Investigation

Status: Concluded
Date: 2026-05-21
Investigation route: `brownfield-architecture` -> `bmad-investigate`
Archon package: `.archon/artifacts/context-orchestrator/context7-mcp-key-20260521`

## Hand-off Brief

Context7 MCP was enabled in Codex, but no key was available to the configured wrapper. The wrapper depends on `CONTEXT7_API_KEY` or macOS Keychain entries named `Context7` / `CONTEXT7_API_KEY`; those entries were missing before repair. New key was stored in macOS Keychain, and authenticated `ctx7` docs calls now succeed.

## Evidence

Confirmed:

- `codex mcp get context7` showed `command: /Users/edam/.codex/bin/context7-mcp` and `env: -`.
- `/Users/edam/.codex/bin/context7-mcp` reads `CONTEXT7_API_KEY`, then Keychain services/labels `Context7` and `CONTEXT7_API_KEY`, then runs `npx -y @upstash/context7-mcp@latest --api-key "${CONTEXT7_API_KEY}"`.
- Keychain lookup returned missing for `Context7`, `CONTEXT7_API_KEY`, and `context7.com` before repair.
- Unauthenticated `npx ctx7@latest library ...` failed with monthly quota exceeded.
- Authenticated `npx ctx7@latest library Context7 ...` succeeded and resolved `/websites/context7`.
- Authenticated `npx ctx7@latest docs /websites/context7 ...` returned current setup docs showing `--api-key` and `CONTEXT7_API_KEY` are supported.
- Direct stdio MCP handshake through `/Users/edam/.codex/bin/context7-mcp` succeeded. Server reported Context7 v2.3.0 and exposed `resolve-library-id` plus `query-docs`.

Deduced:

- Failure was not a malformed Codex MCP stanza. Codex points to the intended wrapper.
- Failure was missing credential availability for the wrapper, causing Context7 to run unauthenticated or fail before start.
- Current config should work after Codex reconnects/restarts MCP, because the wrapper can now retrieve the key from Keychain.

## Fix Applied

- Stored the new Context7 API key in macOS Keychain services `Context7` and `CONTEXT7_API_KEY`.
- Did not write the key into `.codex/config.toml`, `.mcp.json`, repository files, or Archon artifacts.

## Validation

- Keychain service `Context7` now returns a 44-byte secret value.
- `npx ctx7@latest library Context7 ...` succeeds when `CONTEXT7_API_KEY` is populated from Keychain.
- `npx ctx7@latest docs /websites/context7 ...` succeeds when `CONTEXT7_API_KEY` is populated from Keychain.
- Minimal MCP `initialize` + `tools/list` exchange succeeds through the configured wrapper.

## Remaining Risk

- Current Codex session may need MCP reconnect or app restart before the already-enabled `context7` server is spawned with the repaired Keychain value.
- ACO graph waivers remain unchanged: `graph-waiver.bmad-plugins-marketplace`, `graph-waiver.bmad-sample-data`.
- Worktree had unrelated pre-existing tracked/untracked changes; no repository source files were modified for this fix.

## Rollback

Remove the machine-local Keychain entries:

```bash
security delete-generic-password -s "Context7"
security delete-generic-password -s "CONTEXT7_API_KEY"
```
