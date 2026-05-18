import { z } from '@hono/zod-openapi';

const ledgerStatusCountsSchema = z.object({
  available: z.number().int().nonnegative(),
  partial: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  deferred: z.number().int().nonnegative(),
  forbidden: z.number().int().nonnegative(),
  'not used': z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
});

const ledgerSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  counts: ledgerStatusCountsSchema,
});

const ledgerBundleSummarySchema = z.object({
  toolAvailability: ledgerSummarySchema,
  commands: ledgerSummarySchema,
  combined: ledgerSummarySchema,
});

const contextIntentSchema = z.object({
  objective: z.string().min(1),
  normalizedObjective: z.string().min(1),
  intentHash: z.string().min(1),
  cwd: z.string().min(1),
  commitSha: z.string().min(1),
  generatedAt: z.string().min(1),
});

const evidenceBlockerSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['tool', 'command', 'graph', 'validation', 'docs']),
  status: z.string().min(1),
  freshness: z.enum(['fresh', 'stale', 'unknown', 'waived']),
  reason: z.string().min(1),
  sourceArtifact: z.string().min(1),
  nextVerificationAction: z.string().min(1),
});

export const approvalCapsuleArtifactRefSchema = z.object({
  id: z.enum([
    'status-json',
    'ledgers-json',
    'graph-validation-gate',
    'compile-result-json',
    'compiled-package',
    'decision-dossier-json',
    'decision-dossier-markdown',
    'approval-capsule-json',
    'approval-capsule-markdown',
  ]),
  label: z.string().min(1),
  path: z.string().min(1).optional(),
  nodeId: z.string().min(1).optional(),
});

export const approvalCapsuleLedgerRefSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['tool', 'command']),
  status: z.enum(['deferred', 'forbidden']),
  reason: z.string().min(1),
  sourceEvidence: z.string().min(1),
  command: z.string().min(1).optional(),
});

export const approvalCapsuleCommandSchema = z.object({
  id: z.string().min(1),
  command: z.string().min(1),
  safety: z.enum([
    'read-only',
    'writes-artifacts',
    'writes-tracked-files',
    'destructive',
    'network',
    'unknown',
  ]),
  requiresApproval: z.literal(true),
  willRun: z.literal(false),
  reason: z.string().min(1),
});

export const approvalCapsuleSchema = z.object({
  schemaVersion: z.literal('aco.approval-capsule.v1'),
  generatedAt: z.string().min(1).optional(),
  runId: z.string().min(1),
  contextIntent: contextIntentSchema,
  route: z.object({
    id: z.enum(['brownfield-architecture', 'quick-contained', 'correct-course', 'unknown-help']),
    label: z.string().min(1),
    steps: z.array(z.string().min(1)),
    rationale: z.string().min(1),
  }),
  readiness: z.literal('needs_approval'),
  graphStatus: z.literal('forbidden'),
  validationStatus: z.string().min(1),
  ledgerSummary: ledgerBundleSummarySchema,
  artifactRefs: z.array(approvalCapsuleArtifactRefSchema),
  activeWaiverIds: z.array(z.string().min(1)),
  evidenceBlockers: z.array(evidenceBlockerSchema),
  ledgerRefs: z.array(approvalCapsuleLedgerRefSchema),
  approvalCommands: z.array(approvalCapsuleCommandSchema),
  decisionScope: z.string().min(1),
  releaseReadiness: z.literal('Needs approval while waivers remain.'),
});

export type ApprovalCapsule = z.infer<typeof approvalCapsuleSchema>;
export type ApprovalCapsuleArtifactRef = z.infer<typeof approvalCapsuleArtifactRefSchema>;
export type ApprovalCapsuleLedgerRef = z.infer<typeof approvalCapsuleLedgerRefSchema>;
export type ApprovalCapsuleCommand = z.infer<typeof approvalCapsuleCommandSchema>;
