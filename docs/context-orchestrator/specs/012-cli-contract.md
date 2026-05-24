# Context Orchestrator CLI And Slash Contract

AC-P1-SLASH covers the interactive slash-command surface used by chat adapters. The command handler must expose:

- `/context status`
- `/context route <request>`
- `/context ledgers`
- `/context compile <request>`
- `/context run <request>`

The slash layer delegates to the same Context Orchestrator package behavior used by CLI/API surfaces. `/context run <request>` starts the bundled `context-orchestrate` workflow instead of inventing a separate execution path.

Approval language in this surface preserves the existing public `needs_approval` API value. Internal ACO coordination gates use `ready`, `blocked`, `needs_decision`, or `unknown`, with evidence recorded by `bun run aco:target-intent -- --json`.
