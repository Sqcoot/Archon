# ACO Edge Case Review

Date: 2026-05-17
BMAD action: `bmad-review-edge-case-hunter`

## Edge Cases

| ID | Case | Expected behavior |
| --- | --- | --- |
| ECH-001 | Prompt contains token-like text. | Archive redacts token-like values. |
| ECH-002 | Prompt asks about Codex MCP setup. | Docs plan selects OpenAI Docs MCP. |
| ECH-003 | Prompt asks about unknown third-party library. | Docs plan marks Context7 library ID unresolved. |
| ECH-004 | Graph files are missing. | Graph status is unavailable or waived, based on mode. |
| ECH-005 | Archive root path includes traversal. | Fail closed. |
| ECH-006 | Caveman full mode sees JSON/YAML/code blocks. | Structured blocks remain byte-identical. |
| ECH-007 | Target codebase is not a git repo. | CLI returns an actionable validation error. |
| ECH-008 | Existing research manifest has waivers. | Prompt package includes waiver summary. |

## Result

Add these edge cases to acceptance tests before production code.
