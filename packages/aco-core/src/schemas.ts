import { z } from 'zod';
import { parseArtifactPath } from './paths';
import type {
  ArtifactRef,
  ArtifactManifestRecord,
  CapabilityClaimStatus,
  CapabilityManifestRecord,
  CommandManifestRecord,
  Confidence,
  EvidenceRef,
  Freshness,
  GateManifestRecord,
  GateRunResult,
  LedgerEntry,
  ManifestRecord,
  MutationClass,
  ParseResult,
  ProviderCapability,
  ProviderManifestRecord,
  SurfaceCompatibility,
  SurfaceManifestRecord,
  UncertaintyRouterPacket,
  WorkflowManifestRecord,
} from './contracts';

export const confidenceValues = ['low', 'medium', 'high'] as const satisfies readonly Confidence[];
export const freshnessValues = [
  'fresh',
  'stale',
  'unknown',
  'waived',
] as const satisfies readonly Freshness[];
export const mutationClassValues = [
  'read-only',
  'writes-artifacts',
  'writes-tracked-files',
  'writes-user-files',
  'writes-config',
  'writes-credentials',
  'writes-remotes',
  'writes-graph-cache',
  'destructive',
  'network',
  'unknown',
] as const satisfies readonly MutationClass[];
export const capabilityClaimStatusValues = [
  'supported',
  'unsupported',
  'unknown',
  'deferred',
  'approval_required',
] as const satisfies readonly CapabilityClaimStatus[];
export const surfaceCompatibilityValues = [
  'preserve',
  'preserve-gated',
  'preserve-harden',
  'shim',
] as const satisfies readonly SurfaceCompatibility[];

export const evidenceRefSchema = z
  .object({
    id: z.string().min(1),
    source: z.string().min(1),
    summary: z.string().min(1),
    confidence: z.enum(confidenceValues),
    freshness: z.enum(freshnessValues),
  })
  .strict();

export const artifactRefSchema = z
  .object({
    kind: z.literal('artifact-ref'),
    id: z.string().min(1),
    schemaVersion: z.string().min(1),
    path: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    evidence: z.array(evidenceRefSchema),
  })
  .strict();

export const providerCapabilitySchema = z
  .object({
    kind: z.literal('provider-capability'),
    id: z.string().min(1),
    provider: z.string().min(1),
    tool: z.string().min(1),
    status: z.enum(capabilityClaimStatusValues),
    confidence: z.enum(confidenceValues),
    evidence: z.array(evidenceRefSchema),
    approvalRequired: z.boolean(),
  })
  .strict();

export const ledgerEntrySchema = z
  .object({
    kind: z.literal('ledger-entry'),
    id: z.string().min(1),
    subject: z.unknown(),
    status: z.string().min(1),
    confidence: z.enum(confidenceValues),
    freshness: z.enum(freshnessValues),
    evidence: z.array(evidenceRefSchema),
  })
  .strict();

export const gateRunResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('passed'),
      value: z.unknown(),
      evidence: z.array(evidenceRefSchema),
    })
    .strict(),
  z
    .object({
      status: z.literal('failed'),
      errors: z.array(z.string().min(1)).min(1),
      evidence: z.array(evidenceRefSchema),
    })
    .strict(),
  z
    .object({
      status: z.literal('unknown'),
      reason: z.string().min(1),
      evidence: z.array(evidenceRefSchema),
    })
    .strict(),
]);

export const commandManifestRecordSchema = z
  .object({
    kind: z.literal('command-manifest'),
    id: z.string().min(1),
    command: z.string().min(1),
    surface: z.string().min(1),
    purpose: z.string().min(1),
    mutates: z.enum(mutationClassValues),
    approvalRequired: z.boolean(),
    owner: z.string().min(1),
    compatibility: z.enum(surfaceCompatibilityValues),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict() satisfies z.ZodType<CommandManifestRecord>;

export const surfaceManifestRecordSchema = z
  .object({
    kind: z.literal('surface-manifest'),
    id: z.string().min(1),
    surface: z.string().min(1),
    owner: z.string().min(1),
    compatibility: z.enum(surfaceCompatibilityValues),
    migrationNote: z.string().min(1).optional(),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict() satisfies z.ZodType<SurfaceManifestRecord>;

export const artifactManifestRecordSchema = z
  .object({
    kind: z.literal('artifact-manifest'),
    id: z.string().min(1),
    schemaVersion: z.string().min(1),
    owner: z.string().min(1),
    produces: z.array(z.string().min(1)),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict() satisfies z.ZodType<ArtifactManifestRecord>;

export const capabilityManifestRecordSchema = z
  .object({
    kind: z.literal('capability-manifest'),
    id: z.string().min(1),
    capability: z.string().min(1),
    owner: z.string().min(1),
    status: z.enum(capabilityClaimStatusValues),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict() satisfies z.ZodType<CapabilityManifestRecord>;

export const workflowManifestRecordSchema = z
  .object({
    kind: z.literal('workflow-manifest'),
    id: z.string().min(1),
    workflow: z.string().min(1),
    owner: z.string().min(1),
    nodeContracts: z.array(z.string().min(1)),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict() satisfies z.ZodType<WorkflowManifestRecord>;

export const providerManifestRecordSchema = z
  .object({
    kind: z.literal('provider-manifest'),
    id: z.string().min(1),
    provider: z.string().min(1),
    capabilities: z.array(providerCapabilitySchema),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict() satisfies z.ZodType<ProviderManifestRecord>;

export const gateManifestRecordSchema = z
  .object({
    kind: z.literal('gate-manifest'),
    id: z.string().min(1),
    gate: z.string().min(1),
    mutates: z.enum(mutationClassValues),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict() satisfies z.ZodType<GateManifestRecord>;

export const manifestRecordSchema = z.discriminatedUnion('kind', [
  commandManifestRecordSchema,
  surfaceManifestRecordSchema,
  artifactManifestRecordSchema,
  capabilityManifestRecordSchema,
  workflowManifestRecordSchema,
  providerManifestRecordSchema,
  gateManifestRecordSchema,
]) satisfies z.ZodType<ManifestRecord>;

const routerOptionSchema = z
  .object({
    id: z.string().min(1),
    decision: z.string().min(1),
    pros: z.array(z.string()),
    cons: z.array(z.string()),
  })
  .strict();

export const uncertaintyRouterPacketSchema = z
  .object({
    kind: z.literal('uncertainty-router-packet'),
    id: z.string().min(1),
    schemaVersion: z.literal('aco.party-mode-uncertainty-router.v1'),
    question: z.string().min(1),
    context: z.string().min(1),
    options: z.array(routerOptionSchema).min(1),
    rolesRequested: z.array(z.string().min(1)),
    confidenceBefore: z.enum(confidenceValues),
    selectedOption: z.string().min(1).nullable(),
    confidenceAfter: z.enum(confidenceValues),
    requiredEvidence: z.array(z.string().min(1)),
    rejectedAlternatives: z.array(z.string().min(1)),
    owner: z.string().min(1),
    expiresWhen: z.string().min(1),
  })
  .strict();

const commandSurfaceSchema = z
  .object({
    command: z.string().min(1),
    surface: z.string().min(1),
    purpose: z.string().min(1),
    safety: z.string().min(1),
    mutates: z.string().min(1),
    approvalRequired: z.string().min(1),
    owner: z.string().min(1),
    compatibility: z.string().min(1),
  })
  .strict();

const capabilitySurfaceSchema = z
  .object({
    id: z.string().min(1),
    capability: z.string().min(1),
    currentSurface: z.string().min(1),
    rewriteAction: z.string().min(1),
    requiredArtifact: z.string().min(1),
    status: z.string().min(1),
    confidence: z.enum(confidenceValues),
  })
  .strict();

export const referenceSurfacePlanSchema = z
  .object({
    schemaVersion: z.literal('aco.reference-surface-plan.v1'),
    sourceBranch: z.literal('codex/aco-stabilization-slices'),
    baseBranch: z.literal('dev'),
    generatedFrom: z.array(z.string().min(1)),
    commands: z.array(commandSurfaceSchema).min(1),
    capabilities: z.array(capabilitySurfaceSchema).min(1),
    requiredSurfaceAssertions: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type ReferenceSurfacePlan = z.infer<typeof referenceSurfacePlanSchema>;

const migrationOrderPhaseSchema = z
  .object({
    id: z.string().min(1),
    ownerPackage: z.string().min(1),
    goal: z.string().min(1),
    dependsOn: z.array(z.string().min(1)),
    parityGate: z.string().min(1),
    mustRemainPure: z.boolean(),
    runtimeMigrationAllowed: z.boolean(),
  })
  .strict();

const migrationOrderSurfaceSchema = z
  .object({
    surface: z.string().min(1),
    owner: z.string().min(1),
    capturePhase: z.string().min(1),
    migrationPhase: z.string().min(1),
    dependsOn: z.array(z.string().min(1)),
    parityGate: z.string().min(1),
  })
  .strict();

export const migrationOrderPlanSchema = z
  .object({
    schemaVersion: z.literal('aco.migration-order-plan.v1'),
    sourceBranch: z.literal('codex/aco-stabilization-slices'),
    baseBranch: z.literal('dev'),
    phases: z.array(migrationOrderPhaseSchema).min(2),
    preservedSurfaces: z.array(migrationOrderSurfaceSchema).min(1),
  })
  .strict();

export type MigrationOrderPlan = z.infer<typeof migrationOrderPlanSchema>;

export function parseEvidenceRef(input: unknown): ParseResult<EvidenceRef> {
  return parseWithSchema(evidenceRefSchema, input);
}

export function parseArtifactRef<TSchema extends string>(
  input: unknown
): ParseResult<ArtifactRef<TSchema>> {
  const parsed = parseWithSchema(artifactRefSchema, input);
  if (!parsed.ok) return parsed;

  const path = parseArtifactPath(parsed.value.path);
  if (!path.ok) return path;

  return {
    ok: true,
    value: {
      ...parsed.value,
      path: path.value,
    } as unknown as ArtifactRef<TSchema>,
  };
}

export function parseProviderCapability<TProvider extends string, TTool extends string>(
  input: unknown
): ParseResult<ProviderCapability<TProvider, TTool>> {
  const parsed = parseWithSchema(providerCapabilitySchema, input);
  if (!parsed.ok) return parsed;
  return { ok: true, value: parsed.value as unknown as ProviderCapability<TProvider, TTool> };
}

export function parseLedgerEntry<TSubject, TStatus extends string>(
  input: unknown
): ParseResult<LedgerEntry<TSubject, TStatus>> {
  const parsed = parseWithSchema(ledgerEntrySchema, input);
  if (!parsed.ok) return parsed;
  return { ok: true, value: parsed.value as unknown as LedgerEntry<TSubject, TStatus> };
}

export function parseGateRunResult<TResult>(input: unknown): ParseResult<GateRunResult<TResult>> {
  const parsed = parseWithSchema(gateRunResultSchema, input);
  if (!parsed.ok) return parsed;
  return { ok: true, value: parsed.value as GateRunResult<TResult> };
}

export function parseManifestRecord(input: unknown): ParseResult<ManifestRecord> {
  return parseWithSchema(manifestRecordSchema, input);
}

export function parseUncertaintyRouterPacket(input: unknown): ParseResult<UncertaintyRouterPacket> {
  return parseWithSchema(uncertaintyRouterPacketSchema, input);
}

export function parseReferenceSurfacePlan(input: unknown): ParseResult<ReferenceSurfacePlan> {
  return parseWithSchema(referenceSurfacePlanSchema, input);
}

export function parseMigrationOrderPlan(input: unknown): ParseResult<MigrationOrderPlan> {
  return parseWithSchema(migrationOrderPlanSchema, input);
}

function parseWithSchema<TValue>(schema: z.ZodType<TValue>, input: unknown): ParseResult<TValue> {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }

  return {
    ok: false,
    issues: parsed.error.issues.map(issue => issue.message),
  };
}
