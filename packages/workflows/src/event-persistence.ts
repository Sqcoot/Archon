import { createLogger } from '@archon/paths';
import type { WorkflowDeps } from './deps';
import { getWorkflowEventEmitter } from './event-emitter';

type WorkflowEventData = Parameters<WorkflowDeps['store']['createWorkflowEvent']>[0];
type CreateWorkflowEvent = WorkflowDeps['store']['createWorkflowEvent'];

const auditedStoreByStore = new WeakMap<WorkflowDeps['store'], WorkflowDeps['store']>();
const rawCreateWorkflowEventByStore = new WeakMap<WorkflowDeps['store'], CreateWorkflowEvent>();
const diagnosticsAwareStores = new WeakSet<WorkflowDeps['store']>();

let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('workflow.event-persistence');
  return cachedLog;
}

function emitWorkflowEventPersistenceFailure(
  data: WorkflowEventData,
  reason: string,
  err?: Error
): void {
  getWorkflowEventEmitter().emit({
    type: 'workflow_event_persist_failed',
    runId: data.workflow_run_id,
    eventType: data.event_type,
    ...(data.step_name ? { stepName: data.step_name } : {}),
    reason: err ? `${reason}: ${err.message}` : reason,
    persistence: 'best_effort_failed',
  });
  getLog().error(
    {
      ...(err ? { err } : {}),
      workflowRunId: data.workflow_run_id,
      eventType: data.event_type,
      stepName: data.step_name,
    },
    'workflow_event_persist_failed'
  );
}

export async function createWorkflowEventWithoutAutoDiagnostics(
  deps: WorkflowDeps,
  data: WorkflowEventData
): Promise<boolean> {
  const rawCreateWorkflowEvent = rawCreateWorkflowEventByStore.get(deps.store);
  return rawCreateWorkflowEvent
    ? rawCreateWorkflowEvent(data)
    : deps.store.createWorkflowEvent(data);
}

export async function persistAuditedWorkflowEvent(
  deps: WorkflowDeps,
  data: WorkflowEventData,
  reason: string
): Promise<void> {
  try {
    const persisted = await createWorkflowEventWithoutAutoDiagnostics(deps, data);
    if (!persisted) {
      emitWorkflowEventPersistenceFailure(data, reason);
    }
  } catch (err) {
    emitWorkflowEventPersistenceFailure(data, reason, err as Error);
  }
}

export function markWorkflowEventDiagnosticsAwareStore<T extends WorkflowDeps['store']>(
  store: T
): T {
  diagnosticsAwareStores.add(store);
  return store;
}

export function withWorkflowEventPersistenceDiagnostics(deps: WorkflowDeps): WorkflowDeps {
  if (diagnosticsAwareStores.has(deps.store)) return deps;

  const existingStore = auditedStoreByStore.get(deps.store);
  if (existingStore) return { ...deps, store: existingStore };

  const rawCreateWorkflowEvent = deps.store.createWorkflowEvent.bind(deps.store);
  const createWorkflowEvent: CreateWorkflowEvent = async data => {
    try {
      const persisted = await rawCreateWorkflowEvent(data);
      if (!persisted) {
        emitWorkflowEventPersistenceFailure(
          data,
          `Workflow event was emitted but not persisted: ${data.event_type}`
        );
      }
      return persisted;
    } catch (err) {
      emitWorkflowEventPersistenceFailure(
        data,
        `Workflow event persistence threw for ${data.event_type}`,
        err as Error
      );
      return false;
    }
  };

  const auditedStore: WorkflowDeps['store'] = {
    ...deps.store,
    createWorkflowEvent,
  };

  auditedStoreByStore.set(deps.store, auditedStore);
  auditedStoreByStore.set(auditedStore, auditedStore);
  rawCreateWorkflowEventByStore.set(auditedStore, rawCreateWorkflowEvent);
  return { ...deps, store: auditedStore };
}
