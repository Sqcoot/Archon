/**
 * Zod schemas for ACO parity API endpoints.
 */
import { z } from '@hono/zod-openapi';

const statusLiteralSchema = z.enum(['committed', 'approval-gated', 'deferred', 'contractual']);

export const acoParityResponseSchema = z
  .object({
    kind: z.literal('aco-api-ui-parity-bundle'),
    schemaVersion: z.literal('aco.api-ui-parity-bundle.v1'),
    id: z.literal('aco.api-ui.s10.parity'),
    status: z.literal('terminal'),
    readiness: z.literal('complete-with-approval-gates'),
    nextSlice: z.null(),
    sourceTerminality: z.object({
      contextNextSlice: z.literal('complete'),
      workflowNextSlice: z.literal('complete'),
      terminal: z.boolean(),
    }),
    packageCoverage: z.array(
      z.object({
        slice: z.string(),
        packageName: z.string(),
        ownerSurface: z.string(),
        status: statusLiteralSchema,
        evidenceId: z.string(),
      })
    ),
    ledgerCoverage: z.array(
      z.object({
        name: z.string(),
        ownerSurface: z.string(),
        status: statusLiteralSchema,
      })
    ),
    commandCoverage: z.object({
      total: z.number(),
      supported: z.number(),
      deferred: z.number(),
      approvalRequired: z.number(),
      readOnlySupported: z.number(),
    }),
    workflowCoverage: z.array(
      z.object({
        name: z.string(),
        status: statusLiteralSchema,
        nodeCount: z.number(),
        bundledDefaultFile: z.string(),
        bundledDefaultChecksum: z.string(),
      })
    ),
    contextCoverage: z.object({
      statusReadiness: z.string(),
      nextSlice: z.literal('complete'),
      deferredSurfaces: z.array(z.string()),
      workflowParityDeferred: z.boolean(),
    }),
    remainingApprovalGates: z.array(
      z.object({
        commandId: z.string(),
        display: z.string(),
        ownerSurface: z.string(),
        status: statusLiteralSchema,
        mutationScope: z.array(z.string()),
        reason: z.string(),
        stopCondition: z.string(),
      })
    ),
    surfaceContracts: z.array(
      z.object({
        id: z.string(),
        layer: z.enum(['api', 'ui']),
        route: z.string(),
        method: z.string(),
        status: z.literal('contractual'),
        readOnly: z.boolean(),
        consumes: z.array(z.string()),
        produces: z.array(z.string()),
      })
    ),
    terminalCriteria: z.array(z.string()),
    evidence: z.array(
      z.object({
        id: z.string(),
        source: z.string(),
        summary: z.string(),
        confidence: z.string(),
        freshness: z.string(),
      })
    ),
  })
  .openapi('AcoParityResponse');
