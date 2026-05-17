# OpenAI Docs MCP Readiness

## Readiness

State: available

Evidence captured: 2026-05-17

## Local Configuration Evidence

`codex mcp list` shows `openaiDeveloperDocs` configured as a streamable HTTP MCP server:

```text
Name                 Url                                Status
openaiDeveloperDocs  https://developers.openai.com/mcp  enabled
```

The same command shows `context7` enabled as a stdio MCP server, which means ACO can treat both documentation sources as configured in this environment.

## Official Documentation Evidence

OpenAI Docs MCP search returned relevant Codex documentation for:

- Codex config reference: `https://developers.openai.com/codex/config-reference`
- Codex CLI slash commands: `https://developers.openai.com/codex/cli/slash-commands`
- Docs MCP quickstart: `https://developers.openai.com/learn/docs-mcp`

OpenAI Docs MCP fetch succeeded for:

- `https://developers.openai.com/codex/config-reference`
- `https://developers.openai.com/codex/cli/slash-commands`

OpenAI Docs MCP fetch did not return page content for `https://developers.openai.com/learn/docs-mcp`, so the page was verified through official OpenAI web fallback.

## Setup Commands

Do not mutate user-level Codex config from ACO without explicit user approval. ACO may document these commands:

```bash
codex mcp add openaiDeveloperDocs --url https://developers.openai.com/mcp
codex mcp list
```

The official Docs MCP page identifies the server URL as:

```text
https://developers.openai.com/mcp
```

It also describes the server as documentation-only: it provides read-only access to OpenAI developer docs and does not call the OpenAI API on the user's behalf.

## ACO Implications

ACO must select OpenAI Docs MCP as the primary source for OpenAI, Codex, OpenAI API, ChatGPT Apps SDK, and OpenAI MCP behavior.

ACO must not use Context7 as the primary source for Codex behavior when official OpenAI documentation is available.

ACO can record a readiness state of `available` when `codex mcp list` shows `openaiDeveloperDocs` enabled and a docs search or fetch succeeds.

## Known Gaps

- OpenAI Docs MCP search can return pages that `fetch_openai_doc` does not fetch by URL. ACO should record this as `configured-but-partial-fetch` or include official OpenAI web fallback evidence.
- ACO should avoid requiring OpenAI Docs MCP for unrelated third-party library documentation.
