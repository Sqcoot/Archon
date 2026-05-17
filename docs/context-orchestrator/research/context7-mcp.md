# Context7 MCP Readiness

## Readiness

State: available

Evidence captured: 2026-05-17

## Local Configuration Evidence

`codex mcp list` shows `context7` configured and enabled:

```text
Name      Command                              Status
context7  /Users/edam/.codex/bin/context7-mcp  enabled
```

## Context7 CLI Evidence

The Context7 CLI was used as required:

```bash
npx ctx7@latest library Context7 "Context7 MCP setup and ctx7 CLI library docs resolution for ACO documentation plan"
npx ctx7@latest docs /websites/context7 "Context7 MCP setup and ctx7 CLI library docs resolution for ACO documentation plan"
```

The selected library ID was `/websites/context7`, because it was the exact high-reputation Context7 match with the official Context7 documentation description.

Context7 docs evidence says:

- `ctx7 setup` runs interactive setup and prompts for MCP server or CLI + Skills mode.
- `ctx7 docs <libraryId> <query>` retrieves documentation for a Context7-compatible library ID.
- Context7 MCP `query-docs` requires an exact `libraryId` and `query`.

## Setup Commands

ACO may document these commands, but must not mutate user-level Codex config without explicit user approval:

```bash
codex mcp add context7 -- npx -y @upstash/context7-mcp
codex mcp list
```

For CLI docs lookup, ACO should use:

```bash
npx ctx7@latest library <name> "<question>"
npx ctx7@latest docs <libraryId> "<question>"
```

## ACO Implications

ACO must resolve Context7-compatible library IDs before using version-specific Context7 docs.

ACO must mark documentation targets as `libraryId: unresolved` when a graph-detected dependency does not have a proven Context7 ID.

ACO must not invent Context7 library IDs.

ACO should treat Context7 as primary for third-party library and API documentation, not for OpenAI/Codex behavior.

## Known Gaps

- Context7 docs commands may hit quota limits. If a quota error occurs, ACO should report it and suggest `npx ctx7@latest login` or `CONTEXT7_API_KEY`.
- Some graph-detected dependencies may have multiple Context7 matches. ACO must preserve ambiguity until the best match is proven by exact name, source reputation, snippet count, and relevance.
