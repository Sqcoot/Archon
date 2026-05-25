import { z } from 'zod';
import { evidenceRefSchema, freshnessValues, mutationClassValues } from '@archon/aco-core';

export const researchGraphEvidenceStatusValues = [
  'complete',
  'failed',
  'waived',
  'not-started',
] as const;

export const researchWaiverClosureStatusValues = [
  'closed',
  'approval_required',
  'failed',
  'not-required',
] as const;

export const researchArtifactNameValues = [
  'upstream-graph-manifest.json',
  'graph-waiver-closure.json',
  'agentic-search-report.json',
  'agentic-search.md',
] as const;

const nonEmptyStringSchema = z.string().min(1);
const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const graphEvidenceRefSchema = z
  .object({
    repository: nonEmptyStringSchema,
    branch: nonEmptyStringSchema.nullable(),
    commitSha: nonEmptyStringSchema.nullable(),
    status: z.enum(researchGraphEvidenceStatusValues),
    nodes: z.number().int().nonnegative(),
    edges: z.number().int().nonnegative(),
    waiverRequired: z.boolean(),
    graphPath: nonEmptyStringSchema,
    reportPath: nonEmptyStringSchema,
    metadataPath: nonEmptyStringSchema,
  })
  .strict();

export const researchArtifactMetadataSchema = z
  .object({
    kind: z.literal('aco-research-artifact-metadata'),
    schemaVersion: z.literal('aco.research-artifact-metadata.v1'),
    producer: nonEmptyStringSchema,
    consumer: nonEmptyStringSchema,
    path: nonEmptyStringSchema,
    checksum: checksumSchema,
    freshness: z.enum(freshnessValues),
  })
  .strict();

export const upstreamGraphManifestSchema = z
  .object({
    kind: z.literal('aco-upstream-graph-manifest'),
    schemaVersion: z.literal('aco.upstream-graph-manifest.v1'),
    repositories: z.array(graphEvidenceRefSchema).min(1),
    artifacts: z.array(researchArtifactMetadataSchema).min(1),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const graphWaiverClosureSchema = z
  .object({
    kind: z.literal('aco-graph-waiver-closure'),
    schemaVersion: z.literal('aco.graph-waiver-closure.v1'),
    id: nonEmptyStringSchema,
    required: z.boolean(),
    status: z.enum(researchWaiverClosureStatusValues),
    command: nonEmptyStringSchema.nullable(),
    safetyClass: z.enum(mutationClassValues).nullable(),
    expectedSuccessEvidence: z.array(nonEmptyStringSchema),
    graphRefs: z.array(graphEvidenceRefSchema),
    artifacts: z.array(researchArtifactMetadataSchema),
    findings: z.array(nonEmptyStringSchema),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

const implementationSurfaceSchema = z
  .object({
    path: nonEmptyStringSchema,
    owner: nonEmptyStringSchema,
    reason: nonEmptyStringSchema,
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

const testAcceptanceMarkerSchema = z
  .object({
    commandOrPath: nonEmptyStringSchema,
    marker: nonEmptyStringSchema,
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

const recommendedSliceSchema = z
  .object({
    id: nonEmptyStringSchema,
    packageName: nonEmptyStringSchema,
    reason: nonEmptyStringSchema,
  })
  .strict();

export const agenticSearchReportSchema = z
  .object({
    kind: z.literal('aco-agentic-search-report'),
    schemaVersion: z.literal('aco.agentic-search-report.v1'),
    id: nonEmptyStringSchema,
    objective: nonEmptyStringSchema,
    intentHash: checksumSchema,
    candidateImplementationSurfaces: z.array(implementationSurfaceSchema).min(1),
    candidateTestsAndAcceptanceMarkers: z.array(testAcceptanceMarkerSchema).min(1),
    dependencyContextGraphRefs: z.array(graphEvidenceRefSchema).min(1),
    evidenceGaps: z.array(nonEmptyStringSchema),
    disallowedAssumptions: z.array(nonEmptyStringSchema).min(1),
    recommendedNextSlice: recommendedSliceSchema,
    artifacts: z.array(researchArtifactMetadataSchema).min(1),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const researchArtifactSchema = z
  .object({
    name: z.enum(researchArtifactNameValues),
    mediaType: nonEmptyStringSchema,
    schemaVersion: nonEmptyStringSchema,
    content: nonEmptyStringSchema,
    metadata: researchArtifactMetadataSchema,
  })
  .strict();

export const researchArtifactBundleSchema = z
  .object({
    kind: z.literal('aco-research-artifact-bundle'),
    schemaVersion: z.literal('aco.research-artifacts.v1'),
    artifacts: z.array(researchArtifactSchema).length(researchArtifactNameValues.length),
    upstreamManifest: upstreamGraphManifestSchema,
    waiverClosure: graphWaiverClosureSchema,
    agenticSearchReport: agenticSearchReportSchema,
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export type ResearchGraphEvidenceStatus = (typeof researchGraphEvidenceStatusValues)[number];
export type ResearchWaiverClosureStatus = (typeof researchWaiverClosureStatusValues)[number];
export type ResearchArtifactName = (typeof researchArtifactNameValues)[number];
export type GraphEvidenceRef = z.infer<typeof graphEvidenceRefSchema>;
export type ResearchArtifactMetadata = z.infer<typeof researchArtifactMetadataSchema>;
export type UpstreamGraphManifest = z.infer<typeof upstreamGraphManifestSchema>;
export type GraphWaiverClosure = z.infer<typeof graphWaiverClosureSchema>;
export type AgenticSearchReport = z.infer<typeof agenticSearchReportSchema>;
export type ResearchImplementationSurface = z.infer<typeof implementationSurfaceSchema>;
export type ResearchTestAcceptanceMarker = z.infer<typeof testAcceptanceMarkerSchema>;
export type ResearchRecommendedSlice = z.infer<typeof recommendedSliceSchema>;
export type ResearchArtifact = z.infer<typeof researchArtifactSchema>;
export type ResearchArtifactBundle = z.infer<typeof researchArtifactBundleSchema>;
