import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle, ChevronRight, Loader2, Pause, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { approveWorkflowRun, getWorkflowRunByWorker, rejectWorkflowRun } from '@/lib/api';
import { useWorkflowStore } from '@/stores/workflow-store';
import { ConfirmRunActionDialog } from '@/components/dashboard/ConfirmRunActionDialog';
import { ArtifactSummary } from '@/components/workflows/ArtifactSummary';
import { StatusIcon } from '@/components/workflows/StatusIcon';
import { formatDurationMs } from '@/lib/format';
import {
  formatWorkflowApprovalAuditRows,
  normalizeWorkflowApprovalAuditFromMetadata,
  normalizeWorkflowApprovalFromMetadata,
} from '@/lib/workflow-approval';
import { workflowPersistenceDiagnosticsFromMetadata } from '@/lib/workflow-diagnostics';
import { isTerminalStatus } from '@/lib/workflow-utils';
import type { DagNodeState } from '@/lib/types';

const HIGH_IMPACT_APPROVAL_CLASSES = new Set(['destructive', 'credential', 'remote', 'production']);

function isHighImpactApprovalClass(mutationClass: string | undefined): boolean {
  return mutationClass !== undefined && HIGH_IMPACT_APPROVAL_CLASSES.has(mutationClass);
}

interface WorkflowProgressCardProps {
  workflowName: string;
  workerConversationId: string;
}

export function WorkflowProgressCard({
  workflowName,
  workerConversationId,
}: WorkflowProgressCardProps): React.ReactElement {
  const navigate = useNavigate();

  // REST polling for run data (stops when terminal)
  const {
    data: runData,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['workflowRunByWorker', workerConversationId],
    queryFn: () => getWorkflowRunByWorker(workerConversationId),
    refetchInterval: (query): number | false => {
      const status = query.state.data?.run?.status;
      if (status === 'completed' || status === 'failed' || status === 'cancelled') return false;
      return 3000;
    },
  });

  const runId = runData?.run?.id;
  const restStatus = runData?.run?.status;

  // Live SSE state from Zustand store
  const liveState = useWorkflowStore(state => (runId ? state.workflows.get(runId) : undefined));

  // Merge: prefer live state when available
  const status = liveState?.status ?? restStatus;
  const dagNodes: DagNodeState[] = liveState?.dagNodes ?? [];
  const currentTool = liveState?.currentTool ?? null;
  const approval =
    liveState?.approval ?? normalizeWorkflowApprovalFromMetadata(runData?.run?.metadata) ?? null;
  const approvalAuditRows = formatWorkflowApprovalAuditRows(
    normalizeWorkflowApprovalAuditFromMetadata(runData?.run?.metadata)
  );
  const error = liveState?.error;
  const diagnostics =
    liveState?.diagnostics ??
    (runId ? workflowPersistenceDiagnosticsFromMetadata(runId, runData?.run?.metadata) : []);
  const liveArtifacts = liveState?.artifacts ?? [];
  const startedAt = liveState?.startedAt;

  const completedCount = dagNodes.filter(n => n.status === 'completed').length;
  const totalNodes = dagNodes.length;
  const isRunning = status === 'running' || status === 'pending';
  const isPaused = status === 'paused';

  // Expand/collapse state
  const [expanded, setExpanded] = useState(false);
  const userToggled = useRef(false);

  // Auto-expand when running or paused, auto-collapse when terminal (unless user toggled)
  useEffect(() => {
    if (userToggled.current) return;
    if (isRunning || isPaused) {
      setExpanded(true);
    } else if (isTerminalStatus(status)) {
      setExpanded(false);
    }
  }, [isRunning, isPaused, status]);

  // Live elapsed timer
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isRunning || !startedAt) return;
    setElapsed(Date.now() - startedAt);
    const interval = setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 1000);
    return (): void => {
      clearInterval(interval);
    };
  }, [isRunning, startedAt]);

  // Approve/reject mutations
  const approvalIsHighImpact =
    approval?.highImpact === true || isHighImpactApprovalClass(approval?.mutationClass);
  const approveMutation = useMutation({
    mutationFn: (input: { scope?: 'once'; confirmHighImpact?: boolean }) =>
      approveWorkflowRun(runId ?? '', undefined, input.scope, input.confirmHighImpact),
  });
  const rejectMutation = useMutation({
    mutationFn: (reason?: string) => rejectWorkflowRun(runId ?? '', reason),
  });
  const mutationError = approveMutation.error ?? rejectMutation.error;
  const approvalScopes = approval?.allowedScopes ?? (approval != null ? ['once'] : []);
  const approvalDefaultScope = approval?.defaultScope ?? approvalScopes[0] ?? 'once';

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

  // Completed duration from live state
  const completedAt = liveState?.completedAt;
  const finalDuration = completedAt && startedAt ? completedAt - startedAt : null;

  const handleHeaderClick = (): void => {
    userToggled.current = true;
    setExpanded(prev => !prev);
  };

  const handleViewFullScreen = (): void => {
    if (runId) {
      navigate(`/workflows/runs/${runId}`);
    } else {
      navigate(`/chat/${encodeURIComponent(workerConversationId)}`);
    }
  };

  // Loading state: no run data yet
  if (!runData && !isError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs max-w-md">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
        <span className="truncate text-text-primary font-medium">{workflowName}</span>
        <span className="text-text-tertiary">Starting...</span>
      </div>
    );
  }

  // Error state: couldn't fetch run
  if (isError && !runData) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs max-w-md">
        <span className="text-error text-xs shrink-0">&#x26A0;</span>
        <span className="truncate text-text-primary font-medium">{workflowName}</span>
        <button
          onClick={(): void => {
            refetch();
          }}
          className="text-primary hover:text-accent-bright transition-colors shrink-0"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface transition-colors max-w-md overflow-hidden',
        isRunning && 'border-l-2 border-l-primary',
        isPaused && 'border-l-2 border-l-warning'
      )}
    >
      {/* Header bar - always visible, clickable */}
      <button
        onClick={handleHeaderClick}
        className="flex h-9 w-full items-center gap-2 px-3 text-left"
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-text-tertiary transition-transform duration-150',
            expanded && 'rotate-90'
          )}
        />
        <span className="shrink-0">
          <StatusIcon status={status ?? 'pending'} />
        </span>
        <span className="truncate text-xs font-medium text-text-primary">{workflowName}</span>
        {totalNodes > 0 && (
          <span className="shrink-0 text-[10px] text-text-secondary">
            {String(completedCount)}/{String(totalNodes)} nodes
          </span>
        )}
        <span className="ml-auto shrink-0">
          {isRunning && elapsed > 0 ? (
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] text-primary">
              {formatDurationMs(elapsed)}
            </span>
          ) : finalDuration != null ? (
            <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] text-text-secondary">
              {formatDurationMs(finalDuration)}
            </span>
          ) : null}
        </span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-border">
          {/* Node list */}
          {dagNodes.length > 0 && (
            <div className="space-y-0.5 px-3 py-2">
              {dagNodes.map((node: DagNodeState) => (
                <div key={node.nodeId} className="flex items-center gap-2 text-xs py-0.5">
                  <span className="shrink-0">
                    <StatusIcon status={node.status} />
                  </span>
                  <span className="truncate flex-1 text-text-secondary">{node.name}</span>
                  {node.duration !== undefined && (
                    <span className="shrink-0 text-[10px] text-text-tertiary">
                      {formatDurationMs(node.duration)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Approval request banner */}
          {isPaused && (
            <div className="border-t border-border px-3 py-2 space-y-2">
              <div className="rounded-md bg-warning/5 border border-warning/20 px-3 py-2 flex items-start gap-2">
                <Pause className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-text-secondary">
                  <p>{approval?.message ?? 'Waiting for approval'}</p>
                  {approval != null &&
                    (approval.mutationClass ||
                      approval.path ||
                      approval.command ||
                      approval.reason ||
                      approvalScopes.length > 0) && (
                      <dl className="grid gap-0.5">
                        {approval.mutationClass && (
                          <div>
                            <dt className="inline text-text-tertiary">Mutation class: </dt>
                            <dd className="inline font-mono">{approval.mutationClass}</dd>
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
                        {approval.approvalChannel && (
                          <div>
                            <dt className="inline text-text-tertiary">Approval channel: </dt>
                            <dd className="inline font-mono">{approval.approvalChannel}</dd>
                          </div>
                        )}
                        {approval.highImpact !== undefined && (
                          <div>
                            <dt className="inline text-text-tertiary">High impact: </dt>
                            <dd className="inline font-mono">
                              {approval.highImpact ? 'yes' : 'no'}
                            </dd>
                          </div>
                        )}
                        {approval.highImpactConfirmed !== undefined && (
                          <div>
                            <dt className="inline text-text-tertiary">High-impact confirmed: </dt>
                            <dd className="inline font-mono">
                              {approval.highImpactConfirmed ? 'yes' : 'no'}
                            </dd>
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
              </div>
              <div className="flex items-center gap-2">
                {approvalScopes.includes('once') && (
                  <button
                    onClick={() => {
                      if (confirmHighImpactApproval()) {
                        approveMutation.mutate({
                          scope: 'once',
                          confirmHighImpact: approvalIsHighImpact,
                        });
                      }
                    }}
                    disabled={!runId || approveMutation.isPending || rejectMutation.isPending}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-success/80 hover:bg-success/10 hover:text-success transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Approve once
                  </button>
                )}
                {approvalScopes.includes('run') && (
                  <span className="rounded-md px-2 py-1 text-xs text-warning/80 bg-warning/5">
                    Approve for run unavailable: run-scoped approval is not implemented end-to-end
                    yet.
                  </span>
                )}
                <ConfirmRunActionDialog
                  trigger={
                    <button
                      disabled={!runId || approveMutation.isPending || rejectMutation.isPending}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-error/80 hover:bg-error/10 hover:text-error transition-colors disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  }
                  title="Reject workflow?"
                  description={
                    <>
                      Reject the paused workflow <strong>{workflowName}</strong>. If the approval
                      node defines an <code>on_reject</code> prompt, it runs with your reason as{' '}
                      <code>$REJECTION_REASON</code>; otherwise the run is cancelled.
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
                  {mutationError instanceof Error
                    ? mutationError.message
                    : 'Action failed — please try again'}
                </p>
              )}
            </div>
          )}

          {approvalAuditRows.length > 0 && (
            <div className="border-t border-border px-3 py-2 text-xs text-text-secondary">
              <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
                <p className="font-medium text-text-primary">Approval audit</p>
                <dl className="mt-1 grid gap-0.5">
                  {approvalAuditRows.map(([label, value]) => (
                    <div key={label} className="break-words">
                      <dt className="inline text-text-tertiary">{label}: </dt>
                      <dd className="inline">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}

          {/* Current tool activity */}
          {currentTool?.status === 'running' && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs border-t border-border">
              <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
              <span className="truncate font-mono text-primary">{currentTool.name}</span>
            </div>
          )}

          {/* Error message */}
          {status === 'failed' && error && (
            <div
              className="px-3 py-1.5 text-xs text-error border-t border-border truncate"
              title={error}
            >
              {error.slice(0, 120)}
            </div>
          )}

          {diagnostics.length > 0 && (
            <div className="px-3 py-1.5 text-xs text-warning border-t border-border">
              <p className="font-medium">Workflow diagnostics</p>
              <div className="mt-1 space-y-1">
                {diagnostics.slice(-3).map(diagnostic => (
                  <p
                    key={`${diagnostic.code}:${diagnostic.timestamp}`}
                    className="truncate"
                    title={[
                      `${diagnostic.code}: ${diagnostic.message}`,
                      diagnostic.eventType ? `event=${diagnostic.eventType}` : undefined,
                      diagnostic.stepName ? `step=${diagnostic.stepName}` : undefined,
                      diagnostic.artifactPath ? `artifact=${diagnostic.artifactPath}` : undefined,
                    ]
                      .filter((part): part is string => part !== undefined)
                      .join(' ')}
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
                      <span className="ml-1 text-warning/80">
                        artifact={diagnostic.artifactPath}
                      </span>
                    )}
                  </p>
                ))}
              </div>
            </div>
          )}

          {runId && liveArtifacts.length > 0 && (
            <div className="border-t border-border px-3 py-2">
              <ArtifactSummary artifacts={liveArtifacts} runId={runId} />
            </div>
          )}

          {/* Footer: View Full Screen */}
          <div className="border-t border-border px-3 py-1.5">
            <button
              onClick={handleViewFullScreen}
              className="text-[10px] text-primary hover:text-accent-bright transition-colors"
            >
              View Full Screen &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
