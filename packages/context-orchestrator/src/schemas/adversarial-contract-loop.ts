import { z } from '@hono/zod-openapi';
import { nextDecisionKindSchema } from './next-decision';

export const ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION =
  'aco.adversarial-contract-loop.v1' as const;

export const acoAdversarialContextArtifactSchema = z.enum([
  'status',
  'ledgers',
  'compile',
  'decision-dossier',
  'approval-capsule',
  'next-decision',
]);

export const acoContextRefSchema = z.object({
  artifact: acoAdversarialContextArtifactSchema,
  path: z.string().min(1),
  jsonPointer: z.string().min(1).optional(),
  description: z.string().min(1),
});

export const acoContextRefsSchema = z.array(acoContextRefSchema).min(1);

export const acoAdversarialReadinessInputSchema = z.object({
  schemaVersion: z.literal(ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION),
  intentHash: z.string().min(1),
  routeId: z.string().min(1),
  readiness: z.enum(['ready', 'blocked', 'needs_approval', 'unknown']),
  graphStatus: z.enum(['available', 'partial', 'forbidden', 'unavailable']),
  validationStatus: z.enum(['passed', 'warning', 'failed']),
  nextDecisionKind: nextDecisionKindSchema,
  waiverIds: z.array(z.string().min(1)),
  acoContextRefs: acoContextRefsSchema,
});

export const acoAdversarialExplicitApprovalRecordSchema = z.object({
  schemaVersion: z.literal(ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION),
  status: z.enum(['not_required', 'approved', 'rejected', 'invalid']),
  readinessInputHash: z.string().regex(/^[a-f0-9]{64}$/),
  approvalContractId: z.string().min(1).optional(),
  approvalContractHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  waiverIds: z.array(z.string().min(1)),
  recordedAt: z.string().min(1),
  acoContextRefs: acoContextRefsSchema,
});

export const acoAdversarialTraceabilityLedgerRefSchema = z.object({
  schemaVersion: z.literal(ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION),
  requirementId: z.string().regex(/^(ACO-ADV|ACO-028)-[A-Z0-9-]+$/),
  sourceArtifact: z.string().min(1),
  targetArtifact: z.string().min(1),
  acoContextRefs: acoContextRefsSchema,
});

export const acoAdversarialCriterionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  observableProof: z.string().min(1),
  threshold: z.number().min(0).max(10),
  acoContextRefs: acoContextRefsSchema,
});

export const acoAdversarialSprintContractSchema = z.object({
  schemaVersion: z.literal(ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION),
  sprintId: z.string().min(1),
  objective: z.string().min(1),
  criteria: z.array(acoAdversarialCriterionSchema).min(1),
  acoContextRefs: acoContextRefsSchema,
});

export const acoAdversarialGeneratedStoryPayloadSchema = z.object({
  schemaVersion: z.literal(ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION),
  storyId: z.string().min(1),
  title: z.string().min(1),
  contractId: z.string().min(1),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  acoContextRefs: acoContextRefsSchema,
});

export const acoAdversarialGeneratorReportSchema = z.object({
  schemaVersion: z.literal(ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION),
  sprintId: z.string().min(1),
  round: z.number().int().positive(),
  contractPath: z.string().min(1),
  previousFeedbackPath: z.string().min(1).nullable(),
  story: acoAdversarialGeneratedStoryPayloadSchema,
  changedFiles: z.array(z.string().min(1)),
  validationCommands: z.array(z.string().min(1)),
  certification: z.literal('not-certified-by-generator'),
  acoContextRefs: acoContextRefsSchema,
});

export const acoAdversarialFindingSeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);

export const acoAdversarialFindingSchema = z.object({
  schemaVersion: z.literal(ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION),
  findingId: z.string().min(1),
  criterionId: z.string().min(1),
  severity: acoAdversarialFindingSeveritySchema,
  reproduction: z.string().min(1),
  evidence: z.array(z.string().min(1)).min(1),
  expectedBehavior: z.string().min(1),
  actualBehavior: z.string().min(1),
  suggestedFixDirection: z.string().min(1),
  acoContextRefs: acoContextRefsSchema,
});

export const acoAdversarialVerdictKindSchema = z.enum([
  'passed',
  'failed_contract',
  'blocked_by_validation',
  'blocked_by_evidence',
  'needs_correct_course',
  'approval_required',
]);

export const acoAdversarialEvaluatorVerdictSchema = z.object({
  schemaVersion: z.literal(ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION),
  sprintId: z.string().min(1),
  round: z.number().int().positive(),
  verdict: acoAdversarialVerdictKindSchema,
  contractPath: z.string().min(1),
  generatorReportPath: z.string().min(1),
  scores: z.record(z.number().min(0).max(10)),
  findings: z.array(acoAdversarialFindingSchema),
  evidence: z.array(z.string().min(1)).min(1),
  nextDecisionKind: nextDecisionKindSchema.optional(),
  acoContextRefs: acoContextRefsSchema,
});

export const acoAdversarialFeedbackArtifactSchema = z.object({
  schemaVersion: z.literal(ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION),
  sprintId: z.string().min(1),
  round: z.number().int().positive(),
  verdictPath: z.string().min(1),
  actionableFindings: z.array(acoAdversarialFindingSchema),
  retryInstruction: z.string().min(1),
  acoContextRefs: acoContextRefsSchema,
});

export const acoAdversarialRunStateSchema = z.object({
  schemaVersion: z.literal(ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION),
  phase: z.enum(['planning', 'contracting', 'generating', 'evaluating', 'handoff', 'complete']),
  sprintId: z.string().min(1),
  round: z.number().int().positive(),
  status: z.enum(['running', 'passed', 'failed', 'blocked', 'approval_required']),
  approvalRecordPath: z.string().min(1).nullable(),
  nextDecisionKind: nextDecisionKindSchema,
  acoContextRefs: acoContextRefsSchema,
});

export const exampleAcoContextRefs: AcoContextRef[] = [
  {
    artifact: 'compile',
    path: '$ARTIFACTS_DIR/context-orchestrator/compile-result.json',
    jsonPointer: '/nextDecision',
    description: 'Compiled ACO next-decision evidence for this run.',
  },
];

export const exampleAcoAdversarialReadinessInput: AcoAdversarialReadinessInput = {
  schemaVersion: ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION,
  intentHash: '15714285a4a9b5b547b1dee3f4c195b8d914f91b1fd37314e7f26dd9697305ad',
  routeId: 'brownfield-architecture',
  readiness: 'needs_approval',
  graphStatus: 'forbidden',
  validationStatus: 'passed',
  nextDecisionKind: 'approval_required',
  waiverIds: ['graph-waiver.bmad-plugins-marketplace', 'graph-waiver.bmad-sample-data'],
  acoContextRefs: exampleAcoContextRefs,
};

export const exampleAcoAdversarialFinding: AcoAdversarialFinding = {
  schemaVersion: ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION,
  findingId: 'finding-contract-001',
  criterionId: 'criterion-traceability-001',
  severity: 'high',
  reproduction: 'Open the evaluator verdict and inspect missing acoContextRefs.',
  evidence: ['verdicts/sprint-001-round-001.evaluator-verdict.json'],
  expectedBehavior: 'Every finding cites its originating ACO context package item.',
  actualBehavior: 'Finding lacks an ACO context reference.',
  suggestedFixDirection: 'Add acoContextRefs pointing at compile-result.json and ledgers.json.',
  acoContextRefs: exampleAcoContextRefs,
};

export type AcoAdversarialContextArtifact = z.infer<typeof acoAdversarialContextArtifactSchema>;
export type AcoContextRef = z.infer<typeof acoContextRefSchema>;
export type AcoAdversarialReadinessInput = z.infer<typeof acoAdversarialReadinessInputSchema>;
export type AcoAdversarialExplicitApprovalRecord = z.infer<
  typeof acoAdversarialExplicitApprovalRecordSchema
>;
export type AcoAdversarialTraceabilityLedgerRef = z.infer<
  typeof acoAdversarialTraceabilityLedgerRefSchema
>;
export type AcoAdversarialCriterion = z.infer<typeof acoAdversarialCriterionSchema>;
export type AcoAdversarialSprintContract = z.infer<typeof acoAdversarialSprintContractSchema>;
export type AcoAdversarialGeneratedStoryPayload = z.infer<
  typeof acoAdversarialGeneratedStoryPayloadSchema
>;
export type AcoAdversarialGeneratorReport = z.infer<typeof acoAdversarialGeneratorReportSchema>;
export type AcoAdversarialFindingSeverity = z.infer<typeof acoAdversarialFindingSeveritySchema>;
export type AcoAdversarialFinding = z.infer<typeof acoAdversarialFindingSchema>;
export type AcoAdversarialVerdictKind = z.infer<typeof acoAdversarialVerdictKindSchema>;
export type AcoAdversarialEvaluatorVerdict = z.infer<typeof acoAdversarialEvaluatorVerdictSchema>;
export type AcoAdversarialFeedbackArtifact = z.infer<typeof acoAdversarialFeedbackArtifactSchema>;
export type AcoAdversarialRunState = z.infer<typeof acoAdversarialRunStateSchema>;
