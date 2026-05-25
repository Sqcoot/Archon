import { z } from 'zod';
import { evidenceRefSchema, mutationClassValues } from '@archon/aco-core';
import {
  acoCommandIdValues,
  acoCommandImplementationStatusValues,
} from '@archon/aco-cli-contracts';

export const contextReadinessValues = [
  'ready',
  'degraded',
  'approval_required',
  'blocked',
] as const;
export const contextLedgerStatusValues = ['present', 'missing', 'malformed'] as const;
export const approvalCapsuleStatusValues = ['not-granted'] as const;
export const approvalCapsuleVerificationStatusValues = ['passed', 'failed'] as const;

const nonEmptyStringSchema = z.string().min(1);
const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const contextLedgerSummarySchema = z
  .object({
    name: nonEmptyStringSchema,
    status: z.enum(contextLedgerStatusValues),
    rowCount: z.number().int().nonnegative(),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const contextCommandCoverageSchema = z
  .object({
    commandId: z.enum(acoCommandIdValues),
    display: nonEmptyStringSchema,
    owner: nonEmptyStringSchema,
    implementationStatus: z.enum(acoCommandImplementationStatusValues),
  })
  .strict();

export const contextGraphWaiverSummarySchema = z
  .object({
    required: z.boolean(),
    status: nonEmptyStringSchema,
    command: nonEmptyStringSchema.nullable(),
    safetyClass: z.enum(mutationClassValues).nullable(),
    findings: z.array(nonEmptyStringSchema),
  })
  .strict();

export const contextApprovalRequirementSchema = z
  .object({
    commandId: nonEmptyStringSchema,
    display: nonEmptyStringSchema,
    required: z.boolean(),
    mutationScope: z.array(z.enum(mutationClassValues)),
    reason: nonEmptyStringSchema,
  })
  .strict();

export const contextStatusSchema = z
  .object({
    kind: z.literal('aco-context-status'),
    schemaVersion: z.literal('aco.context-status.v1'),
    id: nonEmptyStringSchema,
    prompt: nonEmptyStringSchema.nullable(),
    promptDigest: checksumSchema,
    readiness: z.enum(contextReadinessValues),
    requiredLedgers: z.array(contextLedgerSummarySchema).min(1),
    commandCoverage: z.array(contextCommandCoverageSchema).min(1),
    graphWaiver: contextGraphWaiverSummarySchema,
    approvalReadiness: z.array(contextApprovalRequirementSchema),
    deferredSurfaces: z.array(nonEmptyStringSchema),
    nextSlice: nonEmptyStringSchema,
    findings: z.array(nonEmptyStringSchema),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const contextRouteSummarySchema = z
  .object({
    commandId: z.enum(acoCommandIdValues),
    display: nonEmptyStringSchema,
    owner: nonEmptyStringSchema,
    implementationStatus: z.enum(acoCommandImplementationStatusValues),
  })
  .strict();

export const compiledContextPackageSchema = z
  .object({
    kind: z.literal('aco-context-package'),
    schemaVersion: z.literal('aco.context-package.v1'),
    id: nonEmptyStringSchema,
    prompt: nonEmptyStringSchema,
    promptDigest: checksumSchema,
    contextDigest: checksumSchema,
    selectedRoute: contextRouteSummarySchema,
    statusReadiness: z.enum(contextReadinessValues),
    statusFindings: z.array(nonEmptyStringSchema),
    ledgerSummaries: z.array(contextLedgerSummarySchema).min(1),
    evidenceRefs: z.array(evidenceRefSchema).min(1),
    graphWaiver: contextGraphWaiverSummarySchema,
    roleConstraints: z.array(nonEmptyStringSchema).min(1),
    capabilityConstraints: z.array(nonEmptyStringSchema).min(1),
    approvalRequirements: z.array(contextApprovalRequirementSchema),
    deferredItems: z.array(nonEmptyStringSchema),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const approvalCapsuleCommandSchema = z
  .object({
    id: z.enum(acoCommandIdValues),
    display: nonEmptyStringSchema,
  })
  .strict();

export const approvalCapsuleSchema = z
  .object({
    kind: z.literal('aco-approval-capsule'),
    schemaVersion: z.literal('aco.approval-capsule.v1'),
    id: nonEmptyStringSchema,
    promptDigest: checksumSchema,
    contextDigest: checksumSchema,
    requestedCommand: approvalCapsuleCommandSchema,
    mutationClass: z.enum(mutationClassValues),
    approvalScope: z.array(z.enum(mutationClassValues)).min(1),
    approvalStatus: z.enum(approvalCapsuleStatusValues),
    evidenceRefs: z.array(evidenceRefSchema).min(1),
    graphRequirements: contextGraphWaiverSummarySchema,
    roleAuthority: nonEmptyStringSchema,
    expiresWhen: nonEmptyStringSchema,
    invalidatesWhen: z.array(nonEmptyStringSchema).min(1),
    checksum: checksumSchema,
  })
  .strict();

export const approvalCapsuleVerificationSchema = z
  .object({
    kind: z.literal('aco-approval-capsule-verification'),
    schemaVersion: z.literal('aco.approval-capsule-verification.v1'),
    id: nonEmptyStringSchema,
    status: z.enum(approvalCapsuleVerificationStatusValues),
    capsuleId: nonEmptyStringSchema,
    commandId: z.enum(acoCommandIdValues),
    promptDigest: checksumSchema,
    contextDigest: checksumSchema,
    issues: z.array(nonEmptyStringSchema),
    canGrantApproval: z.literal(false),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export type ContextReadiness = (typeof contextReadinessValues)[number];
export type ContextLedgerStatus = (typeof contextLedgerStatusValues)[number];
export type ContextLedgerSummary = z.infer<typeof contextLedgerSummarySchema>;
export type ContextCommandCoverage = z.infer<typeof contextCommandCoverageSchema>;
export type ContextGraphWaiverSummary = z.infer<typeof contextGraphWaiverSummarySchema>;
export type ContextApprovalRequirement = z.infer<typeof contextApprovalRequirementSchema>;
export type ContextStatus = z.infer<typeof contextStatusSchema>;
export type ContextRouteSummary = z.infer<typeof contextRouteSummarySchema>;
export type CompiledContextPackage = z.infer<typeof compiledContextPackageSchema>;
export type ApprovalCapsuleStatus = (typeof approvalCapsuleStatusValues)[number];
export type ApprovalCapsuleCommand = z.infer<typeof approvalCapsuleCommandSchema>;
export type ApprovalCapsule = z.infer<typeof approvalCapsuleSchema>;
export type ApprovalCapsuleVerificationStatus =
  (typeof approvalCapsuleVerificationStatusValues)[number];
export type ApprovalCapsuleVerification = z.infer<typeof approvalCapsuleVerificationSchema>;
