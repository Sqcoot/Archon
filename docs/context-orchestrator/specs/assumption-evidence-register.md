# Assumption Evidence Register

| ID | Assumption | Classification | Evidence | Status | Correct-course trigger |
| --- | --- | --- | --- | --- | --- |
| ACO-A-001 | Graph evidence must exist or be waived before architecture lock. | proven by Graphify evidence | docs/context-orchestrator/research/graph-evidence-index.md | active | Required graph missing without waiver |
| ACO-A-002 | OpenAI Docs MCP is primary for Codex behavior. | proven by official OpenAI docs | docs/context-orchestrator/research/openai-docs-mcp.md | active | Official docs unavailable for required Codex behavior |
| ACO-A-003 | Context7 IDs must be resolved before version-specific docs use. | proven by Context7 evidence | docs/context-orchestrator/research/context7-mcp.md | active | A generated prompt includes unproven Context7 ID |
| ACO-A-004 | MVP should prefer artifacts/events before DB migration. | proven by Archon docs | AGENTS.md | active | Requirement appears that artifacts/events cannot satisfy |
| ACO-A-005 | CLI is the lowest-risk first Archon-native MVP surface. | proven by Archon source and BMAD technical research | docs/context-orchestrator/bmad/technical-research.md | active | CLI cannot return archive paths and JSON result cleanly |
| ACO-A-006 | Generic core should live outside `@archon/core`. | proven by architecture ADR | docs/context-orchestrator/adr/0001-implementation-host.md | active | New package creates circular dependencies |
| ACO-A-007 | Caveman policy may only compress safe summary text. | proven by Caveman source and spec | docs/context-orchestrator/research/caveman-principles.md | active | Structured artifact changes under Caveman mode |
| ACO-A-008 | Full workflow integration is deferred from MVP. | proven by ADR | docs/context-orchestrator/adr/0009-first-mvp-scope.md | active | CLI MVP cannot meet product acceptance criteria |
