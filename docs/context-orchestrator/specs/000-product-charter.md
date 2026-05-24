# Context Orchestrator Product Charter

The Context Orchestrator provides a repository-native coordination layer for ACO work. It collects local evidence, routes BMAD advisory support, compiles prompt packages, exposes ledgers, and keeps approval boundaries explicit.

Durable surfaces covered by this slice:

- CLI and slash-command entry points for status, route, ledgers, compile, and workflow handoff.
- API and Web-facing ACO status, ledger, route, compile, and artifact package contracts.
- Workflow defaults that compile a context package and pause at explicit approval gates.
- Traceability checks that connect specs, executable acceptance tests, and implementation evidence.

Runtime capability claims must come from current command output or an explicit unknown/deferred state. Static docs alone cannot assert Context7, MCP, graph, or provider availability.
