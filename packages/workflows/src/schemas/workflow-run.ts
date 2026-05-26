/**
 * Zod schemas for workflow run state types.
 */
import { z } from '@hono/zod-openapi';

// ---------------------------------------------------------------------------
// WorkflowRunStatus
// ---------------------------------------------------------------------------

export const workflowRunStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'paused',
]);

export type WorkflowRunStatus = z.infer<typeof workflowRunStatusSchema>;

/** Statuses that indicate a run has finished and cannot transition further. */
export const TERMINAL_WORKFLOW_STATUSES: readonly WorkflowRunStatus[] = [
  'completed',
  'failed',
  'cancelled',
] as const;

/** Statuses that allow a user to resume execution. */
export const RESUMABLE_WORKFLOW_STATUSES: readonly WorkflowRunStatus[] = [
  'failed',
  'paused',
] as const;

// ---------------------------------------------------------------------------
// WorkflowStepStatus
// ---------------------------------------------------------------------------

export const workflowStepStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
]);

export type WorkflowStepStatus = z.infer<typeof workflowStepStatusSchema>;

// ---------------------------------------------------------------------------
// NodeState
// ---------------------------------------------------------------------------

export const nodeStateSchema = z.enum(['pending', 'running', 'completed', 'failed', 'skipped']);

export type NodeState = z.infer<typeof nodeStateSchema>;

// ---------------------------------------------------------------------------
// NodeOutput
// ---------------------------------------------------------------------------

/**
 * Captured output from a completed DAG node.
 * `output` is the concatenated assistant text (or JSON-encoded string from the SDK
 * when output_format is set). Empty string for failed/skipped nodes.
 * `error` is required when state is 'failed', absent on all other states.
 * `structuredOutput` carries the provider's parsed structured payload (set by Pi/Codex/Claude
 * when the result chunk includes one). Downstream `$nodeId.output.field` substitution and
 * `when:` conditions prefer this object over re-parsing `output`, so providers that emit
 * fence-wrapped or preamble-prefixed JSON (Pi/Minimax) survive the round-trip.
 */
export const nodeOutputSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.enum(['completed', 'running']),
    output: z.string(),
    sessionId: z.string().optional(),
    structuredOutput: z.unknown().optional(),
  }),
  z.object({
    state: z.literal('failed'),
    output: z.string(),
    sessionId: z.string().optional(),
    error: z.string(),
    structuredOutput: z.unknown().optional(),
  }),
  z.object({
    state: z.enum(['pending', 'skipped']),
    output: z.string(),
  }),
]);

export type NodeOutput = z.infer<typeof nodeOutputSchema>;

// ---------------------------------------------------------------------------
// WorkflowRun
// ---------------------------------------------------------------------------

/**
 * Runtime workflow run state stored in database.
 */
export const workflowRunSchema = z.object({
  id: z.string(),
  workflow_name: z.string(),
  conversation_id: z.string(),
  parent_conversation_id: z.string().nullable(),
  codebase_id: z.string().nullable(),
  status: workflowRunStatusSchema,
  user_message: z.string(),
  metadata: z.record(z.unknown()),
  started_at: z.date(),
  completed_at: z.date().nullable(),
  last_activity_at: z.date().nullable(),
  working_path: z.string().nullable(),
});

export type WorkflowRun = z.infer<typeof workflowRunSchema>;

/** Approval context stored in workflow run metadata when paused for human review. */
export interface ApprovalContext {
  nodeId: string;
  message: string;
  /** Distinguishes approval-gate pauses from interactive-loop pauses. */
  type?: 'approval' | 'interactive_loop';
  /** Current loop iteration when paused (interactive loops only). */
  iteration?: number;
  /** Session ID to restore on resume (interactive loops only). */
  sessionId?: string;
  /** When true, the user's approval comment is stored as `$nodeId.output`. */
  captureResponse?: boolean;
  /** The on_reject prompt template (stored at pause time so reject handlers don't need the workflow def). */
  onRejectPrompt?: string;
  /** Max rejection attempts before cancellation (default 3). */
  onRejectMaxAttempts?: number;
  /** Mutation class shown to humans before approval. */
  mutationClass?: string;
  /** Path affected by the approval gate, if known. */
  path?: string;
  /** Command or operation being approved, if known. */
  command?: string;
  /** Human-readable reason for the gate, if different from the message. */
  reason?: string;
  /** Whether the gate is destructive, credential-bearing, remote, or production-impacting. */
  highImpact?: boolean;
  /** Whether the high-impact gate has received explicit confirmation. False while paused. */
  highImpactConfirmed?: boolean;
  /** Approval scope selected by default when the client does not provide one. */
  defaultScope?: 'once' | 'run';
  /** Scope choices the client may offer. */
  allowedScopes?: ('once' | 'run')[];
}

const APPROVAL_CONTEXT_TYPES = new Set(['approval', 'interactive_loop']);
const APPROVAL_SCOPES = new Set(['once', 'run']);
const LEGACY_APPROVAL_CONTEXT_FIELDS = new Set([
  'mutation_class',
  'default_scope',
  'allowed_scopes',
  'capture_response',
  'on_reject_prompt',
  'on_reject_max_attempts',
]);

function optionalString(record: Record<string, unknown>, key: string): boolean {
  return record[key] === undefined || typeof record[key] === 'string';
}

function optionalNumber(record: Record<string, unknown>, key: string): boolean {
  return record[key] === undefined || typeof record[key] === 'number';
}

function optionalBoolean(record: Record<string, unknown>, key: string): boolean {
  return record[key] === undefined || typeof record[key] === 'boolean';
}

/**
 * Type guard for ApprovalContext.
 * Validates that the value is an object with the required nodeId and message fields,
 * and that optional approval safety metadata is already in the canonical runtime shape.
 * Use before accessing `workflowRun.metadata.approval` to prevent runtime throws on
 * malformed metadata (e.g., stale data from older runs where metadata shape differs).
 */
export function isApprovalContext(val: unknown): val is ApprovalContext {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) return false;
  const record = val as Record<string, unknown>;
  if (typeof record.nodeId !== 'string' || typeof record.message !== 'string') return false;
  if ([...LEGACY_APPROVAL_CONTEXT_FIELDS].some(field => record[field] !== undefined)) {
    return false;
  }
  if (
    record.type !== undefined &&
    (typeof record.type !== 'string' || !APPROVAL_CONTEXT_TYPES.has(record.type))
  ) {
    return false;
  }
  if (!optionalNumber(record, 'iteration')) return false;
  if (!optionalString(record, 'sessionId')) return false;
  if (!optionalBoolean(record, 'captureResponse')) return false;
  if (!optionalString(record, 'onRejectPrompt')) return false;
  if (!optionalNumber(record, 'onRejectMaxAttempts')) return false;
  if (
    record.mutationClass !== undefined &&
    (typeof record.mutationClass !== 'string' || record.mutationClass.length === 0)
  ) {
    return false;
  }
  if (!optionalString(record, 'path')) return false;
  if (!optionalString(record, 'command')) return false;
  if (!optionalString(record, 'reason')) return false;
  if (!optionalBoolean(record, 'highImpact')) return false;
  if (!optionalBoolean(record, 'highImpactConfirmed')) return false;
  if (
    record.defaultScope !== undefined &&
    (typeof record.defaultScope !== 'string' || !APPROVAL_SCOPES.has(record.defaultScope))
  ) {
    return false;
  }
  if (
    record.allowedScopes !== undefined &&
    (!Array.isArray(record.allowedScopes) ||
      record.allowedScopes.length === 0 ||
      record.allowedScopes.some(scope => typeof scope !== 'string' || !APPROVAL_SCOPES.has(scope)))
  ) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// ArtifactType
// ---------------------------------------------------------------------------

export const artifactTypeSchema = z.enum([
  'pr',
  'commit',
  'file_created',
  'file_modified',
  'branch',
]);

export type ArtifactType = z.infer<typeof artifactTypeSchema>;

// ---------------------------------------------------------------------------
// Compile-time assertion: NodeOutput must cover all NodeState values.
// If NodeState gains a new value, this line becomes a type error as a reminder
// to update NodeOutput.
// ---------------------------------------------------------------------------

type AssertNodeOutputCoversNodeState = NodeOutput['state'] extends NodeState
  ? NodeState extends NodeOutput['state']
    ? true
    : never
  : never;
const nodeOutputStateCoverage: AssertNodeOutputCoversNodeState = true;
void nodeOutputStateCoverage; // suppress unused-variable lint warning
