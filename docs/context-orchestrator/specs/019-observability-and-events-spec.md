# Context Orchestrator Observability And Events

ACO-EVENTS-001 covers the observable workflow event path for the ACO loop.

Required behavior:

- Approval pauses use existing workflow approval nodes.
- The workflow engine records `approval_requested` and `approval_received` events through the existing store and event emitter surfaces.
- Node lifecycle events remain visible as `node_started`, `node_completed`, and workflow artifact notifications.
- The `context-orchestrate` workflow keeps handoff generation under `trigger_rule: all_done` so approval and failure paths still produce inspectable context.

This spec does not introduce a new event store or event type namespace.
