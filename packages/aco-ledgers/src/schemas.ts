import { z } from 'zod';
import {
  evidenceRefSchema,
  freshnessValues,
  mutationClassValues,
  surfaceCompatibilityValues,
} from '@archon/aco-core';
import type { Confidence, Freshness, MutationClass, SurfaceCompatibility } from '@archon/aco-core';

export const ledgerNameValues = [
  'artifact',
  'capability',
  'command',
  'risk',
  'tool',
  'unknowns',
  'workflow',
] as const;

export const ledgerSafetyValues = [
  'read-only',
  'read-only-by-default',
  'read-only-or-writes-artifacts',
  'artifact-only',
  'can-run-tests',
  'may-need-auth',
  'writes-artifacts',
  'writes-graph-artifacts',
  'network-writes-artifacts',
  'runtime-dependent',
  'unknown',
] as const;

export const ledgerCompatibilityValues = [
  ...surfaceCompatibilityValues,
  'rewrite',
  'existing-reference-only',
  'preserve-existing',
] as const;

export const artifactLedgerStatusValues = ['required', 'conditional'] as const;
export const capabilityLedgerStatusValues = [
  'planned',
  'supported',
  'unsupported',
  'unknown',
  'deferred',
  'blocked',
  'partial',
  'approval-required',
  'not-used',
  'forbidden',
] as const;
export const commandLedgerStatusValues = surfaceCompatibilityValues;
export const riskLedgerStatusValues = ['tracked'] as const;
export const toolLedgerStatusValues = [
  'required',
  'optional-conditional',
  'existing-built-in',
  'community-reference',
  'blocked',
  'unknown',
  'deferred',
  'approval-required',
  'not-used',
  'forbidden',
] as const;
export const unknownLedgerStatusValues = [
  'unknown',
  'not-found',
  'partial',
  'blocked',
  'deferred',
  'approval-required',
] as const;
export const workflowLedgerStatusValues = [
  'preserve',
  'preserve-harden',
  'existing-reference-only',
  'preserve-existing',
] as const;

export const ledgerNameSchema = z.enum(ledgerNameValues);
export const ledgerSafetySchema = z.enum(ledgerSafetyValues);
export const ledgerCompatibilitySchema = z.enum(ledgerCompatibilityValues);

export type LedgerName = (typeof ledgerNameValues)[number];
export type LedgerSafety = (typeof ledgerSafetyValues)[number];
export type LedgerCompatibility = (typeof ledgerCompatibilityValues)[number];
export type ArtifactLedgerStatus = (typeof artifactLedgerStatusValues)[number];
export type CapabilityLedgerStatus = (typeof capabilityLedgerStatusValues)[number];
export type CommandLedgerStatus = SurfaceCompatibility;
export type RiskLedgerStatus = (typeof riskLedgerStatusValues)[number];
export type ToolLedgerStatus = (typeof toolLedgerStatusValues)[number];
export type UnknownLedgerStatus = (typeof unknownLedgerStatusValues)[number];
export type WorkflowLedgerStatus = (typeof workflowLedgerStatusValues)[number];

const nonEmptyStringSchema = z.string().min(1);
const optionalFreshnessSchema = z.object({ freshness: z.string().min(1).optional() }).strict();

export const artifactLedgerRowSchema = optionalFreshnessSchema.extend({
  artifact: nonEmptyStringSchema,
  schema: nonEmptyStringSchema,
  producer: nonEmptyStringSchema,
  consumer: nonEmptyStringSchema,
  required: nonEmptyStringSchema,
});

export const capabilityLedgerRowSchema = optionalFreshnessSchema.extend({
  id: nonEmptyStringSchema,
  capability: nonEmptyStringSchema,
  current_surface: nonEmptyStringSchema,
  rewrite_action: nonEmptyStringSchema,
  required_artifact: nonEmptyStringSchema,
  status: nonEmptyStringSchema,
  confidence: nonEmptyStringSchema,
});

export const commandLedgerRowSchema = optionalFreshnessSchema.extend({
  command: nonEmptyStringSchema,
  surface: nonEmptyStringSchema,
  purpose: nonEmptyStringSchema,
  safety: nonEmptyStringSchema,
  mutates: nonEmptyStringSchema,
  approval_required: nonEmptyStringSchema,
  owner: nonEmptyStringSchema,
  compatibility: nonEmptyStringSchema,
});

export const riskLedgerRowSchema = optionalFreshnessSchema.extend({
  risk: nonEmptyStringSchema,
  impact: nonEmptyStringSchema,
  mitigation: nonEmptyStringSchema,
  owner: nonEmptyStringSchema,
});

export const toolAvailabilityLedgerRowSchema = optionalFreshnessSchema.extend({
  tool: nonEmptyStringSchema,
  category: nonEmptyStringSchema,
  status: nonEmptyStringSchema,
  safety: nonEmptyStringSchema,
  preconditions: nonEmptyStringSchema,
  fallback: nonEmptyStringSchema,
});

export const unknownsLedgerRowSchema = optionalFreshnessSchema.extend({
  unknown: nonEmptyStringSchema,
  status: nonEmptyStringSchema,
  resolution: nonEmptyStringSchema,
  router_required: nonEmptyStringSchema,
});

export const workflowLedgerRowSchema = optionalFreshnessSchema.extend({
  workflow: nonEmptyStringSchema,
  purpose: nonEmptyStringSchema,
  mutates_checkout: nonEmptyStringSchema,
  artifact_contract: nonEmptyStringSchema,
  role_contracts: nonEmptyStringSchema,
  compatibility: nonEmptyStringSchema,
});

export type ArtifactLedgerRow = z.infer<typeof artifactLedgerRowSchema>;
export type CapabilityLedgerRow = z.infer<typeof capabilityLedgerRowSchema>;
export type CommandLedgerRow = z.infer<typeof commandLedgerRowSchema>;
export type RiskLedgerRow = z.infer<typeof riskLedgerRowSchema>;
export type ToolAvailabilityLedgerRow = z.infer<typeof toolAvailabilityLedgerRowSchema>;
export type UnknownsLedgerRow = z.infer<typeof unknownsLedgerRowSchema>;
export type WorkflowLedgerRow = z.infer<typeof workflowLedgerRowSchema>;

export interface LedgerCsvInputs {
  readonly artifact: string;
  readonly capability: string;
  readonly command: string;
  readonly risk: string;
  readonly tool: string;
  readonly unknowns: string;
  readonly workflow: string;
}

export interface LedgerObjectInputs {
  readonly artifact: readonly ArtifactLedgerRow[];
  readonly capability: readonly CapabilityLedgerRow[];
  readonly command: readonly CommandLedgerRow[];
  readonly risk: readonly RiskLedgerRow[];
  readonly tool: readonly ToolAvailabilityLedgerRow[];
  readonly unknowns: readonly UnknownsLedgerRow[];
  readonly workflow: readonly WorkflowLedgerRow[];
}

export type LedgerBundleInput = LedgerCsvInputs | LedgerObjectInputs;

export const ledgerCountsSchema = z
  .object({
    artifact: z.number().int().nonnegative(),
    capability: z.number().int().nonnegative(),
    command: z.number().int().nonnegative(),
    risk: z.number().int().nonnegative(),
    tool: z.number().int().nonnegative(),
    unknowns: z.number().int().nonnegative(),
    workflow: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })
  .strict();

export const ledgerSourceRefSchema = z
  .object({
    ledger: ledgerNameSchema,
    fileName: nonEmptyStringSchema,
    rowNumber: z.number().int().positive(),
  })
  .strict();

export const sourceLedgerProvenanceSchema = z
  .object({
    ledger: ledgerNameSchema,
    fileName: nonEmptyStringSchema,
    header: z.array(nonEmptyStringSchema).min(1),
    rowCount: z.number().int().nonnegative(),
    evidence: evidenceRefSchema,
  })
  .strict();

const confidenceSchema = z.enum(['low', 'medium', 'high'] as const satisfies readonly Confidence[]);
const freshnessSchema = z.enum(freshnessValues satisfies readonly [Freshness, ...Freshness[]]);
const mutationClassSchema = z.enum(
  mutationClassValues satisfies readonly [MutationClass, ...MutationClass[]]
);

const entryBaseSchema = z
  .object({
    kind: z.literal('ledger-entry'),
    id: nonEmptyStringSchema,
    source: ledgerSourceRefSchema,
    owner: nonEmptyStringSchema,
    confidence: confidenceSchema,
    freshness: freshnessSchema,
    evidence: z.array(evidenceRefSchema).min(1),
    raw: z.record(z.string()),
  })
  .strict();

export const artifactLedgerEntrySchema = entryBaseSchema.extend({
  ledger: z.literal('artifact'),
  status: z.enum(artifactLedgerStatusValues),
  subject: z
    .object({
      artifact: nonEmptyStringSchema,
      schemaVersion: nonEmptyStringSchema,
      producer: nonEmptyStringSchema,
      consumer: nonEmptyStringSchema,
      required: nonEmptyStringSchema,
    })
    .strict(),
  compatibility: ledgerCompatibilitySchema,
  approvalRequired: z.boolean(),
});

export const capabilityLedgerEntrySchema = entryBaseSchema.extend({
  ledger: z.literal('capability'),
  status: z.enum(capabilityLedgerStatusValues),
  subject: z
    .object({
      id: nonEmptyStringSchema,
      capability: nonEmptyStringSchema,
      currentSurface: nonEmptyStringSchema,
      rewriteAction: ledgerCompatibilitySchema,
      requiredArtifact: nonEmptyStringSchema,
    })
    .strict(),
  compatibility: ledgerCompatibilitySchema,
  approvalRequired: z.boolean(),
});

export const commandLedgerEntrySchema = entryBaseSchema.extend({
  ledger: z.literal('command'),
  status: z.enum(commandLedgerStatusValues),
  subject: z
    .object({
      command: nonEmptyStringSchema,
      surface: nonEmptyStringSchema,
      purpose: nonEmptyStringSchema,
      safety: ledgerSafetySchema,
      mutates: mutationClassSchema,
      approvalRequired: z.boolean(),
      owner: nonEmptyStringSchema,
      compatibility: z.enum(surfaceCompatibilityValues),
    })
    .strict(),
  compatibility: z.enum(surfaceCompatibilityValues),
  safety: ledgerSafetySchema,
  mutates: mutationClassSchema,
  approvalRequired: z.boolean(),
});

export const riskLedgerEntrySchema = entryBaseSchema.extend({
  ledger: z.literal('risk'),
  status: z.enum(riskLedgerStatusValues),
  subject: z
    .object({
      risk: nonEmptyStringSchema,
      impact: nonEmptyStringSchema,
      mitigation: nonEmptyStringSchema,
    })
    .strict(),
  compatibility: ledgerCompatibilitySchema,
  approvalRequired: z.boolean(),
});

export const toolAvailabilityLedgerEntrySchema = entryBaseSchema.extend({
  ledger: z.literal('tool'),
  status: z.enum(toolLedgerStatusValues),
  subject: z
    .object({
      tool: nonEmptyStringSchema,
      category: nonEmptyStringSchema,
      safety: ledgerSafetySchema,
      preconditions: nonEmptyStringSchema,
      fallback: nonEmptyStringSchema,
    })
    .strict(),
  compatibility: ledgerCompatibilitySchema,
  safety: ledgerSafetySchema,
  approvalRequired: z.boolean(),
});

export const unknownsLedgerEntrySchema = entryBaseSchema.extend({
  ledger: z.literal('unknowns'),
  status: z.enum(unknownLedgerStatusValues),
  subject: z
    .object({
      unknown: nonEmptyStringSchema,
      resolution: nonEmptyStringSchema,
      routerRequired: z.boolean(),
    })
    .strict(),
  compatibility: ledgerCompatibilitySchema,
  approvalRequired: z.boolean(),
});

export const workflowLedgerEntrySchema = entryBaseSchema.extend({
  ledger: z.literal('workflow'),
  status: z.enum(workflowLedgerStatusValues),
  subject: z
    .object({
      workflow: nonEmptyStringSchema,
      purpose: nonEmptyStringSchema,
      mutatesCheckout: z.boolean(),
      mutatesCheckoutRaw: nonEmptyStringSchema,
      artifactContract: nonEmptyStringSchema,
      roleContracts: z.array(nonEmptyStringSchema).min(1),
      compatibility: ledgerCompatibilitySchema,
    })
    .strict(),
  compatibility: ledgerCompatibilitySchema,
  approvalRequired: z.boolean(),
});

export const acoLedgerEntrySchema = z.discriminatedUnion('ledger', [
  artifactLedgerEntrySchema,
  capabilityLedgerEntrySchema,
  commandLedgerEntrySchema,
  riskLedgerEntrySchema,
  toolAvailabilityLedgerEntrySchema,
  unknownsLedgerEntrySchema,
  workflowLedgerEntrySchema,
]);

export const ledgerBundleSchema = z
  .object({
    kind: z.literal('ledger-bundle'),
    id: z.literal('aco.ledger-bundle.fixture'),
    schemaVersion: z.literal('aco.ledger-bundle.v1'),
    generatedFrom: z.array(sourceLedgerProvenanceSchema).length(ledgerNameValues.length),
    counts: ledgerCountsSchema,
    artifacts: z.array(artifactLedgerEntrySchema),
    capabilities: z.array(capabilityLedgerEntrySchema),
    commands: z.array(commandLedgerEntrySchema),
    risks: z.array(riskLedgerEntrySchema),
    tools: z.array(toolAvailabilityLedgerEntrySchema),
    unknowns: z.array(unknownsLedgerEntrySchema),
    workflows: z.array(workflowLedgerEntrySchema),
    entries: z.array(acoLedgerEntrySchema),
  })
  .strict();

export type LedgerCounts = z.infer<typeof ledgerCountsSchema>;
export type LedgerSourceRef = z.infer<typeof ledgerSourceRefSchema>;
export type SourceLedgerProvenance = z.infer<typeof sourceLedgerProvenanceSchema>;
export type ArtifactLedgerEntry = z.infer<typeof artifactLedgerEntrySchema>;
export type CapabilityLedgerEntry = z.infer<typeof capabilityLedgerEntrySchema>;
export type CommandLedgerEntry = z.infer<typeof commandLedgerEntrySchema>;
export type RiskLedgerEntry = z.infer<typeof riskLedgerEntrySchema>;
export type ToolAvailabilityLedgerEntry = z.infer<typeof toolAvailabilityLedgerEntrySchema>;
export type UnknownsLedgerEntry = z.infer<typeof unknownsLedgerEntrySchema>;
export type WorkflowLedgerEntry = z.infer<typeof workflowLedgerEntrySchema>;
export type AcoLedgerEntry = z.infer<typeof acoLedgerEntrySchema>;
export type LedgerBundle = z.infer<typeof ledgerBundleSchema>;
