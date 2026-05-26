import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { queryClient } from '@/lib/query-client';
import { getWorkflowRun } from '@/lib/api';
import { isTerminalStatus } from '@/lib/workflow-utils';
import type {
  WorkflowState,
  DagNodeState,
  WorkflowStatusEvent,
  WorkflowDiagnosticEvent,
  WorkflowArtifactEvent,
  DagNodeEvent,
  WorkflowToolActivityEvent,
  LoopIterationEvent,
  LoopIterationInfo,
} from '@/lib/types';

interface WorkflowStoreState {
  workflows: Map<string, WorkflowState>;
  activeWorkflowId: string | null;
  // Actions
  handleWorkflowStatus: (event: WorkflowStatusEvent) => void;
  handleWorkflowDiagnostic: (event: WorkflowDiagnosticEvent) => void;
  handleWorkflowArtifact: (event: WorkflowArtifactEvent) => void;
  handleDagNode: (event: DagNodeEvent) => void;
  handleLoopIteration: (event: LoopIterationEvent) => void;
  handleWorkflowToolActivity: (event: WorkflowToolActivityEvent) => void;
  handleWorkflowTransportDiagnostic: (input: {
    source: 'dashboard_sse';
    message: string;
    readyState?: number;
  }) => void;
  hydrateWorkflow: (state: WorkflowState) => void;
}

// --- Helpers ---

const MAX_WORKFLOW_DIAGNOSTICS = 10;

/** Derive the active workflow ID: most recent running, or most recent any. */
function deriveActiveId(workflows: Map<string, WorkflowState>): string | null {
  let running: WorkflowState | null = null;
  let newest: WorkflowState | null = null;
  for (const wf of workflows.values()) {
    if (wf.status === 'running' && (!running || wf.startedAt > running.startedAt)) {
      running = wf;
    }
    if (!newest || wf.startedAt > newest.startedAt) {
      newest = wf;
    }
  }
  return (running ?? newest)?.runId ?? null;
}

// --- Polling infrastructure ---

let pollingInterval: ReturnType<typeof setInterval> | null = null;
let initialCheckTimer: ReturnType<typeof setTimeout> | null = null;
let hasRunInitialCheck = false;
let pollingSubscription: (() => void) | null = null;
const pollInFlight = new Set<string>();

function invalidateWorkflowQueries(): void {
  const keys = [
    'workflow-runs',
    'workflowRuns',
    'workflowRun',
    'workflow-runs-status',
    'conversations',
    'workflowMessages',
  ];
  for (const key of keys) {
    queryClient.invalidateQueries({ queryKey: [key] }).catch((err: unknown) => {
      console.warn('[WorkflowStore] Failed to invalidate query cache', {
        queryKey: key,
        error: err instanceof Error ? err.message : err,
      });
    });
  }
}

function checkWorkflowStatus(runId: string): void {
  if (pollInFlight.has(runId)) return;
  pollInFlight.add(runId);
  void getWorkflowRun(runId)
    .then(data => {
      const serverStatus = data.run.status;
      if (isTerminalStatus(serverStatus)) {
        useWorkflowStore.setState(
          state => {
            const existing = state.workflows.get(runId);
            if (existing?.status !== 'running' && existing?.status !== 'pending') return state;
            const next = new Map(state.workflows);
            next.set(runId, {
              ...existing,
              status: serverStatus,
              completedAt: data.run.completed_at
                ? new Date(
                    data.run.completed_at.endsWith('Z')
                      ? data.run.completed_at
                      : data.run.completed_at + 'Z'
                  ).getTime()
                : Date.now(),
            });
            return { workflows: next, activeWorkflowId: deriveActiveId(next) };
          },
          undefined,
          'workflow/pollUpdate'
        );

        invalidateWorkflowQueries();
      }
    })
    .catch((err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[WorkflowStore] Status poll failed', {
        runId,
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        error: errorMessage,
      });
      useWorkflowStore.setState(
        state => {
          const existing = state.workflows.get(runId);
          if (existing?.status !== 'running') return state;
          const next = new Map(state.workflows);
          next.set(runId, {
            ...existing,
            stale: true,
            diagnostics: [
              ...(existing.diagnostics ?? []),
              {
                type: 'workflow_diagnostic' as const,
                runId,
                timestamp: Date.now(),
                severity: 'warning' as const,
                code: 'workflow_status_poll_failed',
                message: `Workflow status refresh failed; displayed status may be stale: ${errorMessage}`,
              },
            ].slice(-MAX_WORKFLOW_DIAGNOSTICS),
          });
          return { workflows: next };
        },
        undefined,
        'workflow/pollStale'
      );
    })
    .finally(() => {
      pollInFlight.delete(runId);
    });
}

function hasRunningWorkflow(workflows: Map<string, WorkflowState>): boolean {
  for (const wf of workflows.values()) {
    if (wf.status === 'running') return true;
  }
  return false;
}

function startPolling(): void {
  if (pollingInterval) return;
  pollingInterval = setInterval(() => {
    const { workflows } = useWorkflowStore.getState();
    for (const wf of workflows.values()) {
      if (wf.status === 'running') {
        checkWorkflowStatus(wf.runId);
      }
    }
  }, 15_000);
}

function stopPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  if (initialCheckTimer) {
    clearTimeout(initialCheckTimer);
    initialCheckTimer = null;
  }
  hasRunInitialCheck = false;
}

// --- Store ---

export const useWorkflowStore = create<WorkflowStoreState>()(
  devtools(
    subscribeWithSelector(set => ({
      workflows: new Map<string, WorkflowState>(),
      activeWorkflowId: null,

      handleWorkflowStatus: (event: WorkflowStatusEvent): void => {
        set(
          state => {
            const next = new Map(state.workflows);
            const existing = next.get(event.runId);

            if (!existing) {
              next.set(event.runId, {
                runId: event.runId,
                workflowName: event.workflowName,
                status: event.status,
                dagNodes: [],
                artifacts: [],
                startedAt: event.timestamp,
                completedAt: isTerminalStatus(event.status) ? event.timestamp : undefined,
                error: event.error,
                failureStage: event.failureStage,
                workflowPreExecutionValidation: event.workflowPreExecutionValidation,
                artifactPath: event.artifactPath,
                approval: event.approval,
                currentTool: null,
              });
            } else {
              // Don't allow a late/replayed SSE event to resurrect a terminal workflow
              if (isTerminalStatus(existing.status) && event.status === 'running') {
                return state;
              }
              next.set(event.runId, {
                ...existing,
                workflowName: event.workflowName || existing.workflowName,
                status: event.status,
                error: event.error,
                failureStage: event.failureStage ?? existing.failureStage,
                workflowPreExecutionValidation:
                  event.workflowPreExecutionValidation ?? existing.workflowPreExecutionValidation,
                artifactPath: event.artifactPath ?? existing.artifactPath,
                completedAt: isTerminalStatus(event.status) ? event.timestamp : undefined,
                approval:
                  event.status === 'paused' ? (event.approval ?? existing.approval) : undefined,
              });
            }
            return { workflows: next, activeWorkflowId: deriveActiveId(next) };
          },
          undefined,
          'workflow/status'
        );

        if (event.status === 'running' || isTerminalStatus(event.status)) {
          invalidateWorkflowQueries();
        }
      },

      handleWorkflowDiagnostic: (event: WorkflowDiagnosticEvent): void => {
        set(
          state => {
            const next = new Map(state.workflows);
            const existing = next.get(event.runId);
            if (!existing) {
              next.set(event.runId, {
                runId: event.runId,
                workflowName: '',
                status: 'running',
                dagNodes: [],
                artifacts: [],
                startedAt: event.timestamp,
                diagnostics: [event],
                currentTool: null,
              });
              return { workflows: next, activeWorkflowId: deriveActiveId(next) };
            }
            next.set(event.runId, {
              ...existing,
              diagnostics: [...(existing.diagnostics ?? []), event].slice(
                -MAX_WORKFLOW_DIAGNOSTICS
              ),
            });
            return { workflows: next, activeWorkflowId: deriveActiveId(next) };
          },
          undefined,
          'workflow/diagnostic'
        );
      },

      handleWorkflowArtifact: (event: WorkflowArtifactEvent): void => {
        set(
          state => {
            const artifact = {
              type: event.artifactType,
              label: event.label,
              url: event.url,
              path: event.path,
              absolutePath: event.absolutePath,
              originalPath: event.originalPath,
              failureStage: event.failureStage,
            };
            const next = new Map(state.workflows);
            const existing = next.get(event.runId);
            if (!existing) {
              next.set(event.runId, {
                runId: event.runId,
                workflowName: '',
                status: 'running',
                dagNodes: [],
                artifacts: [artifact],
                startedAt: event.timestamp,
                currentTool: null,
              });
              return { workflows: next, activeWorkflowId: deriveActiveId(next) };
            }
            next.set(event.runId, {
              ...existing,
              artifacts: [...existing.artifacts, artifact],
            });
            return { workflows: next, activeWorkflowId: deriveActiveId(next) };
          },
          undefined,
          'workflow/artifact'
        );
      },

      handleDagNode: (event: DagNodeEvent): void => {
        set(
          state => {
            const next = new Map(state.workflows);
            const existing = next.get(event.runId);
            const workflow = existing ?? {
              runId: event.runId,
              workflowName: '',
              status: 'running',
              dagNodes: [],
              artifacts: [],
              startedAt: event.timestamp,
              currentTool: null,
            };
            const dagNodes = [...workflow.dagNodes];
            const existingIdx = dagNodes.findIndex(n => n.nodeId === event.nodeId);

            const nodeState: DagNodeState = {
              ...(existingIdx >= 0 ? dagNodes[existingIdx] : {}), // preserve accumulated iteration state
              nodeId: event.nodeId,
              name: event.name,
              status: event.status,
              duration: event.duration,
              error: event.error,
              reason: event.reason,
            };

            if (existingIdx >= 0) {
              dagNodes[existingIdx] = nodeState;
            } else {
              dagNodes.push(nodeState);
            }

            next.set(event.runId, { ...workflow, dagNodes });
            return { workflows: next, activeWorkflowId: deriveActiveId(next) };
          },
          undefined,
          'workflow/dagNode'
        );
      },

      handleLoopIteration: (event: LoopIterationEvent): void => {
        if (!event.nodeId) return; // Non-DAG loops have no nodeId — skip
        set(
          state => {
            const next = new Map(state.workflows);
            const existingWorkflow = next.get(event.runId);
            const orphanDiagnostic = {
              type: 'workflow_diagnostic' as const,
              runId: event.runId,
              timestamp: event.timestamp,
              severity: 'warning' as const,
              code: 'workflow_loop_iteration_orphaned',
              message:
                'Loop iteration event arrived before its DAG node status; live loop progress may be incomplete.',
              eventType: 'workflow_step',
              stepName: event.nodeId,
            };
            if (!existingWorkflow) {
              next.set(event.runId, {
                runId: event.runId,
                workflowName: '',
                status: 'running',
                dagNodes: [],
                artifacts: [],
                startedAt: event.timestamp,
                stale: true,
                diagnostics: [orphanDiagnostic],
                currentTool: null,
              });
              return { workflows: next, activeWorkflowId: deriveActiveId(next) };
            }

            const dagNodes = [...existingWorkflow.dagNodes];
            const existingIdx = dagNodes.findIndex(n => n.nodeId === event.nodeId);
            if (existingIdx < 0) {
              next.set(event.runId, {
                ...existingWorkflow,
                stale: true,
                diagnostics: [...(existingWorkflow.diagnostics ?? []), orphanDiagnostic].slice(
                  -MAX_WORKFLOW_DIAGNOSTICS
                ),
              });
              return { workflows: next, activeWorkflowId: deriveActiveId(next) };
            }

            const existing = dagNodes[existingIdx];
            const iterations: LoopIterationInfo[] = [...(existing.iterations ?? [])];
            const iterIdx = iterations.findIndex(it => it.iteration === event.iteration);
            const iterState: LoopIterationInfo = {
              iteration: event.iteration,
              status: event.status,
              duration: event.duration,
            };
            if (iterIdx >= 0) {
              iterations[iterIdx] = iterState;
            } else {
              iterations.push(iterState);
            }

            dagNodes[existingIdx] = {
              ...existing,
              currentIteration: event.iteration,
              maxIterations: event.total > 0 ? event.total : existing.maxIterations,
              iterations,
            };
            next.set(event.runId, { ...existingWorkflow, dagNodes });
            return { workflows: next, activeWorkflowId: deriveActiveId(next) };
          },
          undefined,
          'workflow/loopIteration'
        );
      },

      handleWorkflowToolActivity: (event: WorkflowToolActivityEvent): void => {
        set(
          state => {
            const next = new Map(state.workflows);
            const existing = next.get(event.runId);
            const currentTool =
              event.status === 'started'
                ? { name: event.toolName, status: 'running' as const }
                : {
                    name: event.toolName,
                    status: 'completed' as const,
                    durationMs: event.durationMs,
                  };
            if (!existing) {
              next.set(event.runId, {
                runId: event.runId,
                workflowName: '',
                status: 'running',
                dagNodes: [],
                artifacts: [],
                startedAt: event.timestamp,
                currentTool,
              });
              return { workflows: next, activeWorkflowId: deriveActiveId(next) };
            }
            next.set(event.runId, {
              ...existing,
              currentTool,
            });
            return { workflows: next, activeWorkflowId: deriveActiveId(next) };
          },
          undefined,
          'workflow/toolActivity'
        );
      },

      handleWorkflowTransportDiagnostic: (input): void => {
        set(
          state => {
            const next = new Map(state.workflows);
            const timestamp = Date.now();
            let changed = false;
            for (const [runId, workflow] of next.entries()) {
              if (isTerminalStatus(workflow.status)) continue;
              changed = true;
              next.set(runId, {
                ...workflow,
                stale: true,
                diagnostics: [
                  ...(workflow.diagnostics ?? []),
                  {
                    type: 'workflow_diagnostic' as const,
                    runId,
                    timestamp,
                    severity: 'warning' as const,
                    code: 'workflow_sse_connection_degraded',
                    message: input.message,
                    eventType: input.source,
                    ...(input.readyState !== undefined
                      ? { stepName: `readyState=${String(input.readyState)}` }
                      : {}),
                  },
                ].slice(-MAX_WORKFLOW_DIAGNOSTICS),
              });
            }
            return changed ? { workflows: next } : state;
          },
          undefined,
          'workflow/transportDiagnostic'
        );
      },

      hydrateWorkflow: (incoming: WorkflowState): void => {
        set(
          state => {
            const existing = state.workflows.get(incoming.runId);
            if (existing) {
              if (
                !isTerminalStatus(incoming.status) ||
                (existing.status !== 'running' && existing.status !== 'pending')
              ) {
                return state;
              }
            }
            const next = new Map(state.workflows);
            next.set(incoming.runId, incoming);
            return { workflows: next, activeWorkflowId: deriveActiveId(next) };
          },
          undefined,
          'workflow/hydrate'
        );
      },
    })),
    { name: 'WorkflowStore', enabled: import.meta.env.DEV }
  )
);

// --- Exports ---

// Selector: reads the derived activeWorkflowId and looks up the WorkflowState.
// Only re-renders when activeWorkflowId changes, not on every Map mutation.
export function selectActiveWorkflow(state: WorkflowStoreState): WorkflowState | null {
  if (!state.activeWorkflowId) return null;
  return state.workflows.get(state.activeWorkflowId) ?? null;
}

// Stable SSE handler object — actions are defined once in create(), so references never change.
// Shared by ChatInterface and WorkflowLogs instead of per-component useShallow selectors.
const {
  handleWorkflowStatus,
  handleWorkflowDiagnostic,
  handleWorkflowArtifact,
  handleDagNode,
  handleLoopIteration,
  handleWorkflowToolActivity,
  handleWorkflowTransportDiagnostic,
} = useWorkflowStore.getState();

export const workflowSSEHandlers = {
  onWorkflowStatus: handleWorkflowStatus,
  onWorkflowDiagnostic: handleWorkflowDiagnostic,
  onWorkflowArtifact: handleWorkflowArtifact,
  onDagNode: handleDagNode,
  onLoopIteration: handleLoopIteration,
  onToolActivity: handleWorkflowToolActivity,
  onWorkflowTransportDiagnostic: handleWorkflowTransportDiagnostic,
} as const;

/** Reset store data and clean up polling timers/subscriptions. Use in tests and HMR. */
export function cleanupWorkflowStore(): void {
  stopPolling();
  pollInFlight.clear();
  pollingSubscription?.();
  pollingSubscription = null;
  // Merge instead of replace — preserves action function references
  // so the module-level workflowSSEHandlers const stays valid.
  useWorkflowStore.setState({ workflows: new Map(), activeWorkflowId: null });
  registerPollingSubscription();
}

// --- Polling lifecycle ---

function registerPollingSubscription(): void {
  pollingSubscription = useWorkflowStore.subscribe(
    state => hasRunningWorkflow(state.workflows),
    hasRunning => {
      if (hasRunning) {
        startPolling();
        if (!hasRunInitialCheck) {
          hasRunInitialCheck = true;
          initialCheckTimer = setTimeout(() => {
            const { workflows } = useWorkflowStore.getState();
            for (const wf of workflows.values()) {
              if (wf.status === 'running') {
                checkWorkflowStatus(wf.runId);
              }
            }
          }, 2_000);
        }
      } else {
        stopPolling();
      }
    }
  );
}

// Initial subscription: auto-start/stop polling whenever a running workflow appears.
// cleanupWorkflowStore() tears down and re-registers this after reset.
registerPollingSubscription();
