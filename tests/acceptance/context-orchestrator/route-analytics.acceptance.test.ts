import { describe, expect, test } from 'bun:test';
import { access, mkdtemp, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import {
  captureRouteAnalytics,
  hashAnalyticsIntent,
  readRouteAnalyticsSummary,
  type DecisionDossier,
} from '@archon/context-orchestrator';

const repoRoot = resolve(import.meta.dir, '../../..');
const objective = 'Implement ACO Route Analytics Ledger V1.';
const timestamp = '2026-05-19T12:00:00.000Z';

describe('ACO route analytics acceptance', () => {
  test('AC-RA-001 existing context read paths do not implicitly capture route analytics', async () => {
    const contextSource = await readFile(
      join(repoRoot, 'packages/cli/src/commands/context.ts'),
      'utf8'
    );
    const statusCommand = extractFunction(contextSource, 'contextStatusCommand');
    const routeCommand = extractFunction(contextSource, 'contextRouteCommand');
    const ledgersCommand = extractFunction(contextSource, 'contextLedgersCommand');

    expect(statusCommand).not.toContain('captureRouteAnalytics');
    expect(routeCommand).not.toContain('captureRouteAnalytics');
    expect(ledgersCommand).not.toContain('captureRouteAnalytics');
    expect(contextSource).toContain('contextAnalyticsCaptureCommand');
  });

  test('AC-RA-002 AC-RA-003 explicit capture appends current route analytics evidence', async () => {
    const analyticsPath = await tempAnalyticsPath();

    const result = await captureRouteAnalytics({
      cwd: repoRoot,
      prompt: objective,
      analyticsPath,
      timestamp,
      dossier: fixtureDossier(),
    });

    expect(result.record.routeId).toBe('brownfield-architecture');
    expect(result.record.readiness).toBe('needs_approval');
    expect(result.record.nextDecisionKind).toBe('approval_required');
    expect(result.record.graphStatus).toBe('forbidden');
    expect(result.record.waiverIds).toEqual(
      expect.arrayContaining([
        'graph-waiver.bmad-plugins-marketplace',
        'graph-waiver.bmad-sample-data',
      ])
    );
    expect((await readFile(analyticsPath, 'utf8')).trim().split('\n')).toHaveLength(1);
  });

  test('AC-RA-004 redacted normalized prompts hash deterministically', () => {
    expect(hashAnalyticsIntent('Route this API_KEY=one')).toBe(
      hashAnalyticsIntent('  route   this api_key=two  ')
    );
  });

  test('AC-RA-005 malformed rows are non-fatal report metadata', async () => {
    const analyticsPath = await tempAnalyticsPath();
    await captureRouteAnalytics({
      cwd: repoRoot,
      prompt: objective,
      analyticsPath,
      timestamp,
      dossier: fixtureDossier(),
    });
    await writeFile(analyticsPath, '{malformed}\n', { flag: 'a' });

    const report = await readRouteAnalyticsSummary({ cwd: repoRoot, analyticsPath });

    expect(report.metadata.validRows).toBe(1);
    expect(report.metadata.malformedRows).toBe(1);
    expect(report.metadata.warnings.length).toBeGreaterThan(0);
  });

  test('AC-RA-006 missing ledger reports empty state without creating a file', async () => {
    const analyticsPath = await tempAnalyticsPath();

    const report = await readRouteAnalyticsSummary({ cwd: repoRoot, analyticsPath });

    expect(report.aggregates.totalRecords).toBe(0);
    expect(report.recentRecords).toEqual([]);
    await expect(access(analyticsPath)).rejects.toThrow();
  });
});

async function tempAnalyticsPath(): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), 'aco-route-analytics-')), 'analytics.jsonl');
}

function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}`);
  const exportStart = source.indexOf(`export async function ${name}`);
  const functionStart = start >= 0 ? start : exportStart;
  expect(functionStart).toBeGreaterThanOrEqual(0);
  const nextExport = source.indexOf('\nexport ', functionStart + 1);
  return source.slice(functionStart, nextExport >= 0 ? nextExport : source.length);
}

function fixtureDossier(): DecisionDossier {
  const counts = {
    available: 0,
    partial: 0,
    blocked: 0,
    deferred: 0,
    forbidden: 0,
    'not used': 0,
    unknown: 0,
  };
  const ledgerSummary = {
    toolAvailability: { total: 20, counts: { ...counts, available: 18, forbidden: 2 } },
    commands: { total: 20, counts: { ...counts, available: 11, deferred: 3, forbidden: 6 } },
    combined: { total: 40, counts: { ...counts, available: 29, deferred: 3, forbidden: 8 } },
  };

  return {
    contextIntent: {
      objective,
      normalizedObjective: objective.toLowerCase(),
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
    ledgerSummary,
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
        ledgerSummary,
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
