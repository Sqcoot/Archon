/**
 * WorkflowStore adapter — bridges @archon/core DB modules to the
 * IWorkflowStore trait defined in @archon/workflows.
 */
import type { IWorkflowStore } from '@archon/workflows/store';
import type { WorkflowConfig, WorkflowDeps } from '@archon/workflows/deps';
import type { WorkflowRunStatus } from '@archon/workflows/schemas/workflow-run';
import type { MergedConfig } from '../config/config-types';
import * as workflowDb from '../db/workflows';
import * as workflowEventDb from '../db/workflow-events';
import * as codebaseDb from '../db/codebases';
import * as envVarDb from '../db/env-vars';
import { getAgentProvider } from '@archon/providers';
import { getWorkflowEventEmitter } from '@archon/workflows/event-emitter';
import { markWorkflowEventDiagnosticsAwareStore } from '@archon/workflows/event-persistence';
import { loadConfig as loadMergedConfig } from '../config/config-loader';
import { createLogger } from '@archon/paths';
import { recordWorkflowEventPersistenceDiagnostic } from './persistence-diagnostics';

// Compile-time assertion: MergedConfig must remain a structural subtype of WorkflowConfig.
// If MergedConfig drifts from WorkflowConfig, this line becomes a type error.
const assertConfigCompat: WorkflowConfig = {} as MergedConfig;
void assertConfigCompat;

let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('workflow.store-adapter');
  return cachedLog;
}

export function createWorkflowStore(): IWorkflowStore {
  const store: IWorkflowStore = {
    createWorkflowRun: workflowDb.createWorkflowRun,
    getWorkflowRun: workflowDb.getWorkflowRun,
    getActiveWorkflowRunByPath: workflowDb.getActiveWorkflowRunByPath,
    findResumableRun: workflowDb.findResumableRun,
    failOrphanedRuns: workflowDb.failOrphanedRuns,
    resumeWorkflowRun: workflowDb.resumeWorkflowRun,
    updateWorkflowRun: workflowDb.updateWorkflowRun,
    updateWorkflowActivity: workflowDb.updateWorkflowActivity,
    // DB returns string | null; IWorkflowStore declares WorkflowRunStatus | null.
    // The remote_agent_workflow_runs.status column is constrained to valid enum values
    // in SQL, so this cast is safe as long as the column constraint matches WorkflowRunStatus.
    getWorkflowRunStatus: id =>
      workflowDb.getWorkflowRunStatus(id) as Promise<WorkflowRunStatus | null>,
    completeWorkflowRun: workflowDb.completeWorkflowRun,
    failWorkflowRun: workflowDb.failWorkflowRun,
    pauseWorkflowRun: workflowDb.pauseWorkflowRun,
    cancelWorkflowRun: workflowDb.cancelWorkflowRun,
    createWorkflowEvent: async (data): Promise<boolean> => {
      try {
        const persisted = await workflowEventDb.createWorkflowEvent(data);
        if (!persisted) {
          await recordWorkflowEventPersistenceDiagnostic({
            runId: data.workflow_run_id,
            eventType: data.event_type,
            ...(data.step_name ? { stepName: data.step_name } : {}),
            reason: 'database createWorkflowEvent returned best-effort failure',
            persistence: 'best_effort_failed',
          });
          getWorkflowEventEmitter().emit({
            type: 'workflow_event_persist_failed',
            runId: data.workflow_run_id,
            eventType: data.event_type,
            ...(data.step_name ? { stepName: data.step_name } : {}),
            reason: 'database createWorkflowEvent returned best-effort failure',
            persistence: 'best_effort_failed',
          });
        }
        return persisted;
      } catch (err) {
        // Belt-and-suspenders: workflowEventDb.createWorkflowEvent already catches internally,
        // but this wrapper guarantees the IWorkflowStore non-throwing contract at the boundary.
        getLog().error(
          { err: err as Error, eventType: data.event_type, runId: data.workflow_run_id },
          'workflow_event_create_unexpected_throw'
        );
        getWorkflowEventEmitter().emit({
          type: 'workflow_event_persist_failed',
          runId: data.workflow_run_id,
          eventType: data.event_type,
          ...(data.step_name ? { stepName: data.step_name } : {}),
          reason: (err as Error).message,
          persistence: 'best_effort_failed',
        });
        await recordWorkflowEventPersistenceDiagnostic({
          runId: data.workflow_run_id,
          eventType: data.event_type,
          ...(data.step_name ? { stepName: data.step_name } : {}),
          reason: (err as Error).message,
          persistence: 'best_effort_failed',
        });
        return false;
      }
    },
    getCompletedDagNodeOutputs: workflowEventDb.getCompletedDagNodeOutputs,
    getCodebase: codebaseDb.getCodebase,
    getCodebaseEnvVars: envVarDb.getCodebaseEnvVars,
  };
  return markWorkflowEventDiagnosticsAwareStore(store);
}

/**
 * Create the canonical WorkflowDeps for the workflow engine.
 * Single construction point — avoids duplicating the wiring across callers.
 */
export function createWorkflowDeps(): WorkflowDeps {
  return {
    store: createWorkflowStore(),
    getAgentProvider,
    loadConfig: loadMergedConfig,
  };
}
