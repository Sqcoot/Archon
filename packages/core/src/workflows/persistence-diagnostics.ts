import { createLogger } from '@archon/paths';
import * as workflowDb from '../db/workflows';

const MAX_WORKFLOW_PERSISTENCE_DIAGNOSTICS = 5;

let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('workflow.persistence-diagnostics');
  return cachedLog;
}

export async function recordWorkflowEventPersistenceDiagnostic(input: {
  runId: string;
  eventType: string;
  stepName?: string;
  reason: string;
  persistence: 'best_effort_failed';
}): Promise<void> {
  try {
    const run = await workflowDb.getWorkflowRun(input.runId);
    if (!run) return;
    const existing = Array.isArray(run.metadata.workflow_event_persist_failures)
      ? run.metadata.workflow_event_persist_failures.filter(isWorkflowPersistenceDiagnostic)
      : [];
    await workflowDb.updateWorkflowRun(input.runId, {
      metadata: {
        workflow_event_persist_failures: [
          ...existing,
          {
            eventType: input.eventType,
            ...(input.stepName ? { stepName: input.stepName } : {}),
            reason: input.reason,
            persistence: input.persistence,
            timestamp: new Date().toISOString(),
          },
        ].slice(-MAX_WORKFLOW_PERSISTENCE_DIAGNOSTICS),
      },
    });
  } catch (error) {
    getLog().warn(
      { err: error as Error, runId: input.runId, eventType: input.eventType },
      'workflow_persistence_diagnostic_metadata_failed'
    );
  }
}

function isWorkflowPersistenceDiagnostic(value: unknown): value is {
  eventType: string;
  stepName?: string;
  reason: string;
  persistence: 'best_effort_failed';
  timestamp: string;
} {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.eventType === 'string' &&
    typeof candidate.reason === 'string' &&
    candidate.persistence === 'best_effort_failed' &&
    typeof candidate.timestamp === 'string'
  );
}
