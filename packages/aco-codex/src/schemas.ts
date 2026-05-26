import { z } from 'zod';
import {
  artifactRefSchema,
  commandManifestRecordSchema,
  evidenceRefSchema,
  providerManifestRecordSchema,
} from '@archon/aco-core';

export const codexCapabilityStatusValues = [
  'supported',
  'partial',
  'unsupported',
  'unknown',
  'deferred_by_design',
] as const;

export const codexBootstrapEventTypeValues = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'PreCompact',
  'PostCompact',
  'SubagentStart',
  'SubagentStop',
  'Stop',
  'Unknown',
] as const;

export const codexBootstrapArtifactNameValues = [
  'codex-bootstrap-capsule.md',
  'codex-bootstrap-context.json',
  'capability-snapshot.json',
  'codex-harness-capability-report.json',
  'codex-continuation-handoff.md',
] as const;

export const codexHarnessResultStatusValues = [
  'accepted',
  'rejected',
  'failed',
  'unknown',
] as const;

const nonEmptyStringSchema = z.string().min(1);
export const bootstrapCodexCommandDescriptorSchema = z
  .object({
    kind: z.literal('codex-bootstrap-command'),
    command: z.literal(
      'archon aco bootstrap-codex --event <event> --format markdown|json [--no-write-artifact]'
    ),
    owner: z.literal('aco-codex'),
    compatibility: z.literal('preserve'),
    defaultMutates: z.literal('writes-artifacts'),
    noWriteArtifactMutates: z.literal('read-only'),
    approvalRequired: z.literal(false),
    evidence: z.array(evidenceRefSchema).min(1),
    manifest: commandManifestRecordSchema,
  })
  .strict();

export const codexRepositoryContextSchema = z
  .object({
    repoPath: nonEmptyStringSchema,
    branch: nonEmptyStringSchema,
    baseBranch: nonEmptyStringSchema,
    referenceBranch: nonEmptyStringSchema,
    readonlyReference: z.boolean(),
  })
  .strict();

export const codexBootstrapEventSchema = z
  .object({
    type: z.enum(codexBootstrapEventTypeValues),
    label: nonEmptyStringSchema,
    payloadContract: nonEmptyStringSchema,
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const codexBootstrapInputSchema = z
  .object({
    kind: z.literal('codex-bootstrap-input'),
    schemaVersion: z.literal('aco.codex-bootstrap-input.v1'),
    id: nonEmptyStringSchema,
    goal: nonEmptyStringSchema,
    mode: z.literal('read-only'),
    repository: codexRepositoryContextSchema,
    event: codexBootstrapEventSchema,
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const codexHarnessCapabilitySchema = z
  .object({
    id: nonEmptyStringSchema,
    question: nonEmptyStringSchema,
    status: z.enum(codexCapabilityStatusValues),
    runtimeClaimed: z.boolean(),
    approvalRequired: z.boolean(),
    summary: nonEmptyStringSchema,
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const codexCapabilitySummarySchema = z
  .object({
    supported: z.number().int().nonnegative(),
    partial: z.number().int().nonnegative(),
    unsupported: z.number().int().nonnegative(),
    unknown: z.number().int().nonnegative(),
    deferred_by_design: z.number().int().nonnegative(),
  })
  .strict();

export const codexHarnessCapabilityReportSchema = z
  .object({
    kind: z.literal('codex-harness-capability-report'),
    schemaVersion: z.literal('aco.codex-harness-capability-report.v1'),
    provider: z.literal('codex'),
    contractOnly: z.literal(true),
    checks: z.array(codexHarnessCapabilitySchema).min(1),
    summary: codexCapabilitySummarySchema,
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const codexCapabilitySnapshotSchema = z
  .object({
    kind: z.literal('codex-capability-snapshot'),
    schemaVersion: z.literal('aco.codex-capability-snapshot.v1'),
    provider: z.literal('codex'),
    command: bootstrapCodexCommandDescriptorSchema,
    capabilities: z.array(codexHarnessCapabilitySchema).min(1),
    nonClaims: z.array(nonEmptyStringSchema).min(1),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const codexContinuationHandoffSchema = z
  .object({
    kind: z.literal('codex-continuation-handoff'),
    schemaVersion: z.literal('aco.codex-continuation-handoff.v1'),
    id: nonEmptyStringSchema,
    resumeGoal: nonEmptyStringSchema,
    completedArtifacts: z.array(z.enum(codexBootstrapArtifactNameValues)).min(1),
    nextActions: z.array(nonEmptyStringSchema).min(1),
    blockedRuntimeClaims: z.array(nonEmptyStringSchema).min(1),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const codexBootstrapContextSchema = z
  .object({
    kind: z.literal('codex-bootstrap-context'),
    schemaVersion: z.literal('aco.codex-bootstrap-context.v1'),
    id: nonEmptyStringSchema,
    goal: nonEmptyStringSchema,
    mode: z.literal('read-only'),
    repository: codexRepositoryContextSchema,
    event: codexBootstrapEventSchema,
    command: bootstrapCodexCommandDescriptorSchema,
    requiredArtifacts: z
      .array(z.enum(codexBootstrapArtifactNameValues))
      .length(codexBootstrapArtifactNameValues.length),
    capabilityReport: codexHarnessCapabilityReportSchema,
    continuationHandoff: codexContinuationHandoffSchema,
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const codexBootstrapArtifactSchema = z
  .object({
    name: z.enum(codexBootstrapArtifactNameValues),
    mediaType: nonEmptyStringSchema,
    schemaVersion: nonEmptyStringSchema,
    content: nonEmptyStringSchema,
  })
  .strict();

export const codexBootstrapArtifactBundleSchema = z
  .object({
    kind: z.literal('codex-bootstrap-artifact-bundle'),
    schemaVersion: z.literal('aco.codex-bootstrap-artifacts.v1'),
    command: bootstrapCodexCommandDescriptorSchema,
    artifacts: z
      .array(codexBootstrapArtifactSchema)
      .length(codexBootstrapArtifactNameValues.length),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const codexHarnessResultSchema = z
  .object({
    kind: z.literal('codex-harness-result'),
    schemaVersion: z.literal('aco.codex-harness-result.v1'),
    status: z.enum(codexHarnessResultStatusValues),
    artifacts: z.array(artifactRefSchema),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const codexProviderManifestSchema = providerManifestRecordSchema;

export type BootstrapCodexCommandDescriptor = z.infer<typeof bootstrapCodexCommandDescriptorSchema>;
export type CodexRepositoryContext = z.infer<typeof codexRepositoryContextSchema>;
export type CodexBootstrapEventType = (typeof codexBootstrapEventTypeValues)[number];
export type CodexBootstrapEvent = z.infer<typeof codexBootstrapEventSchema>;
export type CodexBootstrapInput = z.infer<typeof codexBootstrapInputSchema>;
export type CodexCapabilityStatus = (typeof codexCapabilityStatusValues)[number];
export type CodexHarnessCapability = z.infer<typeof codexHarnessCapabilitySchema>;
export type CodexCapabilitySummary = z.infer<typeof codexCapabilitySummarySchema>;
export type CodexHarnessCapabilityReport = z.infer<typeof codexHarnessCapabilityReportSchema>;
export type CodexCapabilitySnapshot = z.infer<typeof codexCapabilitySnapshotSchema>;
export type CodexContinuationHandoff = z.infer<typeof codexContinuationHandoffSchema>;
export type CodexBootstrapContext = z.infer<typeof codexBootstrapContextSchema>;
export type CodexBootstrapArtifactName = (typeof codexBootstrapArtifactNameValues)[number];
export type CodexBootstrapArtifact = z.infer<typeof codexBootstrapArtifactSchema>;
export type CodexBootstrapArtifactBundle = z.infer<typeof codexBootstrapArtifactBundleSchema>;
export type CodexHarnessResult = z.infer<typeof codexHarnessResultSchema>;
