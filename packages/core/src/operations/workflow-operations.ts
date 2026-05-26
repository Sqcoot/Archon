/**
 * Shared workflow business logic — approve, reject, status, resume, abandon.
 *
 * Both CLI and command-handler are thin formatting adapters over these functions.
 * Operations throw on errors; callers catch and format for their platform.
 */
import { createLogger } from '@archon/paths';
import {
  RESUMABLE_WORKFLOW_STATUSES,
  TERMINAL_WORKFLOW_STATUSES,
  isApprovalContext,
} from '@archon/workflows/schemas/workflow-run';
import type { WorkflowRun, ApprovalContext } from '@archon/workflows/schemas/workflow-run';
import { getWorkflowEventEmitter } from '@archon/workflows/event-emitter';
import * as workflowDb from '../db/workflows';
import * as workflowEventDb from '../db/workflow-events';
import { recordWorkflowEventPersistenceDiagnostic } from '../workflows/persistence-diagnostics';

// Lazy logger — NEVER at module scope
let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('operations');
  return cachedLog;
}

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface WorkflowStatusData {
  runs: WorkflowRun[];
}

export type ApprovalChannel = 'cli' | 'web' | 'chat' | 'system';

export interface WorkflowApprovalAuditMetadata {
  decision: 'approved' | 'rejected';
  node_id: string;
  approval_scope?: 'once' | 'run';
  approval_channel?: ApprovalChannel;
  high_impact?: boolean;
  high_impact_confirmed?: boolean;
  mutation_class?: string;
  path?: string;
  command?: string;
  reason?: string;
  approval_reason?: string;
  rejection_reason?: string;
  default_scope?: 'once' | 'run';
  allowed_scopes?: ('once' | 'run')[];
}

export interface ApprovalOperationResult {
  workflowName: string;
  workingPath: string | null;
  userMessage: string | null;
  codebaseId: string | null;
  /** Internal DB UUID — resolve via getConversationById() to get platform_conversation_id. */
  conversationId: string;
  type: 'interactive_loop' | 'approval_gate';
  approvalAudit: WorkflowApprovalAuditMetadata;
  approval_audit: WorkflowApprovalAuditMetadata;
}

export interface ApproveWorkflowOptions {
  scope?: 'once';
  approvalChannel?: ApprovalChannel;
  highImpactConfirmed?: boolean;
}

export interface RejectWorkflowOptions {
  approvalChannel?: ApprovalChannel;
}

export interface RejectionOperationResult {
  workflowName: string;
  workingPath: string | null;
  userMessage: string | null;
  codebaseId: string | null;
  /** Internal DB UUID — resolve via getConversationById() to get platform_conversation_id. */
  conversationId: string;
  approvalAudit: WorkflowApprovalAuditMetadata;
  approval_audit: WorkflowApprovalAuditMetadata;
  /** true = run cancelled; false = transitioning to failed for retry (has onRejectPrompt) */
  cancelled: boolean;
  /** true when cancelled specifically because max rejection attempts were reached */
  maxAttemptsReached: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getRunOrThrow(runId: string, logEvent: string): Promise<WorkflowRun> {
  let run: WorkflowRun | null;
  try {
    run = await workflowDb.getWorkflowRun(runId);
  } catch (error) {
    const err = error as Error;
    getLog().error({ err, errorType: err.constructor.name, runId }, logEvent);
    throw new Error(`Failed to look up workflow run ${runId}: ${err.message}`);
  }
  if (!run) {
    throw new Error(`Workflow run not found: ${runId}`);
  }
  return run;
}

const HIGH_IMPACT_APPROVAL_CLASSES = new Set(['destructive', 'credential', 'remote', 'production']);

export function isHighImpactApproval(
  approval: Pick<ApprovalContext, 'mutationClass' | 'highImpact'>
): boolean {
  return (
    approval.highImpact === true ||
    (approval.mutationClass !== undefined &&
      HIGH_IMPACT_APPROVAL_CLASSES.has(approval.mutationClass))
  );
}

function approvalImpactLabel(
  approval: Pick<ApprovalContext, 'mutationClass' | 'highImpact'>
): string {
  return approval.mutationClass ?? (approval.highImpact === true ? 'high-impact' : 'unknown');
}

function resolveApproveWorkflowOptions(
  scopeOrOptions?: 'once' | ApproveWorkflowOptions
): ApproveWorkflowOptions {
  if (typeof scopeOrOptions === 'string') return { scope: scopeOrOptions };
  return scopeOrOptions ?? {};
}

export function assertApprovalAllowedForChannel(
  approval: ApprovalContext,
  options: ApproveWorkflowOptions = {}
): void {
  if (!isHighImpactApproval(approval)) return;
  const channel = options.approvalChannel ?? 'system';
  if (channel === 'chat') {
    throw new Error(
      `High-impact approval '${approvalImpactLabel(approval)}' cannot be approved from normal chat. Use the CLI or the explicit approval UI.`
    );
  }
  if (options.highImpactConfirmed !== true) {
    throw new Error(
      `High-impact approval '${approvalImpactLabel(approval)}' requires explicit high-impact confirmation.`
    );
  }
}

async function createApprovalWorkflowEvent(data: {
  workflow_run_id: string;
  event_type: 'node_completed' | 'approval_received';
  step_name?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
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
  } catch (error) {
    await recordWorkflowEventPersistenceDiagnostic({
      runId: data.workflow_run_id,
      eventType: data.event_type,
      ...(data.step_name ? { stepName: data.step_name } : {}),
      reason: (error as Error).message,
      persistence: 'best_effort_failed',
    });
    getWorkflowEventEmitter().emit({
      type: 'workflow_event_persist_failed',
      runId: data.workflow_run_id,
      eventType: data.event_type,
      ...(data.step_name ? { stepName: data.step_name } : {}),
      reason: (error as Error).message,
      persistence: 'best_effort_failed',
    });
  }
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * List all running and paused workflow runs.
 */
export async function getWorkflowStatus(): Promise<WorkflowStatusData> {
  const runs = await workflowDb.listWorkflowRuns({
    status: ['running', 'paused'],
    limit: 50,
  });
  return { runs };
}

/**
 * Validate that a run can be resumed and return it.
 * Does NOT execute the workflow — callers decide whether to run.
 */
export async function resumeWorkflow(runId: string): Promise<WorkflowRun> {
  const run = await getRunOrThrow(runId, 'operations.workflow_resume_lookup_failed');
  if (!RESUMABLE_WORKFLOW_STATUSES.includes(run.status)) {
    throw new Error(
      `Cannot resume run with status '${run.status}'. Only failed or paused runs can be resumed.`
    );
  }
  return run;
}

/**
 * Abandon a non-terminal workflow run (marks it as cancelled).
 */
export async function abandonWorkflow(runId: string): Promise<WorkflowRun> {
  const run = await getRunOrThrow(runId, 'operations.workflow_abandon_lookup_failed');
  if (TERMINAL_WORKFLOW_STATUSES.includes(run.status)) {
    throw new Error(`Cannot abandon run with status '${run.status}'. Run is already terminal.`);
  }
  try {
    await workflowDb.cancelWorkflowRun(runId);
  } catch (error) {
    const err = error as Error;
    getLog().error(
      { err, errorType: err.constructor.name, runId },
      'operations.workflow_abandon_failed'
    );
    throw new Error(`Failed to abandon workflow run ${runId}: ${err.message}`);
  }
  return run;
}

/**
 * Approve a paused workflow run.
 *
 * Handles both interactive_loop and standard approval gate paths.
 * Transitions run to 'failed' so findResumableRun picks it up on next invocation.
 * Does NOT auto-resume — callers decide whether to execute.
 */
export async function approveWorkflow(
  runId: string,
  comment?: string,
  scopeOrOptions?: 'once' | ApproveWorkflowOptions
): Promise<ApprovalOperationResult> {
  const run = await getRunOrThrow(runId, 'operations.workflow_approve_lookup_failed');
  return approveLoadedWorkflowRun(run, comment, scopeOrOptions);
}

/**
 * Approve an already-loaded paused workflow run.
 *
 * Shared by API routes that need the original run row for auto-resume routing
 * and by approveWorkflow(), which performs the lookup first.
 */
export async function approveLoadedWorkflowRun(
  run: WorkflowRun,
  comment?: string,
  scopeOrOptions?: 'once' | ApproveWorkflowOptions
): Promise<ApprovalOperationResult> {
  const options = resolveApproveWorkflowOptions(scopeOrOptions);
  const runId = run.id;
  if (run.status !== 'paused') {
    throw new Error(
      `Cannot approve run with status '${run.status}'. Only paused runs can be approved.`
    );
  }
  const rawApproval = run.metadata.approval;
  const approval: ApprovalContext | undefined = isApprovalContext(rawApproval)
    ? rawApproval
    : undefined;
  if (!approval?.nodeId) {
    throw new Error('Workflow run is paused but missing approval context.');
  }
  assertApprovalAllowedForChannel(approval, options);

  const approvalComment = comment ?? 'Approved';
  const allowedScopes = approval.allowedScopes ?? ['once'];
  const approvalScope = options.scope ?? approval.defaultScope ?? allowedScopes[0] ?? 'once';
  if (!allowedScopes.includes(approvalScope)) {
    throw new Error(
      `Approval scope '${approvalScope}' is not allowed for this gate. Allowed scopes: ${allowedScopes.join(', ')}`
    );
  }
  if (approvalScope === 'run') {
    throw new Error(
      "Approval scope 'run' is not implemented end-to-end yet. Use approval scope 'once'."
    );
  }
  const approvalChannel = options.approvalChannel ?? 'system';
  const approvalIsHighImpact = isHighImpactApproval(approval);
  const approvalMetadata = {
    approval_scope: approvalScope,
    approval_channel: approvalChannel,
    high_impact: approvalIsHighImpact,
    high_impact_confirmed: approvalIsHighImpact ? options.highImpactConfirmed === true : false,
    ...(approval.mutationClass ? { mutation_class: approval.mutationClass } : {}),
    ...(approval.path ? { path: approval.path } : {}),
    ...(approval.command ? { command: approval.command } : {}),
    ...(approval.reason ? { reason: approval.reason, approval_reason: approval.reason } : {}),
    ...(approval.defaultScope ? { default_scope: approval.defaultScope } : {}),
    ...(approval.allowedScopes ? { allowed_scopes: approval.allowedScopes } : {}),
  };
  const approvalAudit = {
    decision: 'approved',
    node_id: approval.nodeId,
    ...approvalMetadata,
  } satisfies WorkflowApprovalAuditMetadata;
  const approvalAuditMetadata = { approval_audit: approvalAudit };

  try {
    // Interactive loop gate — store user input in metadata for the next iteration.
    // Note: node_completed is NOT written here. The executor writes it when the AI
    // emits the completion signal (meaning the user actually approved). Writing it
    // here would cause the resume to skip the loop node entirely.
    if (approval.type === 'interactive_loop') {
      await createApprovalWorkflowEvent({
        workflow_run_id: runId,
        event_type: 'approval_received',
        step_name: approval.nodeId,
        data: {
          decision: 'approved',
          comment: approvalComment,
          iteration: approval.iteration,
          ...approvalMetadata,
        },
      });
      // Transition to 'failed' so findResumableRun picks it up.
      // IMPORTANT: metadata is MERGED (not replaced) — the approval context must survive
      // intact so the resumed executor can detect the correct startIteration.
      await workflowDb.updateWorkflowRun(runId, {
        status: 'failed',
        metadata: { loop_user_input: approvalComment, ...approvalAuditMetadata },
      });
      return {
        workflowName: run.workflow_name,
        workingPath: run.working_path,
        userMessage: run.user_message,
        codebaseId: run.codebase_id,
        conversationId: run.conversation_id,
        type: 'interactive_loop',
        approvalAudit,
        approval_audit: approvalAudit,
      };
    }

    // Standard approval node path
    const nodeOutput = approval.captureResponse === true ? approvalComment : '';
    await createApprovalWorkflowEvent({
      workflow_run_id: runId,
      event_type: 'node_completed',
      step_name: approval.nodeId,
      data: { node_output: nodeOutput, approval_decision: 'approved', ...approvalMetadata },
    });
    await createApprovalWorkflowEvent({
      workflow_run_id: runId,
      event_type: 'approval_received',
      step_name: approval.nodeId,
      data: { decision: 'approved', comment: approvalComment, ...approvalMetadata },
    });
    // Transition to 'failed' so findResumableRun picks it up. Clear any rejection state.
    await workflowDb.updateWorkflowRun(runId, {
      status: 'failed',
      metadata: {
        approval_response: 'approved',
        rejection_reason: '',
        rejection_count: 0,
        ...approvalAuditMetadata,
      },
    });
  } catch (error) {
    const err = error as Error;
    getLog().error(
      { err, errorType: err.constructor.name, runId },
      'operations.workflow_approve_failed'
    );
    throw new Error(`Failed to approve workflow run ${runId}: ${err.message}`);
  }
  return {
    workflowName: run.workflow_name,
    workingPath: run.working_path,
    userMessage: run.user_message,
    codebaseId: run.codebase_id,
    conversationId: run.conversation_id,
    type: 'approval_gate',
    approvalAudit,
    approval_audit: approvalAudit,
  };
}

/**
 * Reject a paused workflow run.
 *
 * If `onRejectPrompt` is set and under max attempts, transitions to 'failed' for retry.
 * Otherwise, cancels the run.
 */
export async function rejectWorkflow(
  runId: string,
  reason?: string,
  options: RejectWorkflowOptions = {}
): Promise<RejectionOperationResult> {
  const run = await getRunOrThrow(runId, 'operations.workflow_reject_lookup_failed');
  if (run.status !== 'paused') {
    throw new Error(
      `Cannot reject run with status '${run.status}'. Only paused runs can be rejected.`
    );
  }
  const rawApproval = run.metadata.approval;
  const approval: ApprovalContext | undefined = isApprovalContext(rawApproval)
    ? rawApproval
    : undefined;
  const rejectReason = reason ?? 'Rejected';
  const currentCount = (run.metadata.rejection_count as number | undefined) ?? 0;
  const maxAttempts = approval?.onRejectMaxAttempts ?? 3;
  const rejectionHighImpact = approval ? isHighImpactApproval(approval) : false;
  const rejectionChannel = options.approvalChannel ?? 'system';
  const rejectionMetadata = {
    approval_channel: rejectionChannel,
    high_impact: rejectionHighImpact,
    high_impact_confirmed: false,
    ...(approval?.mutationClass ? { mutation_class: approval.mutationClass } : {}),
    ...(approval?.path ? { path: approval.path } : {}),
    ...(approval?.command ? { command: approval.command } : {}),
    ...(approval?.reason ? { reason: approval.reason, approval_reason: approval.reason } : {}),
    ...(approval?.defaultScope ? { default_scope: approval.defaultScope } : {}),
    ...(approval?.allowedScopes ? { allowed_scopes: approval.allowedScopes } : {}),
  };
  const rejectionAudit = {
    decision: 'rejected',
    node_id: approval?.nodeId ?? 'unknown',
    rejection_reason: rejectReason,
    ...rejectionMetadata,
  } satisfies WorkflowApprovalAuditMetadata;
  const rejectionAuditMetadata = { approval_audit: rejectionAudit };

  try {
    await createApprovalWorkflowEvent({
      workflow_run_id: runId,
      event_type: 'approval_received',
      step_name: approval?.nodeId ?? 'unknown',
      data: { decision: 'rejected', reason: rejectReason, ...rejectionMetadata },
    });

    if (approval?.onRejectPrompt !== undefined) {
      if (currentCount + 1 >= maxAttempts) {
        await workflowDb.updateWorkflowRun(runId, {
          status: 'cancelled',
          metadata: {
            rejection_reason: rejectReason,
            rejection_count: currentCount + 1,
            ...rejectionAuditMetadata,
          },
        });
        return {
          workflowName: run.workflow_name,
          workingPath: run.working_path,
          userMessage: run.user_message,
          codebaseId: run.codebase_id,
          conversationId: run.conversation_id,
          approvalAudit: rejectionAudit,
          approval_audit: rejectionAudit,
          cancelled: true,
          maxAttemptsReached: true,
        };
      }
      await workflowDb.updateWorkflowRun(runId, {
        status: 'failed',
        metadata: {
          rejection_reason: rejectReason,
          rejection_count: currentCount + 1,
          ...rejectionAuditMetadata,
        },
      });
      return {
        workflowName: run.workflow_name,
        workingPath: run.working_path,
        userMessage: run.user_message,
        codebaseId: run.codebase_id,
        conversationId: run.conversation_id,
        approvalAudit: rejectionAudit,
        approval_audit: rejectionAudit,
        cancelled: false,
        maxAttemptsReached: false,
      };
    }

    await workflowDb.updateWorkflowRun(runId, {
      status: 'cancelled',
      metadata: { rejection_reason: rejectReason, ...rejectionAuditMetadata },
    });
  } catch (error) {
    const err = error as Error;
    getLog().error(
      { err, errorType: err.constructor.name, runId },
      'operations.workflow_reject_failed'
    );
    throw new Error(`Failed to reject workflow run ${runId}: ${err.message}`);
  }
  return {
    workflowName: run.workflow_name,
    workingPath: run.working_path,
    userMessage: run.user_message,
    codebaseId: run.codebase_id,
    conversationId: run.conversation_id,
    approvalAudit: rejectionAudit,
    approval_audit: rejectionAudit,
    cancelled: true,
    maxAttemptsReached: false,
  };
}
