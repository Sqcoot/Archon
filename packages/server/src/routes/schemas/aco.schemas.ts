import { z } from '@hono/zod-openapi';

const ledgerStatusCountsSchema = z
  .object({
    available: z.number(),
    partial: z.number(),
    blocked: z.number(),
    deferred: z.number(),
    forbidden: z.number(),
    'not used': z.number(),
    unknown: z.number(),
  })
  .openapi('AcoLedgerStatusCounts');

const ledgerSummarySectionSchema = z
  .object({
    total: z.number(),
    counts: ledgerStatusCountsSchema,
  })
  .openapi('AcoLedgerSummarySection');

const acoReadinessSchema = z
  .enum(['ready', 'blocked', 'needs_approval', 'needs_decision', 'unknown'])
  .openapi('AcoReadiness');

const acoWaiverSchema = z
  .object({
    id: z.string(),
    repository: z.string(),
    owner: z.string(),
    reason: z.string(),
    evidence: z.string(),
    expiryCondition: z.string(),
  })
  .openapi('AcoGraphWaiver');

const acoLedgerSummarySchema = z
  .object({
    toolAvailability: ledgerSummarySectionSchema,
    commands: ledgerSummarySectionSchema,
    combined: ledgerSummarySectionSchema,
  })
  .openapi('AcoLedgerSummary');

const acoContextIntentSchema = z
  .object({
    objective: z.string(),
    normalizedObjective: z.string(),
    intentHash: z.string(),
    cwd: z.string(),
    commitSha: z.string(),
    generatedAt: z.string(),
  })
  .openapi('AcoContextIntent');

const acoEvidenceBlockerSchema = z
  .object({
    id: z.string(),
    kind: z.enum(['tool', 'command', 'graph', 'validation', 'docs']),
    status: z.string(),
    freshness: z.enum(['fresh', 'stale', 'unknown', 'waived']),
    reason: z.string(),
    sourceArtifact: z.string(),
    nextVerificationAction: z.string(),
  })
  .openapi('AcoEvidenceBlocker');

const acoEvidenceResolutionItemSchema = z
  .object({
    evidenceId: z.string(),
    capabilityId: z.string(),
    targetKind: z.enum(['openai', 'third-party', 'unknown', 'graph', 'validation']),
    targetName: z.string(),
    resolver: z.enum(['openai-docs-mcp', 'context7', 'manual', 'approval']),
    reason: z.string(),
    nextAction: z.string(),
    requiresApproval: z.boolean(),
    blockingAcceptanceIds: z.array(z.string()),
    expectedSuccessEvidence: z.array(z.string()),
  })
  .openapi('AcoEvidenceResolutionItem');

const acoEvidenceResolutionSchema = z
  .object({
    required: z.boolean(),
    items: z.array(acoEvidenceResolutionItemSchema),
  })
  .openapi('AcoEvidenceResolution');

const acoApprovalContractSchema = z
  .object({
    schemaVersion: z.literal('aco.approval-contract.v1'),
    contractId: z.string(),
    contractHash: z.string(),
    actionId: z.string(),
    intentHash: z.string(),
    commitSha: z.string(),
    routeId: z.string(),
    readiness: z.literal('needs_approval'),
    graphStatus: z.literal('forbidden'),
    requiredWaiverIds: z.array(z.string()),
    evidenceResolutionIds: z.array(z.string()),
    ledgerFingerprint: z.string(),
    validationStatus: z.enum(['passed', 'warning', 'failed']),
    willRun: z.literal(false),
    approvalScope: z.object({
      type: z.literal('workflow-handoff'),
      allowedActions: z.array(z.literal('preserve-current-graph-waivers')),
      summary: z.literal('Approval preserves listed graph waivers for this run only.'),
    }),
  })
  .openapi('AcoApprovalContractV1');

const acoNextDecisionActionSchema = z
  .object({
    id: z.string(),
    kind: z.enum(['approval', 'manual', 'validation', 'correct_course', 'implementation']),
    label: z.string(),
    command: z.array(z.string()).optional(),
    payload: z.union([acoApprovalContractSchema, z.record(z.unknown())]).optional(),
    requiresApproval: z.boolean(),
    willRun: z.literal(false),
    successEvidence: z.array(z.string()),
  })
  .openapi('AcoNextDecisionAction');

const acoNextDecisionFactorSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    source: z.string(),
    summary: z.string(),
  })
  .openapi('AcoNextDecisionFactor');

const acoNextDecisionEvidenceSummarySchema = z
  .object({
    readiness: acoReadinessSchema,
    validationStatus: z.enum(['passed', 'warning', 'failed']),
    graphStatus: z.enum(['available', 'partial', 'forbidden', 'unavailable']),
    graphWaivers: z.number(),
    evidenceBlockers: z.number(),
    evidenceResolutionRequired: z.boolean(),
    ledgerSummary: acoLedgerSummarySchema,
  })
  .openapi('AcoNextDecisionEvidenceSummary');

const acoNextDecisionSchema = z
  .object({
    schemaVersion: z.literal('aco.next-decision.v1'),
    kind: z.enum([
      'blocked_by_validation',
      'blocked_by_evidence',
      'blocked_by_graph',
      'approval_required',
      'needs_correct_course',
      'ready_for_implementation',
    ]),
    title: z.string(),
    summary: z.string(),
    primaryAction: acoNextDecisionActionSchema,
    secondaryActions: z.array(acoNextDecisionActionSchema),
    decisionFactors: z.array(acoNextDecisionFactorSchema),
    evidenceSummary: acoNextDecisionEvidenceSummarySchema,
    waiverIds: z.array(z.string()),
    evidenceBlockerIds: z.array(z.string()),
    evidenceResolutionIds: z.array(z.string()),
    nextPrompt: z.string(),
  })
  .openapi('AcoNextDecision');

const acoRouteSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    steps: z.array(z.string()),
    rationale: z.string(),
    confidence: z.enum(['high', 'medium', 'low']).optional(),
    matchedSignals: z.array(z.string()).optional(),
    rejectedAlternatives: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          reason: z.string(),
        })
      )
      .optional(),
    fallbackBehavior: z.string().optional(),
    nextRecommendedAction: z.string().optional(),
    requiresDecision: z.boolean().optional(),
  })
  .openapi('AcoRoute');

export const acoStatusQuerySchema = z
  .object({
    cwd: z.string().min(1),
    objective: z.string().min(1).optional(),
  })
  .openapi('AcoStatusQuery');

export const acoStatusResponseSchema = z
  .object({
    cwd: z.string(),
    contextIntent: acoContextIntentSchema,
    graphStatus: z.string(),
    graphWaivers: z.number(),
    graphWaiverIds: z.array(z.string()),
    waivers: z.array(acoWaiverSchema),
    approvalRequired: z.boolean(),
    readiness: acoReadinessSchema,
    validationStatus: z.string(),
    ledgerSchemaVersion: z.string(),
    ledgerSummary: acoLedgerSummarySchema,
    evidenceBlockers: z.array(acoEvidenceBlockerSchema),
    evidenceResolution: acoEvidenceResolutionSchema,
    nextDecision: acoNextDecisionSchema,
  })
  .openapi('AcoStatusResponse');

export const acoLedgersQuerySchema = z
  .object({
    cwd: z.string().min(1),
    objective: z.string().min(1).optional(),
  })
  .openapi('AcoLedgersQuery');

export const acoLedgersResponseSchema = z
  .object({
    schemaVersion: z.string(),
    generatedAt: z.string().optional(),
    contextIntent: acoContextIntentSchema,
    toolAvailability: z.array(z.record(z.unknown())),
    commands: z.array(z.record(z.unknown())),
    evidenceBlockers: z.array(acoEvidenceBlockerSchema),
    summary: acoLedgerSummarySchema,
  })
  .openapi('AcoLedgersResponse');

export const acoRouteBodySchema = z
  .object({
    cwd: z.string().min(1),
    prompt: z.string().min(1),
  })
  .openapi('AcoRouteRequest');

export const acoRouteResponseSchema = acoRouteSchema.openapi('AcoRouteResponse');

export const acoCompileBodySchema = z
  .object({
    cwd: z.string().min(1),
    prompt: z.string().min(1),
    runId: z.string().optional(),
    timestamp: z.string().optional(),
    cavemanMode: z.enum(['off', 'lite', 'full', 'ultra']).optional(),
  })
  .openapi('AcoCompileRequest');

export const acoCompileResponseSchema = z
  .object({
    runId: z.string(),
    contextIntent: acoContextIntentSchema,
    archivePath: z.string(),
    files: z.record(z.string()),
    route: acoRouteSchema,
    graphStatus: z.string(),
    graphWaivers: z.number(),
    graphWaiverIds: z.array(z.string()),
    waivers: z.array(acoWaiverSchema),
    approvalRequired: z.boolean(),
    readiness: acoReadinessSchema,
    validationStatus: z.string(),
    ledgerSchemaVersion: z.string(),
    ledgerSummary: acoLedgerSummarySchema,
    evidenceBlockers: z.array(acoEvidenceBlockerSchema),
    evidenceResolution: acoEvidenceResolutionSchema,
    nextDecision: acoNextDecisionSchema,
  })
  .openapi('AcoCompileResponse');

export const acoArtifactPackageParamsSchema = z
  .object({
    runId: z.string().min(1),
  })
  .openapi('AcoArtifactPackageParams');

export const acoArtifactPackageQuerySchema = z
  .object({
    cwd: z.string().min(1),
  })
  .openapi('AcoArtifactPackageQuery');

export const acoArtifactPackageResponseSchema = z
  .object({
    runId: z.string(),
    archivePath: z.string(),
    manifest: z.record(z.unknown()),
    files: z.array(
      z.object({
        name: z.string(),
        path: z.string(),
      })
    ),
  })
  .openapi('AcoArtifactPackageResponse');
