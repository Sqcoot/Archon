import { z } from '@hono/zod-openapi';

export const TARGET_INTENT_BOUNDARY_SCHEMA_VERSION = 'aco.target-intent-boundary.v1' as const;

export const targetIntentBoundaryWorkIntentSchema = z.enum([
  'bug_fix',
  'feature_change',
  'refactor',
  'investigation',
  'docs_spec_workflow',
  'validation_evaluation',
  'harness_improvement',
  'unknown',
]);

export const targetIntentBoundaryRelationshipSchema = z.enum([
  'same_as_harness',
  'current_repo',
  'registered_project',
  'external_repo',
  'artifact_only',
  'unknown',
]);

export const targetIntentBoundaryDirtyStateSchema = z.enum([
  'clean',
  'dirty',
  'unknown',
  'not_applicable',
]);

export const targetIntentBoundaryConfidenceSchema = z.enum(['high', 'medium', 'low', 'unknown']);

export const targetIntentBoundaryMutationPolicySchema = z.enum([
  'read_only',
  'artifact_only',
  'target_only',
  'harness_only',
  'target_and_harness',
]);

export const targetIntentBoundarySourceSignalKindSchema = z.enum([
  'user_request',
  'route',
  'compile_input',
  'repo_file',
  'project_doc',
  'prior_artifact',
  'inferred',
]);

export const targetIntentBoundaryWarningCodeSchema = z.enum([
  'target_unknown',
  'intent_unknown',
  'source_conflict',
  'source_missing',
  'low_confidence',
]);

export const targetIntentBoundaryNextDecisionKindSchema = z.enum([
  'ready_for_implementation',
  'approval_required',
  'blocked',
  'needs_correct_course',
]);

export const targetIntentBoundarySourceSignalSchema = z.object({
  kind: targetIntentBoundarySourceSignalKindSchema,
  source: z.string().min(1),
  value: z.string().min(1),
  confidence: targetIntentBoundaryConfidenceSchema,
});

export const targetIntentBoundaryWarningSchema = z.object({
  code: targetIntentBoundaryWarningCodeSchema,
  message: z.string().min(1),
  source: z.string().min(1).optional(),
});

export const targetIntentBoundarySchema = z.object({
  schemaVersion: z.literal(TARGET_INTENT_BOUNDARY_SCHEMA_VERSION),
  generatedAt: z.string().min(1),
  objective: z.object({
    raw: z.string().min(1),
    normalized: z.string().min(1),
    workIntent: targetIntentBoundaryWorkIntentSchema,
  }),
  harness: z.object({
    root: z.string().min(1),
    branch: z.string().min(1),
    commit: z.string().min(1),
  }),
  target: z.object({
    relationship: targetIntentBoundaryRelationshipSchema,
    root: z.string().min(1).nullable(),
    equalsHarness: z.boolean(),
    dirtyState: targetIntentBoundaryDirtyStateSchema,
    confidence: targetIntentBoundaryConfidenceSchema,
  }),
  artifacts: z.object({
    root: z.string().min(1),
    boundaryPath: z.string().min(1),
    contextPackagePath: z.string().min(1).optional(),
    ledgersPath: z.string().min(1).optional(),
  }),
  scope: z.object({
    mutationPolicy: targetIntentBoundaryMutationPolicySchema,
    allowedPaths: z.array(z.string().min(1)),
    forbiddenPaths: z.array(z.string().min(1)),
    approvalRequiredPaths: z.array(z.string().min(1)),
    nonEnforcementBoundary: z.literal(true),
  }),
  evidence: z.object({
    sourceSignals: z.array(targetIntentBoundarySourceSignalSchema).min(1),
    baselineRequired: z.boolean(),
    contextArtifacts: z.array(z.string().min(1)),
    ledgerArtifacts: z.array(z.string().min(1)),
    warnings: z.array(targetIntentBoundaryWarningSchema),
  }),
  validation: z.object({
    baselineCommands: z.array(z.string().min(1)),
    implementationCommands: z.array(z.string().min(1)),
    evaluatorCommands: z.array(z.string().min(1)),
  }),
  safety: z.object({
    requiresApproval: z.boolean(),
    approvalReasons: z.array(z.string().min(1)),
  }),
  nextDecision: z.object({
    kind: targetIntentBoundaryNextDecisionKindSchema,
    reason: z.string().min(1),
  }),
});

export const exampleTargetIntentBoundary: TargetIntentBoundaryArtifact = {
  schemaVersion: TARGET_INTENT_BOUNDARY_SCHEMA_VERSION,
  generatedAt: '2026-05-19T12:00:00.000Z',
  objective: {
    raw: 'Implement ACO Target/Intent Boundary Artifact.',
    normalized: 'implement aco target/intent boundary artifact.',
    workIntent: 'harness_improvement',
  },
  harness: {
    root: '/repo/Archon',
    branch: 'codex/aco-context-orchestrator',
    commit: 'd786771a',
  },
  target: {
    relationship: 'same_as_harness',
    root: '/repo/Archon',
    equalsHarness: true,
    dirtyState: 'clean',
    confidence: 'high',
  },
  artifacts: {
    root: '/repo/Archon/.archon/artifacts/context-orchestrator/example',
    boundaryPath:
      '/repo/Archon/.archon/artifacts/context-orchestrator/example/target-intent-boundary.json',
    contextPackagePath:
      '/repo/Archon/.archon/artifacts/context-orchestrator/example/final-prompt-package.md',
    ledgersPath: '/repo/Archon/.archon/artifacts/context-orchestrator/example/commands-ledger.json',
  },
  scope: {
    mutationPolicy: 'harness_only',
    allowedPaths: ['/repo/Archon'],
    forbiddenPaths: ['.env'],
    approvalRequiredPaths: [],
    nonEnforcementBoundary: true,
  },
  evidence: {
    sourceSignals: [
      {
        kind: 'user_request',
        source: 'objective.raw',
        value: 'ACO',
        confidence: 'high',
      },
    ],
    baselineRequired: false,
    contextArtifacts: ['final-prompt-package.md'],
    ledgerArtifacts: ['commands-ledger.json'],
    warnings: [],
  },
  validation: {
    baselineCommands: [],
    implementationCommands: ['bun run type-check'],
    evaluatorCommands: ['bun run validate'],
  },
  safety: {
    requiresApproval: false,
    approvalReasons: [],
  },
  nextDecision: {
    kind: 'ready_for_implementation',
    reason: 'Target and intent are explicit enough for implementation planning.',
  },
};

export type TargetIntentBoundaryWorkIntent = z.infer<typeof targetIntentBoundaryWorkIntentSchema>;
export type TargetIntentBoundaryRelationship = z.infer<
  typeof targetIntentBoundaryRelationshipSchema
>;
export type TargetIntentBoundaryDirtyState = z.infer<typeof targetIntentBoundaryDirtyStateSchema>;
export type TargetIntentBoundaryConfidence = z.infer<typeof targetIntentBoundaryConfidenceSchema>;
export type TargetIntentBoundaryMutationPolicy = z.infer<
  typeof targetIntentBoundaryMutationPolicySchema
>;
export type TargetIntentBoundarySourceSignalKind = z.infer<
  typeof targetIntentBoundarySourceSignalKindSchema
>;
export type TargetIntentBoundaryWarningCode = z.infer<typeof targetIntentBoundaryWarningCodeSchema>;
export type TargetIntentBoundaryNextDecisionKind = z.infer<
  typeof targetIntentBoundaryNextDecisionKindSchema
>;
export type TargetIntentBoundarySourceSignal = z.infer<
  typeof targetIntentBoundarySourceSignalSchema
>;
export type TargetIntentBoundaryWarning = z.infer<typeof targetIntentBoundaryWarningSchema>;
export type TargetIntentBoundaryArtifact = z.infer<typeof targetIntentBoundarySchema>;
