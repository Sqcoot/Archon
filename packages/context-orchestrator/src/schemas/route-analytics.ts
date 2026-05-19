import { z } from '@hono/zod-openapi';
import { nextDecisionKindSchema } from './next-decision';

export const ROUTE_ANALYTICS_RECORD_SCHEMA_VERSION = 'aco.route-analytics.v1' as const;
export const ROUTE_ANALYTICS_REPORT_SCHEMA_VERSION = 'aco.route-analytics-report.v1' as const;

export const routeAnalyticsSourceSchema = z.enum(['cli', 'api', 'slash', 'workflow']);

const routeAnalyticsCountsSchema = z.record(z.number().int().nonnegative());

export const routeAnalyticsRecordSchema = z.object({
  schemaVersion: z.literal(ROUTE_ANALYTICS_RECORD_SCHEMA_VERSION),
  recordId: z.string().uuid(),
  intentHash: z.string().regex(/^[a-f0-9]{64}$/),
  objectivePreview: z.string().max(160).optional(),
  commitSha: z.string().nullable(),
  routeId: z.string().min(1),
  readiness: z.enum(['ready', 'blocked', 'needs_approval', 'unknown']),
  validationStatus: z.enum(['passed', 'warning', 'failed']),
  graphStatus: z.enum(['available', 'partial', 'forbidden', 'unavailable']),
  nextDecisionKind: nextDecisionKindSchema,
  waiverIds: z.array(z.string().min(1)),
  blockerIds: z.array(z.string().min(1)),
  ledgerCounts: routeAnalyticsCountsSchema,
  source: routeAnalyticsSourceSchema,
  timestamp: z.string().min(1),
});

export const routeAnalyticsTopCountSchema = z.object({
  id: z.string().min(1),
  count: z.number().int().nonnegative(),
});

export const routeAnalyticsReportSchema = z.object({
  schemaVersion: z.literal(ROUTE_ANALYTICS_REPORT_SCHEMA_VERSION),
  metadata: z.object({
    totalRowsRead: z.number().int().nonnegative(),
    validRows: z.number().int().nonnegative(),
    malformedRows: z.number().int().nonnegative(),
    skippedRows: z.number().int().nonnegative(),
    warnings: z.array(z.string().min(1)),
  }),
  aggregates: z.object({
    totalRecords: z.number().int().nonnegative(),
    routeCounts: routeAnalyticsCountsSchema,
    readinessCounts: routeAnalyticsCountsSchema,
    validationStatusCounts: routeAnalyticsCountsSchema,
    graphStatusCounts: routeAnalyticsCountsSchema,
    nextDecisionKindCounts: routeAnalyticsCountsSchema,
    sourceCounts: routeAnalyticsCountsSchema,
    topWaivers: z.array(routeAnalyticsTopCountSchema),
    topBlockers: z.array(routeAnalyticsTopCountSchema),
    approvalRequiredRate: z.number().min(0).max(1),
  }),
  recentRecords: z.array(routeAnalyticsRecordSchema),
});

export type RouteAnalyticsSource = z.infer<typeof routeAnalyticsSourceSchema>;
export type RouteAnalyticsRecordV1 = z.infer<typeof routeAnalyticsRecordSchema>;
export type RouteAnalyticsReport = z.infer<typeof routeAnalyticsReportSchema>;
export type RouteAnalyticsTopCount = z.infer<typeof routeAnalyticsTopCountSchema>;
