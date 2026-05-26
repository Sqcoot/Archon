import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, CheckCircle, MessageSquare, Pause, XCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DagNodeProgress } from './DagNodeProgress';
import { StepLogs } from './StepLogs';
import { WorkflowLogs } from './WorkflowLogs';
import { WorkflowDagViewer } from './WorkflowDagViewer';
import { ArtifactSummary } from './ArtifactSummary';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { ConfirmRunActionDialog } from '@/components/dashboard/ConfirmRunActionDialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useWorkflowStore } from '@/stores/workflow-store';
import {
  approveWorkflowRun,
  getWorkflowRun,
  getWorkflowRunByWorker,
  getCodebase,
  getWorkflow,
  rejectWorkflowRun,
} from '@/lib/api';
import { ensureUtc, formatDurationMs } from '@/lib/format';
import { selectInitialNode } from '@/lib/select-initial-node';
import {
  formatWorkflowApprovalAuditRows,
  normalizeWorkflowApprovalAuditFromMetadata,
  normalizeWorkflowApprovalFromMetadata,
  type WorkflowApprovalAuditSummary,
} from '@/lib/workflow-approval';
import { workflowPersistenceDiagnosticsFromMetadata } from '@/lib/workflow-diagnostics';
import type {
  WorkflowState,
  ArtifactType,
  WorkflowRunStatus,
  DagNodeState,
  WorkflowStepStatus,
  LoopIterationInfo,
  WorkflowDiagnosticEvent,
} from '@/lib/types';

import type { WorkflowEventResponse } from '@/lib/api';

/** Tool call event extracted from workflow_events for display in WorkflowLogs. */
export interface ToolEvent {
  id: string;
  name: string;
  input: Record<string, unknown>;
  stepName?: string;
  stepIndex?: number;
  createdAt: string;
  duration?: number;
}

const TERMINAL_STATUSES: readonly WorkflowRunStatus[] = ['completed', 'failed', 'cancelled'];
const HIGH_IMPACT_APPROVAL_CLASSES = new Set(['destructive', 'credential', 'remote', 'production']);

function isTerminal(status: WorkflowRunStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

function isHighImpactApprovalClass(mutationClass: string | undefined): boolean {
  return mutationClass !== undefined && HIGH_IMPACT_APPROVAL_CLASSES.has(mutationClass);
}

function workflowDiagnosticsFromEvents(
  runId: string,
  events: WorkflowEventResponse[]
): WorkflowDiagnosticEvent[] {
  return events.flatMap((event): WorkflowDiagnosticEvent[] => {
    if (event.event_type !== 'workflow_diagnostic') return [];
    const data = event.data;
    const code = typeof data.code === 'string' ? data.code : 'workflow_diagnostic';
    const message = typeof data.message === 'string' ? data.message : undefined;
    if (!message) return [];
    const severity =
      data.severity === 'error' || data.severity === 'warning' || data.severity === 'info'
        ? data.severity
        : 'warning';
    const persistence =
      data.persistence === 'persisted' || data.persistence === 'best_effort_failed'
        ? data.persistence
        : 'persisted';
    const artifactPath =
      typeof data.artifactPath === 'string'
        ? data.artifactPath
        : typeof data.hook_bootloader_report_path === 'string'
          ? data.hook_bootloader_report_path
          : typeof data.hook_bad_behaviour_lint_path === 'string'
            ? data.hook_bad_behaviour_lint_path
            : undefined;
    const timestamp =
      typeof event.created_at === 'string'
        ? new Date(ensureUtc(event.created_at)).getTime()
        : Date.now();
    return [
      {
        type: 'workflow_diagnostic',
        runId,
        severity,
        code,
        message,
        persistence,
        ...(artifactPath ? { artifactPath } : {}),
        timestamp,
      },
    ];
  });
}

function formatBoolean(value: boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value ? 'yes' : 'no';
}

interface WorkflowRunQueryData {
  workflowState: WorkflowState;
  approvalAudit: WorkflowApprovalAuditSummary | null;
  workerPlatformId: string | null;
  parentPlatformId: string | null;
  conversationPlatformId: string | null;
  codebaseId: string | null;
  events: WorkflowEventResponse[];
}

interface WorkflowExecutionProps {
  runId: string;
}

function StatusBadge({ status }: { status: string }): React.ReactElement {
  const colors: Record<string, string> = {
    pending: 'bg-accent/20 text-accent',
    running: 'bg-accent/20 text-accent',
    completed: 'bg-success/20 text-success',
    failed: 'bg-error/20 text-error',
    cancelled: 'bg-surface text-text-secondary',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? 'bg-surface text-text-secondary'}`}
    >
      {status}
    </span>
  );
}

export function WorkflowExecution({ runId }: WorkflowExecutionProps): React.ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const liveWorkflow = useWorkflowStore(s => s.workflows.get(runId));
  const [selectedDagNode, setSelectedDagNode] = useState<string | null>(null);
  const [codebaseName, setCodebaseName] = useState<string | null>(null);
  const [codebaseCwd, setCodebaseCwd] = useState<string | null>(null);
  const [workerRunId, setWorkerRunId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'graph' | 'logs' | 'chat'>('graph');
  // Increments on every user-initiated node click to trigger scroll in WorkflowLogs
  const [nodeScrollTrigger, setNodeScrollTrigger] = useState(0);
  // Track which codebaseId we've already fetched to avoid stale re-fetches during runId transitions
  const fetchedCodebaseIdRef = useRef<string | null>(null);

  // Reset local state when navigating to a different workflow run
  useEffect(() => {
    setSelectedDagNode(null);
    setCodebaseName(null);
    setCodebaseCwd(null);
    setWorkerRunId(null);
    setActiveView('graph');
    setNodeScrollTrigger(0);
    fetchedCodebaseIdRef.current = null;
  }, [runId]);

  // Fetch workflow run data with polling while running
  const { data: queryData, error: queryError } = useQuery({
    queryKey: ['workflowRun', runId],
    queryFn: async (): Promise<WorkflowRunQueryData> => {
      const data = await getWorkflowRun(runId);
      return {
        workflowState: {
          runId: data.run.id,
          workflowName: data.run.workflow_name,
          status: data.run.status,
          dagNodes: ((): DagNodeState[] => {
            const nodeMap = new Map<string, DagNodeState>();
            for (const e of data.events.filter(ev => ev.event_type.startsWith('node_'))) {
              const nodeId = e.step_name ?? (e.data.nodeId as string) ?? '';
              if (!nodeId) continue;
              const status =
                e.event_type === 'node_started'
                  ? 'running'
                  : e.event_type === 'node_completed'
                    ? 'completed'
                    : e.event_type === 'node_failed'
                      ? 'failed'
                      : 'skipped';
              const existing = nodeMap.get(nodeId);
              // Keep the latest non-running status (completed/failed/skipped override running)
              if (!existing || status !== 'running') {
                nodeMap.set(nodeId, {
                  nodeId,
                  name: nodeId,
                  status: status as WorkflowStepStatus,
                  duration: e.data.duration_ms as number | undefined,
                  error: e.data.error as string | undefined,
                  reason: e.data.reason as 'when_condition' | 'trigger_rule' | undefined,
                });
              }
            }

            // Second pass: enrich loop nodes with iteration data
            for (const e of data.events.filter(ev => ev.event_type.startsWith('loop_iteration_'))) {
              const nodeId = e.step_name ?? '';
              if (!nodeId) continue;
              const existing = nodeMap.get(nodeId);
              if (!existing) continue; // No node_started event yet — skip (events ordered in DB)

              const iteration = e.data.iteration as number | undefined;
              const maxIter = e.data.maxIterations as number | undefined;
              if (iteration === undefined) continue;

              let iterStatus: LoopIterationInfo['status'];
              if (e.event_type === 'loop_iteration_started') {
                iterStatus = 'running';
              } else if (e.event_type === 'loop_iteration_completed') {
                iterStatus = 'completed';
              } else {
                iterStatus = 'failed';
              }

              const existingIters: LoopIterationInfo[] = existing.iterations ?? [];
              const iterIdx = existingIters.findIndex(it => it.iteration === iteration);
              const iterState: LoopIterationInfo = {
                iteration,
                status: iterStatus,
                duration: e.data.duration_ms as number | undefined,
              };
              const newIters = [...existingIters];
              if (iterIdx >= 0) {
                newIters[iterIdx] = iterState;
              } else {
                newIters.push(iterState);
              }

              nodeMap.set(nodeId, {
                ...existing,
                currentIteration: iteration,
                maxIterations: maxIter ?? existing.maxIterations,
                iterations: newIters,
              });
            }

            return Array.from(nodeMap.values());
          })(),
          artifacts: data.events
            .filter(e => e.event_type === 'workflow_artifact')
            .map(e => {
              const d = e.data;
              return {
                type: (d.artifactType as ArtifactType) ?? 'commit',
                label: (d.label as string) ?? '',
                url: d.url as string | undefined,
                path: d.path as string | undefined,
                absolutePath: d.absolutePath as string | undefined,
                originalPath: d.originalPath as string | undefined,
                failureStage:
                  typeof d.failureStage === 'string'
                    ? d.failureStage
                    : typeof d.failure_stage === 'string'
                      ? d.failure_stage
                      : undefined,
              };
            })
            .filter(a => a.label || a.url || a.path),
          startedAt: new Date(ensureUtc(data.run.started_at)).getTime(),
          completedAt: data.run.completed_at
            ? new Date(ensureUtc(data.run.completed_at)).getTime()
            : undefined,
          approval:
            data.run.status === 'paused'
              ? normalizeWorkflowApprovalFromMetadata(data.run.metadata)
              : undefined,
          diagnostics: [
            ...workflowPersistenceDiagnosticsFromMetadata(data.run.id, data.run.metadata),
            ...workflowDiagnosticsFromEvents(data.run.id, data.events),
          ],
        },
        approvalAudit: normalizeWorkflowApprovalAuditFromMetadata(data.run.metadata) ?? null,
        workerPlatformId: data.run.worker_platform_id ?? null,
        parentPlatformId: data.run.parent_platform_id ?? null,
        conversationPlatformId: data.run.conversation_platform_id ?? null,
        codebaseId: data.run.codebase_id ?? null,
        events: data.events,
      };
    },
    refetchInterval: (query): number | false => {
      const status = query.state.data?.workflowState.status;
      if (status && isTerminal(status)) return false;
      return 3000;
    },
    staleTime: 0,
  });

  const initialData = queryData?.workflowState ?? null;
  const approvalAudit = queryData?.approvalAudit ?? null;
  const workerPlatformId = queryData?.workerPlatformId ?? null;
  const parentPlatformId = queryData?.parentPlatformId ?? null;
  const conversationPlatformId = queryData?.conversationPlatformId ?? null;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  // Extract tool_called events from workflow events for WorkflowLogs,
  // matching each with its corresponding tool_completed to get duration.
  const toolEvents = useMemo((): ToolEvent[] => {
    const allEvents = queryData?.events ?? [];
    const completedEvents = allEvents
      .filter(ev => ev.event_type === 'tool_completed')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Greedy match: claim the earliest tool_completed with matching name after evTime.
    // usedCompleted tracks claimed IDs to prevent double-use. Local mutation is intentional.
    const usedCompleted = new Set<string>();

    return allEvents
      .filter(ev => ev.event_type === 'tool_called')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(ev => {
        const evTime = new Date(ev.created_at).getTime();
        const toolName = ev.data.tool_name as string;
        const stepName = ev.step_name ?? undefined;
        const completed = completedEvents.find(
          c =>
            !usedCompleted.has(c.id) &&
            (c.data.tool_name as string) === toolName &&
            new Date(c.created_at).getTime() >= evTime &&
            (c.step_name ?? undefined) === stepName
        );
        if (completed) usedCompleted.add(completed.id);
        return {
          id: ev.id,
          name: toolName,
          input: (ev.data.tool_input as Record<string, unknown>) ?? {},
          stepName: ev.step_name ?? undefined,
          stepIndex: ev.step_index ?? undefined,
          createdAt: ev.created_at,
          duration: completed ? (completed.data.duration_ms as number | undefined) : undefined,
        };
      });
  }, [queryData?.events]);

  // Fetch codebase name when run data becomes available
  const codebaseId = queryData?.codebaseId ?? null;
  useEffect(() => {
    if (!codebaseId || fetchedCodebaseIdRef.current === codebaseId) return;
    fetchedCodebaseIdRef.current = codebaseId;
    void getCodebase(codebaseId)
      .then(cb => {
        setCodebaseName(cb.name);
        setCodebaseCwd(cb.default_cwd);
      })
      .catch((err: unknown) => {
        console.warn('[WorkflowExecution] Failed to load codebase name', {
          codebaseId,
          error: err instanceof Error ? err.message : err,
        });
      });
  }, [codebaseId]);

  // Fetch workflow definition for DAG topology (depends_on edges).
  // Only gated on workflowName — codebaseCwd is optional; when absent the server tries the
  // first registered codebase before falling back to bundled defaults (handles CLI runs and
  // "No project" web runs).
  const {
    data: workflowDef,
    error: workflowDefError,
    isPending: workflowDefPending,
  } = useQuery({
    queryKey: ['workflowDefinition', initialData?.workflowName, codebaseCwd],
    queryFn: () => getWorkflow(initialData?.workflowName ?? '', codebaseCwd ?? undefined),
    enabled: !!initialData?.workflowName,
    staleTime: Infinity,
  });
  const dagDefinitionNodes = workflowDef?.workflow?.nodes ?? null;
  const dagDefinitionErrorMessage = workflowDefError
    ? workflowDefError instanceof Error
      ? workflowDefError.message
      : String(workflowDefError)
    : null;
  // Use workflow definition when available, fall back to dagNodes from run state.
  const isDag = dagDefinitionNodes !== null || (initialData?.dagNodes.length ?? 0) > 0;

  // When SSE reports a terminal status but React Query data is still stale,
  // invalidate the cache to trigger an immediate re-fetch with correct data.
  const liveStatus = liveWorkflow?.status;
  useEffect(() => {
    if (!liveStatus || !isTerminal(liveStatus)) return;
    if (initialData && isTerminal(initialData.status)) return; // Already up to date
    void queryClient.invalidateQueries({ queryKey: ['workflowRun', runId] });
  }, [runId, liveStatus, initialData, queryClient]);

  // Look up the workflow run associated with this worker conversation
  useEffect(() => {
    if (!workerPlatformId) return;
    getWorkflowRunByWorker(workerPlatformId)
      .then(result => {
        if (result) {
          setWorkerRunId(result.run.id);
        }
      })
      .catch((err: unknown) => {
        // Non-critical — "View Run" link just won't appear
        console.warn('[WorkflowExecution] Failed to look up worker run', {
          workerPlatformId,
          error: err instanceof Error ? err.message : err,
        });
      });
  }, [workerPlatformId]);

  // Merge REST (initialData) and SSE (liveWorkflow) data.
  // REST provides structural data (steps, startedAt, artifacts) from DB.
  // SSE provides live status updates (status, completedAt, error).
  // When a `running` SSE event is missed (no buffering), the first SSE event
  // seen is `completed` — which creates liveWorkflow with steps:[] and
  // startedAt=completionTime. We must preserve initialData's structure in that case.
  const workflow = ((): WorkflowState | null => {
    if (!liveWorkflow) return initialData;
    if (!initialData) return liveWorkflow;
    if (isTerminal(initialData.status) && !isTerminal(liveWorkflow.status)) {
      console.warn('[WorkflowExecution] REST overrides stale SSE status', {
        runId,
        restStatus: initialData.status,
        sseStatus: liveWorkflow.status,
      });
      return initialData;
    }
    // Merge: use liveWorkflow's dynamic status but preserve initialData's
    // structural data when liveWorkflow is sparse (missed earlier events).
    return {
      ...initialData,
      status: liveWorkflow.status,
      completedAt: liveWorkflow.completedAt ?? initialData.completedAt,
      error: liveWorkflow.error ?? initialData.error,
      // SSE accumulates dagNodes/artifacts incrementally — prefer them when populated,
      // otherwise fall back to the REST snapshot.
      dagNodes: liveWorkflow.dagNodes.length > 0 ? liveWorkflow.dagNodes : initialData.dagNodes,
      artifacts: liveWorkflow.artifacts.length > 0 ? liveWorkflow.artifacts : initialData.artifacts,
      approval:
        liveWorkflow.status === 'paused'
          ? (liveWorkflow.approval ?? initialData.approval)
          : undefined,
      diagnostics: Array.from(
        new Map(
          [...(initialData.diagnostics ?? []), ...(liveWorkflow.diagnostics ?? [])].map(
            diagnostic => [
              `${diagnostic.code}:${diagnostic.timestamp}:${diagnostic.eventType ?? ''}:${diagnostic.stepName ?? ''}:${diagnostic.message}`,
              diagnostic,
            ]
          )
        ).values()
      ).slice(-5),
      currentIteration: liveWorkflow.currentIteration ?? initialData.currentIteration,
      maxIterations: liveWorkflow.maxIterations ?? initialData.maxIterations,
    };
  })();

  // Auto-select the first DAG node when workflow data loads and no node is selected.
  // Prefer the currently executing node (for running workflows), otherwise pick the first node.
  useEffect(() => {
    if (selectedDagNode !== null) return;
    const nodeId = selectInitialNode(workflow?.dagNodes);
    if (nodeId) setSelectedDagNode(nodeId);
  }, [selectedDagNode, workflow?.dagNodes]);

  // Force re-render every second while workflow is running (for live timer)
  const [, setTick] = useState(0);
  useEffect(() => {
    if (workflow?.status !== 'running' && workflow?.status !== 'pending') return;
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return (): void => {
      clearInterval(interval);
    };
  }, [workflow?.status]);

  // Derive the currently executing node/step from events data
  const currentlyExecuting = useMemo((): { nodeName: string; startedAt: number } | null => {
    if (!queryData?.events || workflow?.status !== 'running') return null;
    const events = queryData.events;

    // Find nodes that started but haven't completed/failed/skipped
    const startedNodes = new Set<string>();
    const completedNodes = new Set<string>();

    for (const e of events) {
      const nodeId = e.step_name ?? '';
      if (e.event_type === 'node_started') startedNodes.add(nodeId);
      if (
        e.event_type === 'node_completed' ||
        e.event_type === 'node_failed' ||
        e.event_type === 'node_skipped'
      ) {
        completedNodes.add(nodeId);
      }
    }

    // Find the first started-but-not-completed node
    for (const nodeId of startedNodes) {
      if (!completedNodes.has(nodeId)) {
        const startEvent = events.find(
          e => e.event_type === 'node_started' && e.step_name === nodeId
        );
        if (startEvent) {
          return {
            nodeName: nodeId,
            startedAt: new Date(ensureUtc(startEvent.created_at)).getTime(),
          };
        }
      }
    }

    return null;
  }, [queryData?.events, workflow?.status]);

  // Compute formatted log lines for the selected DAG node from DB events.
  const stepLogLines = useMemo((): string[] => {
    const events = queryData?.events ?? [];
    const stepEvents =
      selectedDagNode !== null ? events.filter(e => e.step_name === selectedDagNode) : [];
    if (stepEvents.length === 0) return [];

    return stepEvents.map(e => {
      const ts = new Date(ensureUtc(e.created_at)).toLocaleTimeString();
      switch (e.event_type) {
        case 'loop_iteration_started':
          return `[${ts}] Iteration ${String(e.data.iteration)}/${String((e.data.maxIterations as number | undefined) ?? '?')} started`;
        case 'loop_iteration_completed': {
          const dur = e.data.duration_ms as number | undefined;
          const durStr = dur !== undefined ? ` (${String(Math.round(dur / 100) / 10)}s)` : '';
          return `[${ts}] Iteration ${String(e.data.iteration)} completed${durStr}`;
        }
        case 'loop_iteration_failed':
          return `[${ts}] Iteration ${String(e.data.iteration)} failed: ${(e.data.error as string | undefined) ?? 'Unknown error'}`;
        case 'node_started':
          return `[${ts}] Node started: ${e.step_name ?? 'node'}`;
        case 'node_completed':
          return `[${ts}] Node completed: ${e.step_name ?? 'node'}`;
        case 'node_failed':
          return `[${ts}] Node failed: ${e.step_name ?? 'node'}: ${(e.data.error as string | undefined) ?? 'Unknown error'}`;
        case 'node_skipped':
          return `[${ts}] Node skipped: ${e.step_name ?? 'node'}`;
        default:
          return `[${ts}] ${e.event_type}${e.step_name ? `: ${e.step_name}` : ''}`;
      }
    });
  }, [queryData?.events, selectedDagNode]);

  // Detect whether the selected node has any DB events so we can show an empty-state
  // overlay when a node has no output. Guard with isRunning so we never hide the live stream
  // for a currently-executing node that hasn't emitted events yet.
  const selectedStepHasEvents = useMemo((): boolean => {
    if (!queryData?.events || selectedDagNode === null) return false;
    return queryData.events.some(e => e.step_name === selectedDagNode);
  }, [queryData?.events, selectedDagNode]);

  // Compute start timestamps for each DAG node from workflow events.
  // Used to scroll the logs panel to the right position when a node is selected.
  const nodeStartTimes = useMemo((): Map<string, number> => {
    const map = new Map<string, number>();
    for (const e of queryData?.events ?? []) {
      if (e.event_type === 'node_started' && e.step_name) {
        map.set(e.step_name, new Date(ensureUtc(e.created_at)).getTime());
      }
    }
    return map;
  }, [queryData?.events]);

  const scrollToNodeTimestamp = selectedDagNode
    ? (nodeStartTimes.get(selectedDagNode) ?? null)
    : null;

  // Handler for user-initiated node clicks (graph or sidebar).
  // Increments scroll trigger so WorkflowLogs scrolls to the node's section.
  const handleNodeClick = useCallback((nodeId: string): void => {
    setSelectedDagNode(nodeId);
    setNodeScrollTrigger(prev => prev + 1);
  }, []);

  const approveMutation = useMutation({
    mutationFn: (input: { scope?: 'once'; confirmHighImpact?: boolean }) =>
      approveWorkflowRun(runId, undefined, input.scope, input.confirmHighImpact),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflowRun', runId] });
    },
  });
  const rejectMutation = useMutation({
    mutationFn: (reason?: string) => rejectWorkflowRun(runId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflowRun', runId] });
    },
  });

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-error">
        <p>Failed to load workflow run: {error}</p>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary">
        <p>Loading workflow execution...</p>
      </div>
    );
  }

  // Only trust initialData.startedAt (from DB) for elapsed calculation.
  // SSE's startedAt is unreliable when 'running' was missed and the first event
  // is 'completed', which sets startedAt = completedAt = same Date.now().
  // Show 0 until REST fetch provides the authoritative timestamp.
  const startedAt = initialData?.startedAt ?? 0;
  const completedAt =
    initialData && isTerminal(initialData.status) && initialData.completedAt
      ? initialData.completedAt
      : (workflow.completedAt ?? (startedAt ? Date.now() : 0));
  const elapsed = startedAt ? Math.max(0, completedAt - startedAt) : 0;

  const isRunning = workflow.status === 'running' || workflow.status === 'pending';
  const diagnostics = liveWorkflow?.diagnostics ?? workflow.diagnostics ?? [];
  const approval = workflow.status === 'paused' ? workflow.approval : undefined;
  const approvalScopes = approval?.allowedScopes ?? (approval != null ? ['once'] : []);
  const approvalDefaultScope = approval?.defaultScope ?? approvalScopes[0] ?? 'once';
  const approvalIsHighImpact =
    approval?.highImpact === true || isHighImpactApprovalClass(approval?.mutationClass);
  const approvalMutationError = approveMutation.error ?? rejectMutation.error;
  const approvalAuditRows = formatWorkflowApprovalAuditRows(approvalAudit);

  const confirmHighImpactApproval = (): boolean => {
    if (!approvalIsHighImpact) return true;
    return window.confirm(
      [
        `High-impact approval: ${approval?.mutationClass ?? 'unknown'}`,
        approval?.path ? `Path: ${approval.path}` : undefined,
        approval?.command ? `Command: ${approval.command}` : undefined,
        approval?.reason ? `Reason: ${approval.reason}` : undefined,
        '',
        'Approve only if you intend to allow this high-impact workflow gate.',
      ]
        .filter((line): line is string => line !== undefined)
        .join('\n')
    );
  };

  // Pick the platform ID for logs: worker takes precedence over conversation.
  const logsPlatformId = workerPlatformId ?? conversationPlatformId;

  // Logs panel — detect whether the selected node has any DB events so we can show an empty-state
  const logsPanel = (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 h-full">
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {logsPlatformId && !selectedStepHasEvents && !isRunning ? (
          <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
            No output available for this step.
          </div>
        ) : logsPlatformId ? (
          <WorkflowLogs
            conversationId={logsPlatformId}
            startedAt={initialData?.startedAt}
            isRunning={isRunning}
            currentlyExecuting={currentlyExecuting}
            toolEvents={toolEvents}
            scrollToNodeTimestamp={scrollToNodeTimestamp}
            nodeScrollTrigger={nodeScrollTrigger}
          />
        ) : (
          <StepLogs runId={runId} lines={stepLogLines} />
        )}
      </div>
      {!isRunning && workflow.artifacts.length > 0 && (
        <div className="border-t border-border p-3">
          <ArtifactSummary artifacts={workflow.artifacts} runId={runId} />
        </div>
      )}
    </div>
  );

  const renderBody = (): React.ReactElement => {
    if (isDag && activeView === 'graph') {
      return (
        <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
          <ResizablePanel defaultSize={60} minSize={30}>
            {dagDefinitionNodes ? (
              <WorkflowDagViewer
                dagNodes={dagDefinitionNodes}
                liveStatus={workflow.dagNodes}
                isRunning={isRunning}
                currentlyExecuting={currentlyExecuting ?? undefined}
                selectedNodeId={selectedDagNode}
                onNodeClick={handleNodeClick}
              />
            ) : dagDefinitionErrorMessage ? (
              <div className="flex flex-col items-center justify-center h-full text-text-secondary px-4 text-center">
                <p className="text-error mb-1">Failed to load workflow graph</p>
                <p className="text-xs mb-3">{dagDefinitionErrorMessage}</p>
                <button
                  type="button"
                  onClick={(): void => {
                    queryClient
                      .resetQueries({
                        queryKey: ['workflowDefinition', initialData?.workflowName, codebaseCwd],
                      })
                      .catch((err: unknown) => {
                        console.error('[WorkflowExecution] Retry resetQueries failed', {
                          workflowName: initialData?.workflowName,
                          error: err instanceof Error ? err.message : err,
                        });
                      });
                  }}
                  className="text-xs text-primary hover:text-accent-bright transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : workflowDefPending ? (
              <div className="flex items-center justify-center h-full text-text-secondary">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent mr-2" />
                Loading graph...
              </div>
            ) : (
              // Final fallback: query resolved with no nodes and no error.
              // Covers older runs whose stored workflow has no DAG.
              <div className="flex items-center justify-center h-full text-text-secondary px-4 text-center">
                <p>Workflow graph unavailable for this run.</p>
              </div>
            )}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40} minSize={20}>
            {logsPanel}
          </ResizablePanel>
        </ResizablePanelGroup>
      );
    }
    if (isDag && activeView === 'chat' && parentPlatformId) {
      return (
        <div className="flex flex-col flex-1 overflow-hidden min-h-0">
          <ChatInterface conversationId={parentPlatformId} />
        </div>
      );
    }
    // Logs view: DAG "Logs" tab
    return (
      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="w-64 border-r border-border overflow-auto">
          <DagNodeProgress
            nodes={workflow.dagNodes}
            activeNodeId={selectedDagNode}
            onNodeClick={handleNodeClick}
          />
        </div>
        {logsPanel}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button
          onClick={(): void => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/workflows');
            }
          }}
          className="text-text-secondary hover:text-text-primary transition-colors text-sm"
          title="Back"
        >
          &larr;
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-semibold text-text-primary truncate">{workflow.workflowName}</h2>
          <StatusBadge status={workflow.status} />
        </div>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {codebaseName && <span className="text-xs text-text-secondary">{codebaseName}</span>}
          {workerRunId && (
            <button
              onClick={(): void => {
                navigate(`/workflows/runs/${workerRunId}`);
              }}
              className="flex items-center gap-1 text-xs text-primary hover:text-accent-bright transition-colors"
              title="View workflow run details"
            >
              <span>Run Details</span>
            </button>
          )}
          <span className="text-xs text-text-secondary">{formatDurationMs(elapsed)}</span>
        </div>
      </div>

      {diagnostics.length > 0 && (
        <div className="border-b border-warning/20 bg-warning/5 px-4 py-2 text-xs text-warning">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0 space-y-1">
              <p className="font-medium">Workflow diagnostics</p>
              {diagnostics.map(diagnostic => (
                <div
                  key={`${diagnostic.code}:${diagnostic.timestamp}`}
                  className="break-words text-warning/90"
                >
                  <span className="font-mono">{diagnostic.code}</span>
                  <span>: {diagnostic.message}</span>
                  {diagnostic.persistence && (
                    <span className="ml-1 font-mono">({diagnostic.persistence})</span>
                  )}
                  {diagnostic.eventType && (
                    <span className="ml-1 text-warning/80">event={diagnostic.eventType}</span>
                  )}
                  {diagnostic.stepName && (
                    <span className="ml-1 text-warning/80">step={diagnostic.stepName}</span>
                  )}
                  {diagnostic.artifactPath && (
                    <span className="ml-1">
                      Artifact:{' '}
                      <span className="font-mono break-all">{diagnostic.artifactPath}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {approvalAuditRows.length > 0 && (
        <div className="border-b border-primary/20 bg-primary/5 px-4 py-2 text-xs text-text-secondary">
          <div className="flex items-start gap-2">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-text-primary">Approval audit</p>
              <dl className="grid gap-0.5">
                {approvalAuditRows.map(([label, value]) => (
                  <div key={label} className="break-words">
                    <dt className="inline text-text-tertiary">{label}: </dt>
                    <dd className="inline">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      )}

      {workflow.status === 'paused' && (
        <div className="border-b border-warning/20 bg-warning/5 px-4 py-3 text-xs text-text-secondary">
          <div className="flex items-start gap-2">
            <Pause className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="space-y-1">
                <p className="font-medium text-text-primary">
                  {approval?.message ?? 'Waiting for approval'}
                </p>
                {approval && (
                  <dl className="grid gap-0.5">
                    {approval.mutationClass && (
                      <div>
                        <dt className="inline text-text-tertiary">Mutation class: </dt>
                        <dd className="inline font-mono">{approval.mutationClass}</dd>
                      </div>
                    )}
                    {approval.approvalChannel && (
                      <div>
                        <dt className="inline text-text-tertiary">Approval channel: </dt>
                        <dd className="inline font-mono">{approval.approvalChannel}</dd>
                      </div>
                    )}
                    {approval.highImpact !== undefined && (
                      <div>
                        <dt className="inline text-text-tertiary">High impact: </dt>
                        <dd className="inline font-mono">{formatBoolean(approval.highImpact)}</dd>
                      </div>
                    )}
                    {approval.highImpactConfirmed !== undefined && (
                      <div>
                        <dt className="inline text-text-tertiary">High-impact confirmed: </dt>
                        <dd className="inline font-mono">
                          {formatBoolean(approval.highImpactConfirmed)}
                        </dd>
                      </div>
                    )}
                    {approval.path && (
                      <div>
                        <dt className="inline text-text-tertiary">Path: </dt>
                        <dd className="inline font-mono">{approval.path}</dd>
                      </div>
                    )}
                    {approval.command && (
                      <div>
                        <dt className="inline text-text-tertiary">Command: </dt>
                        <dd className="inline font-mono">{approval.command}</dd>
                      </div>
                    )}
                    {approval.reason && (
                      <div>
                        <dt className="inline text-text-tertiary">Reason: </dt>
                        <dd className="inline">{approval.reason}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="inline text-text-tertiary">Default scope: </dt>
                      <dd className="inline font-mono">{approvalDefaultScope}</dd>
                    </div>
                    <div>
                      <dt className="inline text-text-tertiary">Allowed scopes: </dt>
                      <dd className="inline font-mono">{approvalScopes.join(', ')}</dd>
                    </div>
                  </dl>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {approvalScopes.includes('once') && (
                  <button
                    type="button"
                    onClick={(): void => {
                      if (confirmHighImpactApproval()) {
                        approveMutation.mutate({
                          scope: 'once',
                          confirmHighImpact: approvalIsHighImpact,
                        });
                      }
                    }}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-success/80 hover:bg-success/10 hover:text-success transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Approve once
                  </button>
                )}
                {approvalScopes.includes('run') && (
                  <span className="rounded-md bg-warning/10 px-2 py-1 text-xs text-warning">
                    Approve for run unavailable: run-scoped approval is not implemented end-to-end
                    yet.
                  </span>
                )}
                <ConfirmRunActionDialog
                  trigger={
                    <button
                      type="button"
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-error/80 hover:bg-error/10 hover:text-error transition-colors disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  }
                  title="Reject workflow?"
                  description={
                    <>
                      Reject the paused workflow <strong>{workflow.workflowName}</strong>. If the
                      approval node defines an <code>on_reject</code> prompt, it runs with your
                      reason as <code>$REJECTION_REASON</code>; otherwise the run is cancelled.
                    </>
                  }
                  confirmLabel="Reject"
                  reasonInput={{
                    label: 'Reason (optional)',
                    placeholder: 'Why are you rejecting? Visible to the on_reject prompt.',
                  }}
                  onConfirm={(reason): void => {
                    rejectMutation.mutate(reason);
                  }}
                />
              </div>
              {(approveMutation.isError || rejectMutation.isError) && (
                <p className="text-xs text-error">
                  {approvalMutationError instanceof Error
                    ? approvalMutationError.message
                    : 'Action failed - please try again'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View tabs — only for DAG workflows */}
      {isDag && (
        <div className="flex items-center px-4 py-1.5 border-b border-border">
          <Tabs
            value={activeView}
            onValueChange={(v): void => {
              setActiveView(v as typeof activeView);
            }}
          >
            <TabsList>
              <TabsTrigger value="graph">Graph</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              {parentPlatformId && (
                <TabsTrigger value="chat">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Chat
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Body — content depends on activeView for DAG, or default layout for sequential */}
      {renderBody()}
    </div>
  );
}
