import { randomUUID } from 'crypto';
import { access, mkdtemp, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, test } from 'bun:test';
import {
  appendRouteAnalyticsRecord,
  captureRouteAnalytics,
  hashAnalyticsIntent,
  readRouteAnalyticsSummary,
  type DecisionDossier,
  type RouteAnalyticsRecordV1,
} from './index';

const repoRoot = resolve(import.meta.dir, '../../..');
const timestamp = '2026-05-19T12:00:00.000Z';

describe('ACO route analytics', () => {
  test('AC-RA-002 appends one JSONL record and creates parent directory', async () => {
    const analyticsPath = await tempAnalyticsPath();

    await appendRouteAnalyticsRecord(sampleRecord({ routeId: 'quick-contained' }), analyticsPath);

    const text = await readFile(analyticsPath, 'utf8');
    const lines = text.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      schemaVersion: 'aco.route-analytics.v1',
      routeId: 'quick-contained',
    });
  });

  test('writer appends without overwriting existing records', async () => {
    const analyticsPath = await tempAnalyticsPath();

    await appendRouteAnalyticsRecord(sampleRecord({ routeId: 'quick-contained' }), analyticsPath);
    await appendRouteAnalyticsRecord(
      sampleRecord({ routeId: 'brownfield-architecture' }),
      analyticsPath
    );

    const lines = (await readFile(analyticsPath, 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] ?? '{}').routeId).toBe('quick-contained');
    expect(JSON.parse(lines[1] ?? '{}').routeId).toBe('brownfield-architecture');
  });

  test('AC-RA-003 capture records current ACO route readiness decision and graph waivers', async () => {
    const analyticsPath = await tempAnalyticsPath();

    const result = await captureRouteAnalytics({
      cwd: repoRoot,
      prompt: 'Implement ACO Route Analytics Ledger V1.',
      analyticsPath,
      timestamp,
      dossier: fixtureDossier(),
    });

    expect(result.record.routeId).toBe('brownfield-architecture');
    expect(result.record.readiness).toBe('needs_approval');
    expect(result.record.graphStatus).toBe('forbidden');
    expect(result.record.nextDecisionKind).toBe('approval_required');
    expect(result.record.waiverIds).toEqual(
      expect.arrayContaining([
        'graph-waiver.bmad-plugins-marketplace',
        'graph-waiver.bmad-sample-data',
      ])
    );
  });

  test('AC-RA-004 hashes redacted normalized prompt text deterministically', () => {
    const first = hashAnalyticsIntent(
      '  Use Hono with API_KEY=first-secret and contact me@example.com  '
    );
    const second = hashAnalyticsIntent(
      'use   hono with api_key=second-secret and contact other@example.com'
    );

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  test('redacts preview secrets email addresses auth headers and credential URLs', async () => {
    const analyticsPath = await tempAnalyticsPath();
    const result = await captureRouteAnalytics({
      cwd: repoRoot,
      analyticsPath,
      timestamp,
      dossier: fixtureDossier(),
      prompt:
        'Use Hono with Authorization: Bearer abcdefghijklmnopqrstuvwxyz, user@example.com, https://user:pass@example.test, API_KEY=secret-value',
    });

    expect(result.record.objectivePreview).not.toContain('abcdefghijklmnopqrstuvwxyz');
    expect(result.record.objectivePreview).not.toContain('user@example.com');
    expect(result.record.objectivePreview).not.toContain('user:pass');
    expect(result.record.objectivePreview).not.toContain('secret-value');
  });

  test('AC-RA-005 skips malformed rows and reports warning metadata', async () => {
    const analyticsPath = await tempAnalyticsPath();
    await appendRouteAnalyticsRecord(sampleRecord({ routeId: 'quick-contained' }), analyticsPath);
    await writeFile(analyticsPath, '{not-json}\n', { flag: 'a' });
    await writeFile(
      analyticsPath,
      `${JSON.stringify({ schemaVersion: 'aco.route-analytics.v1' })}\n`,
      { flag: 'a' }
    );

    const report = await readRouteAnalyticsSummary({ cwd: repoRoot, analyticsPath });

    expect(report.metadata.totalRowsRead).toBe(3);
    expect(report.metadata.validRows).toBe(1);
    expect(report.metadata.malformedRows).toBe(2);
    expect(report.metadata.skippedRows).toBe(2);
    expect(report.metadata.warnings).toHaveLength(2);
  });

  test('AC-RA-006 missing ledger reports zero aggregates and does not create a file', async () => {
    const analyticsPath = await tempAnalyticsPath();

    const report = await readRouteAnalyticsSummary({ cwd: repoRoot, analyticsPath });

    expect(report.aggregates.totalRecords).toBe(0);
    expect(report.recentRecords).toEqual([]);
    expect(report.metadata.totalRowsRead).toBe(0);
    await expect(access(analyticsPath)).rejects.toThrow();
  });

  test('report limit affects recent records but not all-time aggregates', async () => {
    const analyticsPath = await tempAnalyticsPath();
    await appendRouteAnalyticsRecord(
      sampleRecord({
        routeId: 'quick-contained',
        timestamp: '2026-05-19T12:00:00.000Z',
      }),
      analyticsPath
    );
    await appendRouteAnalyticsRecord(
      sampleRecord({
        routeId: 'brownfield-architecture',
        timestamp: '2026-05-19T13:00:00.000Z',
      }),
      analyticsPath
    );

    const limitZero = await readRouteAnalyticsSummary({ cwd: repoRoot, analyticsPath, limit: 0 });
    const limitOne = await readRouteAnalyticsSummary({ cwd: repoRoot, analyticsPath, limit: 1 });
    const defaultLimit = await readRouteAnalyticsSummary({ cwd: repoRoot, analyticsPath });

    expect(limitZero.aggregates.totalRecords).toBe(2);
    expect(limitZero.recentRecords).toHaveLength(0);
    expect(limitOne.aggregates.totalRecords).toBe(2);
    expect(limitOne.recentRecords).toHaveLength(1);
    expect(limitOne.recentRecords[0]?.routeId).toBe('brownfield-architecture');
    expect(defaultLimit.recentRecords).toHaveLength(2);
  });

  test('invalid records fail schema validation before writing', async () => {
    const analyticsPath = await tempAnalyticsPath();

    await expect(
      appendRouteAnalyticsRecord(
        { ...sampleRecord({}), schemaVersion: 'bad' } as unknown as RouteAnalyticsRecordV1,
        analyticsPath
      )
    ).rejects.toThrow();
    await expect(access(analyticsPath)).rejects.toThrow();
  });
});

async function tempAnalyticsPath(): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), 'aco-route-analytics-')), 'state', 'analytics.jsonl');
}

function sampleRecord(overrides: Partial<RouteAnalyticsRecordV1>): RouteAnalyticsRecordV1 {
  return {
    schemaVersion: 'aco.route-analytics.v1',
    recordId: randomUUID(),
    intentHash: 'a'.repeat(64),
    objectivePreview: 'Implement route analytics.',
    commitSha: 'abc123',
    routeId: 'brownfield-architecture',
    readiness: 'needs_approval',
    validationStatus: 'passed',
    graphStatus: 'forbidden',
    nextDecisionKind: 'approval_required',
    waiverIds: ['graph-waiver.bmad-sample-data'],
    blockerIds: [],
    ledgerCounts: {
      'combined.total': 40,
      'combined.available': 29,
    },
    source: 'cli',
    timestamp,
    ...overrides,
  };
}

function fixtureDossier(): DecisionDossier {
  return {
    contextIntent: {
      objective: 'Implement ACO Route Analytics Ledger V1.',
      normalizedObjective: 'implement aco route analytics ledger v1.',
      intentHash: 'intent-route-analytics',
      cwd: repoRoot,
      commitSha: 'abc123',
      generatedAt: timestamp,
    },
    route: {
      id: 'brownfield-architecture',
      label: 'Brownfield architecture-sensitive route',
      steps: ['bmad-prd', 'bmad-create-architecture'],
      rationale: 'Architecture-sensitive request.',
    },
    readiness: 'needs_approval',
    validationStatus: 'passed',
    graphStatus: 'forbidden',
    waivers: [
      {
        id: 'graph-waiver.bmad-plugins-marketplace',
        repository: 'bmad-plugins-marketplace',
        owner: 'context-orchestrator',
        reason: 'Graph failed.',
        evidence: 'upstream-manifest.json',
        expiryCondition: 'Regenerate graph evidence.',
      },
      {
        id: 'graph-waiver.bmad-sample-data',
        repository: 'bmad-sample-data',
        owner: 'context-orchestrator',
        reason: 'Graph failed.',
        evidence: 'upstream-manifest.json',
        expiryCondition: 'Regenerate graph evidence.',
      },
    ],
    evidenceBlockers: [],
    ledgerSummary: {
      toolAvailability: {
        total: 20,
        counts: zeroCounts({ available: 18, forbidden: 2 }),
      },
      commands: {
        total: 20,
        counts: zeroCounts({ available: 11, deferred: 3, forbidden: 6 }),
      },
      combined: {
        total: 40,
        counts: zeroCounts({ available: 29, deferred: 3, forbidden: 8 }),
      },
    },
    nextDecision: {
      schemaVersion: 'aco.next-decision.v1',
      kind: 'approval_required',
      title: 'Approval required',
      summary: 'Implementation may proceed only if current graph waivers are explicit.',
      primaryAction: {
        id: 'next.approve-current-graph-waivers',
        kind: 'approval',
        label: 'Approve preserving current graph waivers',
        requiresApproval: true,
        willRun: false,
        successEvidence: ['User explicitly approves preserving listed graph waivers.'],
      },
      secondaryActions: [],
      decisionFactors: [],
      evidenceSummary: {
        readiness: 'needs_approval',
        validationStatus: 'passed',
        graphStatus: 'forbidden',
        graphWaivers: 2,
        evidenceBlockers: 0,
        evidenceResolutionRequired: true,
        ledgerSummary: {
          toolAvailability: {
            total: 20,
            counts: zeroCounts({ available: 18, forbidden: 2 }),
          },
          commands: {
            total: 20,
            counts: zeroCounts({ available: 11, deferred: 3, forbidden: 6 }),
          },
          combined: {
            total: 40,
            counts: zeroCounts({ available: 29, deferred: 3, forbidden: 8 }),
          },
        },
      },
      waiverIds: ['graph-waiver.bmad-plugins-marketplace', 'graph-waiver.bmad-sample-data'],
      evidenceBlockerIds: [],
      evidenceResolutionIds: [
        'graph-waiver.bmad-plugins-marketplace',
        'graph-waiver.bmad-sample-data',
      ],
      nextPrompt: 'Request explicit approval to preserve graph waivers.',
    },
  } as DecisionDossier;
}

function zeroCounts(overrides: Partial<RouteAnalyticsRecordV1['ledgerCounts']>): {
  available: number;
  partial: number;
  blocked: number;
  deferred: number;
  forbidden: number;
  'not used': number;
  unknown: number;
} {
  return {
    available: 0,
    partial: 0,
    blocked: 0,
    deferred: 0,
    forbidden: 0,
    'not used': 0,
    unknown: 0,
    ...overrides,
  };
}
