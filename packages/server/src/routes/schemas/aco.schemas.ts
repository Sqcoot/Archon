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

export const acoStatusQuerySchema = z
  .object({
    cwd: z.string().min(1),
  })
  .openapi('AcoStatusQuery');

export const acoStatusResponseSchema = z
  .object({
    cwd: z.string(),
    graphStatus: z.string(),
    graphWaivers: z.number(),
    graphWaiverIds: z.array(z.string()),
    validationStatus: z.string(),
    ledgerSchemaVersion: z.string(),
    ledgerSummary: z.object({
      toolAvailability: ledgerSummarySectionSchema,
      commands: ledgerSummarySectionSchema,
      combined: ledgerSummarySectionSchema,
    }),
  })
  .openapi('AcoStatusResponse');
