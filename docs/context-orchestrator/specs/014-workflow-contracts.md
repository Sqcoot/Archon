# Context Orchestrator Workflow Contracts

AC-P3-WF covers the `context-orchestrate` workflow default.

Required behavior:

- Read status and ledgers from the repository-native CLI.
- Compile a context package into `$ARTIFACTS_DIR/context-orchestrator`.
- Write `graph-validation-gate.json` from compile output.
- Generate and verify an approval capsule when forbidden graph evidence requires it.
- Pause with explicit approval messages and `capture_response: true`.
- Always write a final handoff summary through an `all_done` trigger.

The workflow must not clear graph waivers, refresh graph evidence, mutate provider auth, or treat approval as a blanket permission beyond the current run.
