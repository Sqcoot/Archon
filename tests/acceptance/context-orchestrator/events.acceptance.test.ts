import { describe, expect, test } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('ACO events acceptance', () => {
  test('Spec: 019-observability-and-events-spec.md Acceptance: ACO-EVENTS-001 workflow events use existing observable approval flow', async () => {
    const [workflowSource, dagExecutorSource, storeSource, eventEmitterTests] = await Promise.all([
      readFile(join(process.cwd(), '.archon/workflows/defaults/context-orchestrate.yaml'), 'utf8'),
      readFile(join(process.cwd(), 'packages/workflows/src/dag-executor.ts'), 'utf8'),
      readFile(join(process.cwd(), 'packages/workflows/src/store.ts'), 'utf8'),
      readFile(join(process.cwd(), 'packages/workflows/src/event-emitter.test.ts'), 'utf8'),
    ]);

    expect(workflowSource).toContain('graph-validation-gate');
    expect(workflowSource).toContain('evidenceResolution');
    expect(workflowSource).toContain('approval:');
    expect(workflowSource).toContain('capture_response: true');
    expect(workflowSource).toContain('trigger_rule: all_done');

    expect(dagExecutorSource).toContain("event_type: 'approval_requested'");
    expect(dagExecutorSource).toContain('pauseWorkflowRun');
    expect(dagExecutorSource).toContain('node_started');
    expect(dagExecutorSource).toContain('node_completed');

    expect(storeSource).toContain("'approval_requested'");
    expect(storeSource).toContain("'approval_received'");
    expect(storeSource).toContain('pauseWorkflowRun');

    expect(eventEmitterTests).toContain('delivers multiple sequential events in order');
    expect(eventEmitterTests).toContain('workflow_started');
    expect(eventEmitterTests).toContain('node_started');
    expect(eventEmitterTests).toContain('workflow_artifact');
    expect(eventEmitterTests).toContain('conversation-scoped subscriber');
  });
});
