import { z } from 'zod';
import { evidenceRefSchema, mutationClassValues } from '@archon/aco-core';
import { acoCommandIdValues } from '@archon/aco-cli-contracts';
import { acoWorkflowIdValues } from '@archon/aco-workflows';

export const apiUiParityStatusValues = ['terminal'] as const;
export const apiUiReadinessValues = ['complete-with-approval-gates'] as const;
export const apiUiSurfaceLayerValues = ['api', 'ui'] as const;
export const apiUiSurfaceStatusValues = ['contractual'] as const;
export const apiUiCoverageStatusValues = ['committed', 'approval-gated', 'deferred'] as const;
export const terminalNextSliceValues = ['complete'] as const;

const nonEmptyStringSchema = z.string().min(1);
const mutationClassSchema = z.enum(mutationClassValues);

export const apiUiPackageCoverageSchema = z
  .object({
    slice: nonEmptyStringSchema,
    packageName: nonEmptyStringSchema,
    ownerSurface: nonEmptyStringSchema,
    status: z.enum(apiUiCoverageStatusValues),
    evidenceId: nonEmptyStringSchema,
  })
  .strict();

export const apiUiLedgerCoverageSchema = z
  .object({
    name: nonEmptyStringSchema,
    ownerSurface: nonEmptyStringSchema,
    status: z.enum(apiUiCoverageStatusValues),
  })
  .strict();

export const apiUiCommandCoverageSchema = z
  .object({
    total: z.number().int().nonnegative(),
    supported: z.number().int().nonnegative(),
    deferred: z.number().int().nonnegative(),
    approvalRequired: z.number().int().nonnegative(),
    readOnlySupported: z.number().int().nonnegative(),
  })
  .strict();

export const apiUiWorkflowCoverageSchema = z
  .object({
    name: z.enum(acoWorkflowIdValues),
    status: z.enum(apiUiCoverageStatusValues),
    nodeCount: z.number().int().positive(),
    bundledDefaultFile: nonEmptyStringSchema,
    bundledDefaultChecksum: nonEmptyStringSchema,
  })
  .strict();

export const apiUiRemainingGateSchema = z
  .object({
    commandId: z.enum(acoCommandIdValues),
    display: nonEmptyStringSchema,
    ownerSurface: nonEmptyStringSchema,
    status: z.enum(apiUiCoverageStatusValues),
    mutationScope: z.array(mutationClassSchema),
    reason: nonEmptyStringSchema,
    stopCondition: nonEmptyStringSchema,
  })
  .strict();

export const apiUiSurfaceContractSchema = z
  .object({
    id: z.enum(['api.aco.parity', 'ui.aco.parity']),
    layer: z.enum(apiUiSurfaceLayerValues),
    route: nonEmptyStringSchema,
    method: nonEmptyStringSchema,
    status: z.enum(apiUiSurfaceStatusValues),
    readOnly: z.boolean(),
    consumes: z.array(nonEmptyStringSchema),
    produces: z.array(nonEmptyStringSchema),
  })
  .strict();

export const apiUiContextCoverageSchema = z
  .object({
    statusReadiness: nonEmptyStringSchema,
    nextSlice: z.enum(terminalNextSliceValues),
    deferredSurfaces: z.array(nonEmptyStringSchema),
    workflowParityDeferred: z.boolean(),
  })
  .strict();

export const apiUiSourceTerminalitySchema = z
  .object({
    contextNextSlice: z.enum(terminalNextSliceValues),
    workflowNextSlice: z.enum(terminalNextSliceValues),
    terminal: z.boolean(),
  })
  .strict();

export const apiUiParityBundleSchema = z
  .object({
    kind: z.literal('aco-api-ui-parity-bundle'),
    schemaVersion: z.literal('aco.api-ui-parity-bundle.v1'),
    id: z.literal('aco.api-ui.s10.parity'),
    status: z.enum(apiUiParityStatusValues),
    readiness: z.enum(apiUiReadinessValues),
    nextSlice: z.null(),
    sourceTerminality: apiUiSourceTerminalitySchema,
    packageCoverage: z.array(apiUiPackageCoverageSchema).min(1),
    ledgerCoverage: z.array(apiUiLedgerCoverageSchema).min(1),
    commandCoverage: apiUiCommandCoverageSchema,
    workflowCoverage: z.array(apiUiWorkflowCoverageSchema).length(acoWorkflowIdValues.length),
    contextCoverage: apiUiContextCoverageSchema,
    remainingApprovalGates: z.array(apiUiRemainingGateSchema),
    surfaceContracts: z.array(apiUiSurfaceContractSchema).length(2),
    terminalCriteria: z.array(nonEmptyStringSchema).min(1),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const apiUiViewRowSchema = z
  .object({
    label: nonEmptyStringSchema,
    value: nonEmptyStringSchema,
    status: z.enum(apiUiCoverageStatusValues).optional(),
  })
  .strict();

export const apiUiViewSectionSchema = z
  .object({
    id: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    rows: z.array(apiUiViewRowSchema),
  })
  .strict();

export const apiUiParityViewModelSchema = z
  .object({
    kind: z.literal('aco-api-ui-view-model'),
    schemaVersion: z.literal('aco.api-ui-view-model.v1'),
    route: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    statusLabel: nonEmptyStringSchema,
    summary: z
      .object({
        readiness: nonEmptyStringSchema,
        packageCount: z.number().int().nonnegative(),
        workflowCount: z.number().int().nonnegative(),
        remainingGateCount: z.number().int().nonnegative(),
      })
      .strict(),
    sections: z.array(apiUiViewSectionSchema).min(1),
  })
  .strict();

export type ApiUiParityStatus = (typeof apiUiParityStatusValues)[number];
export type ApiUiReadiness = (typeof apiUiReadinessValues)[number];
export type ApiUiSurfaceLayer = (typeof apiUiSurfaceLayerValues)[number];
export type ApiUiSurfaceStatus = (typeof apiUiSurfaceStatusValues)[number];
export type ApiUiCoverageStatus = (typeof apiUiCoverageStatusValues)[number];
export type ApiUiPackageCoverage = z.infer<typeof apiUiPackageCoverageSchema>;
export type ApiUiLedgerCoverage = z.infer<typeof apiUiLedgerCoverageSchema>;
export type ApiUiCommandCoverage = z.infer<typeof apiUiCommandCoverageSchema>;
export type ApiUiWorkflowCoverage = z.infer<typeof apiUiWorkflowCoverageSchema>;
export type ApiUiRemainingGate = z.infer<typeof apiUiRemainingGateSchema>;
export type ApiUiSurfaceContract = z.infer<typeof apiUiSurfaceContractSchema>;
export type ApiUiContextCoverage = z.infer<typeof apiUiContextCoverageSchema>;
export type ApiUiSourceTerminality = z.infer<typeof apiUiSourceTerminalitySchema>;
export type ApiUiParityBundle = z.infer<typeof apiUiParityBundleSchema>;
export type ApiUiViewRow = z.infer<typeof apiUiViewRowSchema>;
export type ApiUiViewSection = z.infer<typeof apiUiViewSectionSchema>;
export type ApiUiParityViewModel = z.infer<typeof apiUiParityViewModelSchema>;
