import { z } from 'zod';
import { confidenceValues, evidenceRefSchema } from '@archon/aco-core';

export const bmadRoleRuntimeKindValues = ['workflow-artifact-contract'] as const;

export const bmadNativeRuntimeSupportValues = ['proven', 'unproven', 'absent', 'unknown'] as const;

export const bmadRoleCertificationValues = [
  'none',
  'artifact-complete',
  'gate-result',
  'not-certified-by-generator',
  'verifier-report-only',
  'goal-completion-evaluator-only',
] as const;

export const bmadCompletionClaimPolicyValues = [
  'cannot-claim-completion',
  'evaluator-only',
  'none',
] as const;

export const bmadEvaluatorVerdictValues = ['complete', 'incomplete', 'blocked', 'unknown'] as const;

export const bmadEscalationReasonValues = [
  'unclear-ownership',
  'unproven-runtime-support',
  'mutation-safety',
  'stale-evidence',
  'branch-contest',
  'provider-hook-plugin-sdk-uncertainty',
  'compatibility-vs-cleanup',
  'gate-passes-original-goal-incomplete',
] as const;

export const bmadContractArtifactNameValues = [
  'bmad-role-catalog.json',
  'generator-role-contract.yaml',
  'evaluator-role-contract.yaml',
  'uncertainty-router-packet.yaml',
  'evaluator-verdict.json',
  'adversarial-loop-summary.md',
] as const;

const nonEmptyStringSchema = z.string().min(1);

export const bmadRoleContractSchema = z
  .object({
    kind: z.literal('aco-bmad-role-contract'),
    schemaVersion: z.literal('aco.role-contract.v1'),
    id: nonEmptyStringSchema,
    role: nonEmptyStringSchema,
    description: nonEmptyStringSchema,
    owner: nonEmptyStringSchema,
    runtimeKind: z.enum(bmadRoleRuntimeKindValues),
    nativeRuntimeSupport: z.enum(bmadNativeRuntimeSupportValues),
    nativeRuntimeProof: z.array(evidenceRefSchema),
    reads: z.array(nonEmptyStringSchema).min(1),
    writes: z.array(nonEmptyStringSchema).min(1),
    prohibitedActions: z.array(nonEmptyStringSchema).min(1),
    allowedTools: z.array(nonEmptyStringSchema).min(1),
    requiredEvidence: z.array(nonEmptyStringSchema).min(1),
    handoffInputs: z.array(nonEmptyStringSchema).min(1),
    handoffOutputs: z.array(nonEmptyStringSchema).min(1),
    certification: z.enum(bmadRoleCertificationValues),
    completionClaimPolicy: z.enum(bmadCompletionClaimPolicyValues),
    canClaimGoalCompletion: z.boolean(),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const bmadRoleRegistrySchema = z
  .object({
    kind: z.literal('aco-bmad-role-registry'),
    schemaVersion: z.literal('aco.role-contract-catalog.v1'),
    roles: z.array(bmadRoleContractSchema).min(1),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

const routerOptionSchema = z
  .object({
    id: nonEmptyStringSchema,
    decision: nonEmptyStringSchema,
    pros: z.array(nonEmptyStringSchema),
    cons: z.array(nonEmptyStringSchema),
  })
  .strict();

export const bmadUncertaintyRouterPacketSchema = z
  .object({
    kind: z.literal('uncertainty-router-packet'),
    id: nonEmptyStringSchema,
    schemaVersion: z.literal('aco.party-mode-uncertainty-router.v1'),
    question: nonEmptyStringSchema,
    context: nonEmptyStringSchema,
    options: z.array(routerOptionSchema).min(1),
    rolesRequested: z.array(nonEmptyStringSchema).min(1),
    confidenceBefore: z.enum(confidenceValues),
    selectedOption: nonEmptyStringSchema.nullable(),
    confidenceAfter: z.enum(confidenceValues),
    requiredEvidence: z.array(nonEmptyStringSchema).min(1),
    rejectedAlternatives: z.array(nonEmptyStringSchema),
    owner: nonEmptyStringSchema,
    expiresWhen: nonEmptyStringSchema,
    escalationReasons: z.array(z.enum(bmadEscalationReasonValues)).min(1),
    notes: nonEmptyStringSchema,
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const bmadGoalCompletionSchema = z
  .object({
    canClaimComplete: z.boolean(),
    reason: nonEmptyStringSchema,
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const bmadEvaluatorVerdictSchema = z
  .object({
    kind: z.literal('aco-bmad-evaluator-verdict'),
    schemaVersion: z.literal('aco.evaluator-verdict.v1'),
    id: nonEmptyStringSchema,
    evaluatorRoleId: nonEmptyStringSchema,
    verdict: z.enum(bmadEvaluatorVerdictValues),
    goalCompletion: bmadGoalCompletionSchema,
    remainingRisks: z.array(nonEmptyStringSchema),
    requiredFollowups: z.array(nonEmptyStringSchema),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const bmadAdversarialReviewSchema = z
  .object({
    kind: z.literal('aco-bmad-adversarial-review'),
    schemaVersion: z.literal('aco.adversarial-review.v1'),
    id: nonEmptyStringSchema,
    objective: nonEmptyStringSchema,
    roleRegistry: bmadRoleRegistrySchema,
    routerPacket: bmadUncertaintyRouterPacketSchema,
    evaluatorVerdict: bmadEvaluatorVerdictSchema,
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const bmadContractArtifactSchema = z
  .object({
    name: z.enum(bmadContractArtifactNameValues),
    mediaType: nonEmptyStringSchema,
    schemaVersion: nonEmptyStringSchema,
    content: nonEmptyStringSchema,
  })
  .strict();

export const bmadContractArtifactBundleSchema = z
  .object({
    kind: z.literal('aco-bmad-contract-artifact-bundle'),
    schemaVersion: z.literal('aco.bmad-contract-artifacts.v1'),
    artifacts: z.array(bmadContractArtifactSchema).length(bmadContractArtifactNameValues.length),
    roleRegistry: bmadRoleRegistrySchema,
    routerPacket: bmadUncertaintyRouterPacketSchema,
    evaluatorVerdict: bmadEvaluatorVerdictSchema,
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export type BmadRoleRuntimeKind = (typeof bmadRoleRuntimeKindValues)[number];
export type BmadNativeRuntimeSupport = (typeof bmadNativeRuntimeSupportValues)[number];
export type BmadRoleCertification = (typeof bmadRoleCertificationValues)[number];
export type BmadCompletionClaimPolicy = (typeof bmadCompletionClaimPolicyValues)[number];
export type BmadEvaluatorVerdictValue = (typeof bmadEvaluatorVerdictValues)[number];
export type BmadEscalationReason = (typeof bmadEscalationReasonValues)[number];
export type BmadContractArtifactName = (typeof bmadContractArtifactNameValues)[number];
export type BmadRoleContract = z.infer<typeof bmadRoleContractSchema>;
export type BmadRoleRegistry = z.infer<typeof bmadRoleRegistrySchema>;
export type BmadRouterOption = z.infer<typeof routerOptionSchema>;
export type BmadUncertaintyRouterPacket = z.infer<typeof bmadUncertaintyRouterPacketSchema>;
export type BmadGoalCompletion = z.infer<typeof bmadGoalCompletionSchema>;
export type BmadEvaluatorVerdict = z.infer<typeof bmadEvaluatorVerdictSchema>;
export type BmadAdversarialReview = z.infer<typeof bmadAdversarialReviewSchema>;
export type BmadContractArtifact = z.infer<typeof bmadContractArtifactSchema>;
export type BmadContractArtifactBundle = z.infer<typeof bmadContractArtifactBundleSchema>;
