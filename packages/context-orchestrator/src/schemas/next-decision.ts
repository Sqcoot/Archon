import { z } from '@hono/zod-openapi';
import { acoApprovalContractV1Schema } from './approval-contract';

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

export const nextDecisionKindSchema = z.enum([
  'blocked_by_validation',
  'blocked_by_evidence',
  'blocked_by_graph',
  'approval_required',
  'needs_correct_course',
  'ready_for_implementation',
]);

export const nextDecisionActionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['approval', 'manual', 'validation', 'correct_course', 'implementation']),
  label: z.string().min(1),
  command: z.array(z.string().min(1)).optional(),
  payload: z.union([acoApprovalContractV1Schema, z.record(z.unknown())]).optional(),
  requiresApproval: z.boolean(),
  willRun: z.literal(false),
  successEvidence: z.array(z.string().min(1)),
});

export const nextDecisionFactorSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  source: z.string().min(1),
  summary: z.string().min(1),
});

export const nextDecisionEvidenceSummarySchema = z.object({
  readiness: z.enum(['ready', 'blocked', 'needs_approval', 'needs_decision', 'unknown']),
  validationStatus: z.enum(['passed', 'warning', 'failed']),
  graphStatus: z.enum(['available', 'partial', 'forbidden', 'unavailable']),
  graphWaivers: z.number().int().nonnegative(),
  evidenceBlockers: z.number().int().nonnegative(),
  evidenceResolutionRequired: z.boolean(),
  ledgerSummary: ledgerBundleSummarySchema,
});

export const nextDecisionSchema = z.object({
  schemaVersion: z.literal('aco.next-decision.v1'),
  kind: nextDecisionKindSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  primaryAction: nextDecisionActionSchema,
  secondaryActions: z.array(nextDecisionActionSchema),
  decisionFactors: z.array(nextDecisionFactorSchema),
  evidenceSummary: nextDecisionEvidenceSummarySchema,
  waiverIds: z.array(z.string().min(1)),
  evidenceBlockerIds: z.array(z.string().min(1)),
  evidenceResolutionIds: z.array(z.string().min(1)),
  nextPrompt: z.string().min(1),
});

export type NextDecision = z.infer<typeof nextDecisionSchema>;
export type NextDecisionAction = z.infer<typeof nextDecisionActionSchema>;
export type NextDecisionEvidenceSummary = z.infer<typeof nextDecisionEvidenceSummarySchema>;
export type NextDecisionFactor = z.infer<typeof nextDecisionFactorSchema>;
export type NextDecisionKind = z.infer<typeof nextDecisionKindSchema>;
