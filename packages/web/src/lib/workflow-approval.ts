import type {
  ApprovalChannel,
  ApprovalMutationClass,
  ApprovalScope,
  WorkflowApprovalInfo,
} from '@/lib/types';

const APPROVAL_SCOPES = new Set<string>(['once', 'run']);
const APPROVAL_CHANNELS = new Set<string>(['chat', 'web', 'cli', 'system']);

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function mutationClassField(value: unknown): ApprovalMutationClass | undefined {
  const rendered = stringField(value);
  return rendered === undefined ? undefined : (rendered as ApprovalMutationClass);
}

function scopeField(value: unknown): ApprovalScope | undefined {
  if (typeof value !== 'string' || !APPROVAL_SCOPES.has(value)) return undefined;
  return value as ApprovalScope;
}

function channelField(value: unknown): ApprovalChannel | undefined {
  if (typeof value !== 'string' || !APPROVAL_CHANNELS.has(value)) return undefined;
  return value as ApprovalChannel;
}

function booleanField(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function scopesField(value: unknown): ApprovalScope[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const scopes = value
    .map(scopeField)
    .filter((scope): scope is ApprovalScope => scope !== undefined);
  return scopes.length > 0 ? scopes : undefined;
}

function recordField(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function normalizeWorkflowApprovalInfo(value: unknown): WorkflowApprovalInfo | undefined {
  const approval = recordField(value);
  if (approval === undefined) return undefined;

  const nodeId = stringField(approval.nodeId ?? approval.node_id);
  const message = stringField(approval.message);
  if (nodeId === undefined || message === undefined) return undefined;

  const mutationClass = mutationClassField(approval.mutationClass ?? approval.mutation_class);
  const path = stringField(approval.path);
  const command = stringField(approval.command);
  const reason = stringField(approval.reason);
  const defaultScope = scopeField(approval.defaultScope ?? approval.default_scope);
  const allowedScopes = scopesField(approval.allowedScopes ?? approval.allowed_scopes);
  const approvalChannel = channelField(approval.approvalChannel ?? approval.approval_channel);
  const highImpact = booleanField(approval.highImpact ?? approval.high_impact);
  const highImpactConfirmed = booleanField(
    approval.highImpactConfirmed ?? approval.high_impact_confirmed
  );

  return {
    nodeId,
    message,
    ...(mutationClass !== undefined ? { mutationClass } : {}),
    ...(path !== undefined ? { path } : {}),
    ...(command !== undefined ? { command } : {}),
    ...(reason !== undefined ? { reason } : {}),
    ...(defaultScope !== undefined ? { defaultScope } : {}),
    ...(allowedScopes !== undefined ? { allowedScopes } : {}),
    ...(approvalChannel !== undefined ? { approvalChannel } : {}),
    ...(highImpact !== undefined ? { highImpact } : {}),
    ...(highImpactConfirmed !== undefined ? { highImpactConfirmed } : {}),
  };
}

export function normalizeWorkflowApprovalFromMetadata(
  metadata: unknown
): WorkflowApprovalInfo | undefined {
  const record = recordField(metadata);
  return record === undefined ? undefined : normalizeWorkflowApprovalInfo(record.approval);
}

export interface WorkflowApprovalAuditSummary {
  decision?: string;
  nodeId?: string;
  approvalScope?: ApprovalScope;
  approvalChannel?: ApprovalChannel;
  highImpact?: boolean;
  highImpactConfirmed?: boolean;
  mutationClass?: ApprovalMutationClass;
  path?: string;
  command?: string;
  reason?: string;
  approvalReason?: string;
  rejectionReason?: string;
  defaultScope?: ApprovalScope;
  allowedScopes?: ApprovalScope[];
}

export function normalizeWorkflowApprovalAuditInfo(
  value: unknown
): WorkflowApprovalAuditSummary | undefined {
  const audit = recordField(value);
  if (audit === undefined) return undefined;

  const decision = stringField(audit.decision);
  const nodeId = stringField(audit.nodeId ?? audit.node_id);
  const approvalScope = scopeField(audit.approvalScope ?? audit.approval_scope);
  const approvalChannel = channelField(audit.approvalChannel ?? audit.approval_channel);
  const highImpact = booleanField(audit.highImpact ?? audit.high_impact);
  const highImpactConfirmed = booleanField(
    audit.highImpactConfirmed ?? audit.high_impact_confirmed
  );
  const mutationClass = mutationClassField(audit.mutationClass ?? audit.mutation_class);
  const path = stringField(audit.path);
  const command = stringField(audit.command);
  const reason = stringField(audit.reason);
  const approvalReason = stringField(audit.approvalReason ?? audit.approval_reason);
  const rejectionReason = stringField(audit.rejectionReason ?? audit.rejection_reason);
  const defaultScope = scopeField(audit.defaultScope ?? audit.default_scope);
  const allowedScopes = scopesField(audit.allowedScopes ?? audit.allowed_scopes);

  const summary: WorkflowApprovalAuditSummary = {
    ...(decision !== undefined ? { decision } : {}),
    ...(nodeId !== undefined ? { nodeId } : {}),
    ...(approvalScope !== undefined ? { approvalScope } : {}),
    ...(approvalChannel !== undefined ? { approvalChannel } : {}),
    ...(highImpact !== undefined ? { highImpact } : {}),
    ...(highImpactConfirmed !== undefined ? { highImpactConfirmed } : {}),
    ...(mutationClass !== undefined ? { mutationClass } : {}),
    ...(path !== undefined ? { path } : {}),
    ...(command !== undefined ? { command } : {}),
    ...(reason !== undefined ? { reason } : {}),
    ...(approvalReason !== undefined ? { approvalReason } : {}),
    ...(rejectionReason !== undefined ? { rejectionReason } : {}),
    ...(defaultScope !== undefined ? { defaultScope } : {}),
    ...(allowedScopes !== undefined ? { allowedScopes } : {}),
  };

  return Object.values(summary).some(value => value !== undefined) ? summary : undefined;
}

export function normalizeWorkflowApprovalAuditFromMetadata(
  metadata: unknown
): WorkflowApprovalAuditSummary | undefined {
  const record = recordField(metadata);
  return record === undefined
    ? undefined
    : normalizeWorkflowApprovalAuditInfo(record.approvalAudit ?? record.approval_audit);
}

function booleanLabel(value: boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value ? 'yes' : 'no';
}

export function formatWorkflowApprovalAuditRows(
  audit: WorkflowApprovalAuditSummary | null | undefined
): [string, string][] {
  if (audit == null) return [];
  const rows: [string, string | undefined][] = [
    ['Decision', audit.decision],
    ['Node', audit.nodeId],
    ['Scope', audit.approvalScope],
    ['Channel', audit.approvalChannel],
    ['High impact', booleanLabel(audit.highImpact)],
    ['High-impact confirmed', booleanLabel(audit.highImpactConfirmed)],
    ['Mutation class', audit.mutationClass],
    ['Path', audit.path],
    ['Command', audit.command],
    ['Reason', audit.reason],
    ['Approval reason', audit.approvalReason],
    ['Rejection reason', audit.rejectionReason],
    ['Default scope', audit.defaultScope],
    ['Allowed scopes', audit.allowedScopes?.join(', ')],
  ];
  return rows.flatMap(([label, value]): [string, string][] => (value ? [[label, value]] : []));
}
