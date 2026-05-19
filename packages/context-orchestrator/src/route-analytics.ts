import { createHash, randomUUID } from 'crypto';
import { appendFile, mkdir, readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { createDecisionDossier } from './decision-dossier';
import {
  ROUTE_ANALYTICS_RECORD_SCHEMA_VERSION,
  ROUTE_ANALYTICS_REPORT_SCHEMA_VERSION,
  routeAnalyticsRecordSchema,
  routeAnalyticsReportSchema,
  type RouteAnalyticsRecordV1,
  type RouteAnalyticsReport,
  type RouteAnalyticsSource,
} from './schemas/route-analytics';
import { redactSecrets } from './security';
import type { DecisionDossier, LedgerBundleSummary, LedgerStatusCounts } from './types';

export interface CaptureRouteAnalyticsOptions {
  cwd: string;
  prompt: string;
  source?: RouteAnalyticsSource;
  timestamp?: string;
  analyticsPath?: string;
  dossier?: DecisionDossier;
}

export interface CaptureRouteAnalyticsResult {
  schemaVersion: 'aco.route-analytics-capture.v1';
  analyticsPath: string;
  record: RouteAnalyticsRecordV1;
}

export interface ReadRouteAnalyticsSummaryOptions {
  cwd: string;
  limit?: number;
  analyticsPath?: string;
}

const defaultRecentLimit = 50;
const objectivePreviewMaxLength = 160;

export function getRouteAnalyticsPath(cwd: string): string {
  return join(cwd, '.archon', 'state', 'context-orchestrator', 'route-analytics.jsonl');
}

export async function captureRouteAnalytics(
  options: CaptureRouteAnalyticsOptions
): Promise<CaptureRouteAnalyticsResult> {
  const dossier =
    options.dossier ??
    (await createDecisionDossier({
      cwd: options.cwd,
      prompt: options.prompt,
      timestamp: options.timestamp,
    }));
  const record = buildRouteAnalyticsRecord({
    dossier,
    prompt: options.prompt,
    source: options.source ?? 'cli',
  });
  const analyticsPath = options.analyticsPath ?? getRouteAnalyticsPath(options.cwd);
  await appendRouteAnalyticsRecord(record, analyticsPath);
  return {
    schemaVersion: 'aco.route-analytics-capture.v1',
    analyticsPath,
    record,
  };
}

export function buildRouteAnalyticsRecord(input: {
  dossier: DecisionDossier;
  prompt: string;
  source: RouteAnalyticsSource;
}): RouteAnalyticsRecordV1 {
  const objectivePreview = buildObjectivePreview(input.prompt);
  const record = {
    schemaVersion: ROUTE_ANALYTICS_RECORD_SCHEMA_VERSION,
    recordId: randomUUID(),
    intentHash: hashAnalyticsIntent(input.prompt),
    ...(objectivePreview.length > 0 ? { objectivePreview } : {}),
    commitSha:
      input.dossier.contextIntent.commitSha === 'unknown'
        ? null
        : input.dossier.contextIntent.commitSha,
    routeId: input.dossier.route.id,
    readiness: input.dossier.readiness,
    validationStatus: input.dossier.validationStatus,
    graphStatus: input.dossier.graphStatus,
    nextDecisionKind: input.dossier.nextDecision.kind,
    waiverIds: sortedUnique(input.dossier.waivers.map(waiver => waiver.id)),
    blockerIds: sortedUnique(input.dossier.evidenceBlockers.map(blocker => blocker.id)),
    ledgerCounts: flattenLedgerCounts(input.dossier.ledgerSummary),
    source: input.source,
    timestamp: input.dossier.contextIntent.generatedAt,
  };

  return routeAnalyticsRecordSchema.parse(record);
}

export async function appendRouteAnalyticsRecord(
  record: RouteAnalyticsRecordV1,
  analyticsPath: string
): Promise<void> {
  const parsed = routeAnalyticsRecordSchema.parse(record);
  await mkdir(dirname(analyticsPath), { recursive: true });
  await appendFile(analyticsPath, `${JSON.stringify(parsed)}\n`, 'utf8');
}

export async function readRouteAnalyticsSummary(
  options: ReadRouteAnalyticsSummaryOptions
): Promise<RouteAnalyticsReport> {
  const analyticsPath = options.analyticsPath ?? getRouteAnalyticsPath(options.cwd);
  const limit = normalizeLimit(options.limit);
  const { records, metadata } = await readRouteAnalyticsRecords(analyticsPath);
  const recentRecords = [...records]
    .sort((left, right) => compareRecordRecency(right, left))
    .slice(0, limit);

  return routeAnalyticsReportSchema.parse({
    schemaVersion: ROUTE_ANALYTICS_REPORT_SCHEMA_VERSION,
    metadata,
    aggregates: buildAggregates(records),
    recentRecords,
  });
}

export function renderRouteAnalyticsReportMarkdown(report: RouteAnalyticsReport): string {
  return [
    '# ACO Route Analytics',
    '',
    `Schema: ${report.schemaVersion}`,
    `Records: ${report.aggregates.totalRecords}`,
    `Rows read: ${report.metadata.totalRowsRead}`,
    `Malformed rows: ${report.metadata.malformedRows}`,
    `Approval-required rate: ${formatRate(report.aggregates.approvalRequiredRate)}`,
    '',
    '## Routes',
    '',
    ...renderCounts(report.aggregates.routeCounts),
    '',
    '## Next Decisions',
    '',
    ...renderCounts(report.aggregates.nextDecisionKindCounts),
    '',
    '## Top Waivers',
    '',
    ...renderTopCounts(report.aggregates.topWaivers),
    '',
    '## Top Blockers',
    '',
    ...renderTopCounts(report.aggregates.topBlockers),
    '',
    '## Recent Records',
    '',
    ...renderRecentRecords(report.recentRecords),
    '',
    '## Warnings',
    '',
    ...(report.metadata.warnings.length > 0
      ? report.metadata.warnings.map(warning => `- ${warning}`)
      : ['- none']),
  ].join('\n');
}

export function hashAnalyticsIntent(prompt: string): string {
  return createHash('sha256').update(normalizeAnalyticsPrompt(prompt)).digest('hex');
}

export function normalizeAnalyticsPrompt(prompt: string): string {
  return sanitizeAnalyticsText(prompt).replace(/\s+/g, ' ').trim().toLowerCase();
}

function buildObjectivePreview(prompt: string): string {
  const normalized = sanitizeAnalyticsText(prompt).replace(/\s+/g, ' ').trim();
  return normalized.slice(0, objectivePreviewMaxLength);
}

function sanitizeAnalyticsText(value: string): string {
  return redactSecrets(value)
    .replace(
      /\b(Authorization|Proxy-Authorization)\s*:\s*(?!\[REDACTED\])[^,\n\r]+/gi,
      '$1: [REDACTED]'
    )
    .replace(
      /\b([A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|PWD|API_KEY|ACCESS_KEY|PRIVATE_KEY|CLIENT_SECRET|AUTH_TOKEN)[A-Z0-9_]*)\s*=\s*(?!\[REDACTED\])([^\s'"`]+)/g,
      '$1=[REDACTED]'
    )
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]');
}

async function readRouteAnalyticsRecords(analyticsPath: string): Promise<{
  records: RouteAnalyticsRecordV1[];
  metadata: RouteAnalyticsReport['metadata'];
}> {
  let text: string;
  try {
    text = await readFile(analyticsPath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return {
        records: [],
        metadata: {
          totalRowsRead: 0,
          validRows: 0,
          malformedRows: 0,
          skippedRows: 0,
          warnings: [],
        },
      };
    }
    throw error;
  }

  const records: RouteAnalyticsRecordV1[] = [];
  const warnings: string[] = [];
  let totalRowsRead = 0;
  let malformedRows = 0;

  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (line.trim().length === 0) continue;
    totalRowsRead += 1;
    try {
      const parsed = routeAnalyticsRecordSchema.safeParse(JSON.parse(line));
      if (!parsed.success) {
        malformedRows += 1;
        warnings.push(`Line ${String(index + 1)} skipped: malformed route analytics record.`);
        continue;
      }
      records.push(parsed.data);
    } catch {
      malformedRows += 1;
      warnings.push(`Line ${String(index + 1)} skipped: invalid JSON.`);
    }
  }

  return {
    records,
    metadata: {
      totalRowsRead,
      validRows: records.length,
      malformedRows,
      skippedRows: malformedRows,
      warnings,
    },
  };
}

function buildAggregates(records: RouteAnalyticsRecordV1[]): RouteAnalyticsReport['aggregates'] {
  const routeCounts: Record<string, number> = {};
  const readinessCounts: Record<string, number> = {};
  const validationStatusCounts: Record<string, number> = {};
  const graphStatusCounts: Record<string, number> = {};
  const nextDecisionKindCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  const waiverCounts: Record<string, number> = {};
  const blockerCounts: Record<string, number> = {};

  for (const record of records) {
    increment(routeCounts, record.routeId);
    increment(readinessCounts, record.readiness);
    increment(validationStatusCounts, record.validationStatus);
    increment(graphStatusCounts, record.graphStatus);
    increment(nextDecisionKindCounts, record.nextDecisionKind);
    increment(sourceCounts, record.source);
    for (const waiverId of record.waiverIds) increment(waiverCounts, waiverId);
    for (const blockerId of record.blockerIds) increment(blockerCounts, blockerId);
  }

  const approvalRequired = records.filter(
    record => record.nextDecisionKind === 'approval_required'
  ).length;

  return {
    totalRecords: records.length,
    routeCounts: sortCountRecord(routeCounts),
    readinessCounts: sortCountRecord(readinessCounts),
    validationStatusCounts: sortCountRecord(validationStatusCounts),
    graphStatusCounts: sortCountRecord(graphStatusCounts),
    nextDecisionKindCounts: sortCountRecord(nextDecisionKindCounts),
    sourceCounts: sortCountRecord(sourceCounts),
    topWaivers: toTopCounts(waiverCounts),
    topBlockers: toTopCounts(blockerCounts),
    approvalRequiredRate: records.length > 0 ? approvalRequired / records.length : 0,
  };
}

function flattenLedgerCounts(summary: LedgerBundleSummary): Record<string, number> {
  return {
    ...prefixCounts('toolAvailability', summary.toolAvailability.counts),
    'toolAvailability.total': summary.toolAvailability.total,
    ...prefixCounts('commands', summary.commands.counts),
    'commands.total': summary.commands.total,
    ...prefixCounts('combined', summary.combined.counts),
    'combined.total': summary.combined.total,
  };
}

function prefixCounts(prefix: string, counts: LedgerStatusCounts): Record<string, number> {
  return Object.fromEntries(
    Object.entries(counts).map(([status, count]) => [`${prefix}.${status}`, count])
  );
}

function compareRecordRecency(left: RouteAnalyticsRecordV1, right: RouteAnalyticsRecordV1): number {
  const timestampCompare = left.timestamp.localeCompare(right.timestamp);
  if (timestampCompare !== 0) return timestampCompare;
  return left.recordId.localeCompare(right.recordId);
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return defaultRecentLimit;
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error(
      `Route analytics report limit must be a non-negative integer: ${String(limit)}`
    );
  }
  return limit;
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function sortCountRecord(counts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
  );
}

function toTopCounts(counts: Record<string, number>): { id: string; count: number }[] {
  return Object.entries(counts)
    .map(([id, count]) => ({ id, count }))
    .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id));
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function renderCounts(counts: Record<string, number>): string[] {
  const entries = Object.entries(counts);
  return entries.length > 0
    ? entries.map(([key, count]) => `- ${key}: ${String(count)}`)
    : ['- none'];
}

function renderTopCounts(counts: { id: string; count: number }[]): string[] {
  return counts.length > 0
    ? counts.map(({ id, count }) => `- ${id}: ${String(count)}`)
    : ['- none'];
}

function renderRecentRecords(records: RouteAnalyticsRecordV1[]): string[] {
  return records.length > 0
    ? records.map(
        record =>
          `- ${record.timestamp} ${record.routeId} ${record.readiness} ${record.nextDecisionKind} ${record.recordId}`
      )
    : ['- none'];
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
