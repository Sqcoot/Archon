import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdir, mkdtemp, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { compilePromptPackage } from '@archon/context-orchestrator';
import {
  contextAnalyticsCaptureCommand,
  contextAnalyticsReportCommand,
  contextApprovalCapsuleCommand,
  contextApprovalCapsuleVerifyCommand,
  contextCompileCommand,
  contextDossierCommand,
  contextGraphWaiversCommand,
  contextLedgersCommand,
  contextRouteCommand,
  contextStatusCommand,
  contextValidateCommand,
} from './context';

const repoRoot = resolve(import.meta.dir, '../../../..');

describe('context commands', () => {
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
  });

  it('AC-LEDGER-005 emits combined ledger bundle JSON', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    const exitCode = await contextLedgersCommand({ cwd: repoRoot, json: true });

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    const output = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as {
      schemaVersion?: string;
      toolAvailability?: unknown[];
      commands?: unknown[];
      summary?: unknown;
    };
    expect(parsed.schemaVersion).toBe('aco.ledger-bundle.v1');
    expect(parsed.toolAvailability?.length).toBeGreaterThan(0);
    expect(parsed.commands?.length).toBeGreaterThan(0);
    expect(parsed.summary).toBeDefined();
  });

  it('renders ledger Markdown by default', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    const exitCode = await contextLedgersCommand({ cwd: repoRoot });

    expect(exitCode).toBe(0);
    const output = logSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('# Tool Availability Ledger');
    expect(output).toContain('# Commands Ledger');
  });

  it('AC-CONFIDENCE-004 includes ledger confidence fields in status JSON', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});

    await contextStatusCommand({ cwd: repoRoot, json: true });

    const output = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as {
      graphStatus?: string;
      graphWaivers?: number;
      graphWaiverIds?: string[];
      ledgerSchemaVersion?: string;
      ledgerSummary?: unknown;
    };
    expect(parsed.graphStatus).toBeDefined();
    expect(typeof parsed.graphWaivers).toBe('number');
    expect(Array.isArray(parsed.graphWaiverIds)).toBe(true);
    expect(parsed.ledgerSchemaVersion).toBe('aco.ledger-bundle.v1');
    expect(parsed.ledgerSummary).toBeDefined();
  });

  it('AC-GWCL-005 emits graph waiver closure JSON with approval-required recommendations', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    const cwd = await writeAcoGraphFixture();

    const exitCode = await contextGraphWaiversCommand({ cwd, json: true });

    expect(exitCode).toBe(0);
    const output = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as {
      schemaVersion?: string;
      diagnostics?: Array<{
        approvalStatus?: string;
        recommendedCommands?: Array<{ requiresApproval?: boolean; willRun?: boolean }>;
      }>;
    };
    expect(parsed.schemaVersion).toBe('aco.graph-waiver-closure.v1');
    expect(parsed.diagnostics?.length).toBeGreaterThan(0);
    for (const diagnostic of parsed.diagnostics ?? []) {
      expect(diagnostic.approvalStatus).toBe('approval_required');
      expect(diagnostic.recommendedCommands?.every(command => command.willRun === false)).toBe(
        true
      );
      expect(
        diagnostic.recommendedCommands?.every(command => command.requiresApproval === true)
      ).toBe(true);
    }
  });

  it('AC-DOSSIER-003 emits decision dossier JSON', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    const cwd = await writeAcoGraphFixture();

    const exitCode = await contextDossierCommand('Implement ACO Decision Dossier Gate', {
      cwd,
      json: true,
      timestamp: '2026-05-18T12:00:00.000Z',
    });

    expect(exitCode).toBe(0);
    const output = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as {
      schemaVersion?: string;
      route?: { id?: string };
      readiness?: string;
      graphStatus?: string;
      approvalRequired?: boolean;
      waivers?: Array<{ id?: string }>;
    };
    expect(parsed.schemaVersion).toBe('aco.decision-dossier.v1');
    expect(parsed.route?.id).toBe('brownfield-architecture');
    expect(parsed.readiness).toBe('needs_approval');
    expect(parsed.graphStatus).toBe('forbidden');
    expect(parsed.approvalRequired).toBe(true);
    expect(parsed.waivers?.map(waiver => waiver.id)).toEqual(['graph-waiver.sample-upstream']);
  });

  it('AC-DOSSIER-003 renders decision dossier Markdown by default', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    const cwd = await writeAcoGraphFixture();

    const exitCode = await contextDossierCommand('Implement ACO Decision Dossier Gate', {
      cwd,
      timestamp: '2026-05-18T12:00:00.000Z',
    });

    expect(exitCode).toBe(0);
    const output = logSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('# ACO Decision Dossier');
    expect(output).toContain('Route: brownfield-architecture');
    expect(output).toContain('Readiness: needs_approval');
    expect(output).toContain('Graph: forbidden');
  });

  it('ACO-APPROVAL-002 contextApprovalCapsuleCommand emits approval capsule JSON without artifact writes', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    const cwd = await writeAcoGraphFixture();

    const exitCode = await contextApprovalCapsuleCommand('Implement ACO Approval Capsule', {
      cwd,
      json: true,
      runId: 'aco-cli-approval-readonly',
      timestamp: '2026-05-18T12:00:00.000Z',
    });

    expect(exitCode).toBe(0);
    const output = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as {
      schemaVersion?: string;
      runId?: string;
      graphStatus?: string;
      approvalCommands?: Array<{ willRun?: boolean }>;
    };
    expect(parsed.schemaVersion).toBe('aco.approval-capsule.v1');
    expect(parsed.runId).toBe('aco-cli-approval-readonly');
    expect(parsed.graphStatus).toBe('forbidden');
    expect(parsed.approvalCommands?.every(command => command.willRun === false)).toBe(true);
  });

  it('ACO-APPROVAL-002 renders approval capsule Markdown by default', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    const cwd = await writeAcoGraphFixture();

    const exitCode = await contextApprovalCapsuleCommand('Implement ACO Approval Capsule', {
      cwd,
      runId: 'aco-cli-approval-markdown',
      timestamp: '2026-05-18T12:00:00.000Z',
    });

    expect(exitCode).toBe(0);
    const output = logSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('# ACO Approval Capsule');
    expect(output).toContain('Readiness: needs_approval');
    expect(output).toContain('Graph: forbidden');
  });

  it('ACO-APPROVAL-003 writes approval capsule artifacts when artifact root is provided', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    const cwd = await writeAcoGraphFixture();
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-cli-approval-'));
    await compilePromptPackage({
      cwd,
      prompt: 'Implement ACO Approval Capsule',
      archiveRoot,
      runId: 'aco-cli-approval-write',
      timestamp: '2026-05-18T12:00:00.000Z',
    });

    const exitCode = await contextApprovalCapsuleCommand('Implement ACO Approval Capsule', {
      cwd,
      json: true,
      artifactRoot: archiveRoot,
      runId: 'aco-cli-approval-write',
      timestamp: '2026-05-18T12:00:00.000Z',
    });

    expect(exitCode).toBe(0);
    const output = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as { files?: { json?: string; markdown?: string } };
    expect(parsed.files?.json).toBe(
      join(archiveRoot, 'aco-cli-approval-write', 'approval-capsule.json')
    );
    expect(parsed.files?.markdown).toBe(
      join(archiveRoot, 'aco-cli-approval-write', 'approval-capsule.md')
    );
    expect(await readFile(parsed.files?.json ?? '', 'utf8')).toContain('"aco.approval-capsule.v1"');
  });

  it('ACO-APPROVAL-011 verifies approval capsule contract read-only', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    const cwd = await writeAcoGraphFixture();
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-cli-approval-verify-'));
    await compilePromptPackage({
      cwd,
      prompt: 'Implement ACO Approval Capsule',
      archiveRoot,
      runId: 'aco-cli-approval-verify',
      timestamp: '2026-05-18T12:00:00.000Z',
    });
    await contextApprovalCapsuleCommand('Implement ACO Approval Capsule', {
      cwd,
      json: true,
      artifactRoot: archiveRoot,
      runId: 'aco-cli-approval-verify',
      timestamp: '2026-05-18T12:00:00.000Z',
    });
    logSpy.mockClear();

    const exitCode = await contextApprovalCapsuleVerifyCommand({
      cwd,
      json: true,
      artifactRoot: archiveRoot,
      runId: 'aco-cli-approval-verify',
    });

    expect(exitCode).toBe(0);
    const output = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as {
      schemaVersion?: string;
      status?: string;
      willRun?: boolean;
      contractId?: string;
    };
    expect(parsed.schemaVersion).toBe('aco.approval-contract-verification.v1');
    expect(parsed.status).toBe('valid');
    expect(parsed.willRun).toBe(false);
    expect(parsed.contractId).toContain('aco.approval-contract.v1:');
  });

  it('AC-LEDGER-007 keeps existing context command exports available', () => {
    expect(contextAnalyticsCaptureCommand).toBeFunction();
    expect(contextAnalyticsReportCommand).toBeFunction();
    expect(contextRouteCommand).toBeFunction();
    expect(contextStatusCommand).toBeFunction();
    expect(contextValidateCommand).toBeFunction();
    expect(contextCompileCommand).toBeFunction();
    expect(contextDossierCommand).toBeFunction();
    expect(contextApprovalCapsuleCommand).toBeFunction();
    expect(contextApprovalCapsuleVerifyCommand).toBeFunction();
    expect(contextLedgersCommand).toBeFunction();
    expect(contextGraphWaiversCommand).toBeFunction();
  });

  it('AC-RA-002 captures route analytics JSON through explicit command', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    const analyticsPath = join(
      await mkdtemp(join(tmpdir(), 'aco-cli-route-analytics-')),
      'a.jsonl'
    );

    const exitCode = await contextAnalyticsCaptureCommand('Implement route analytics.', {
      cwd: repoRoot,
      json: true,
      analyticsPath,
      timestamp: '2026-05-19T12:00:00.000Z',
    });

    expect(exitCode).toBe(0);
    const output = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as {
      schemaVersion?: string;
      analyticsPath?: string;
      record?: { routeId?: string; nextDecisionKind?: string };
    };
    expect(parsed.schemaVersion).toBe('aco.route-analytics-capture.v1');
    expect(parsed.analyticsPath).toBe(analyticsPath);
    expect(parsed.record?.routeId).toBe('brownfield-architecture');
    expect(parsed.record?.nextDecisionKind).toBeDefined();
    expect(await readFile(analyticsPath, 'utf8')).toContain('aco.route-analytics.v1');
  });

  it('AC-RA-006 reports route analytics JSON without requiring an existing ledger', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    const analyticsPath = join(
      await mkdtemp(join(tmpdir(), 'aco-cli-route-analytics-')),
      'missing.jsonl'
    );

    const exitCode = await contextAnalyticsReportCommand({
      cwd: repoRoot,
      json: true,
      analyticsPath,
      limit: 1,
    });

    expect(exitCode).toBe(0);
    const output = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as {
      schemaVersion?: string;
      aggregates?: { totalRecords?: number };
      recentRecords?: unknown[];
    };
    expect(parsed.schemaVersion).toBe('aco.route-analytics-report.v1');
    expect(parsed.aggregates?.totalRecords).toBe(0);
    expect(parsed.recentRecords).toEqual([]);
  });
});

async function writeAcoGraphFixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'aco-cli-graph-'));

  await mkdir(join(cwd, 'docs/context-orchestrator/specs'), { recursive: true });
  await mkdir(join(cwd, 'docs/context-orchestrator/research'), { recursive: true });
  await mkdir(join(cwd, 'tests/acceptance/context-orchestrator'), { recursive: true });

  await writeFile(join(cwd, 'docs/context-orchestrator/specs/000-product-charter.md'), '# ACO\n');
  await writeGraphManifest(cwd);
  await writeGraphEvidenceIndex(cwd);
  await writeGraphWaivers(cwd);
  await writePackageJson(cwd);

  await writeAcceptanceSurface(cwd, 'api.acceptance.test.ts', 'AC-P1-API');
  await writeAcceptanceSurface(cwd, 'command.acceptance.test.ts', 'AC-P1-SLASH');
  await writeAcceptanceSurface(cwd, 'workflow.acceptance.test.ts', 'AC-P3-WF');
  await writeAcceptanceSurface(cwd, 'events.acceptance.test.ts', 'ACO-EVENTS-001');
  await writeAcceptanceSurface(
    cwd,
    'traceability.acceptance.test.ts',
    'ACO-TRACE-001 ACO-TRACE-002 ACO-TRACE-003'
  );

  return cwd;
}

async function writeGraphManifest(cwd: string): Promise<void> {
  await writeFile(
    join(cwd, 'docs/context-orchestrator/research/upstream-manifest.json'),
    `${JSON.stringify(
      {
        repositories: [
          {
            name: 'sample-upstream',
            localPath: 'research/upstreams/sample-upstream',
            cloneStatus: 'fetched',
            graphStatus: 'failed',
            waiverRequired: true,
            error: 'Graphify completed but graphify-out/graph.json was not found.',
          },
        ],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

async function writeGraphEvidenceIndex(cwd: string): Promise<void> {
  await writeFile(
    join(cwd, 'docs/context-orchestrator/research/graph-evidence-index.md'),
    [
      '# Graph Evidence Index',
      '',
      '| Repository | Graph status | Clone status | Branch | Commit | Nodes | Edges | Waiver required | Graph |',
      '| --- | --- | --- | --- | --- | ---: | ---: | --- | --- |',
      '| sample-upstream | failed | fetched | main | abc123 | 0 | 0 | yes | research/graphs/sample-upstream/graph.json |',
      '',
    ].join('\n'),
    'utf8'
  );
}

async function writeGraphWaivers(cwd: string): Promise<void> {
  await writeFile(
    join(cwd, 'docs/context-orchestrator/research/waivers.md'),
    [
      '# Research Waivers',
      '',
      '## sample-upstream',
      '',
      'Status: failed',
      '',
      'Owner: STAB-002 CLI fixture',
      '',
      'Graph path: research/graphs/sample-upstream/graph.json',
      '',
    ].join('\n'),
    'utf8'
  );
}

async function writePackageJson(cwd: string): Promise<void> {
  await writeFile(
    join(cwd, 'package.json'),
    `${JSON.stringify(
      {
        scripts: {
          'research:bootstrap': 'bun --version',
          'research:update-upstreams': 'bun --version',
          'research:graph': 'bun --version',
          'research:merge-graphs': 'bun --version',
          'research:validate-corpus': 'bun --version',
          'aco:context-intake': 'bun --version',
          'aco:completion-preconditions': 'bun --version',
          'aco:target-intent': 'bun --version',
          'aco:goal-bound-evidence': 'bun --version',
          'aco:gates:test': 'bun --version',
          'aco:policy:test': 'bun --version',
          'aco:policy:fixtures': 'bun --version',
          'aco:policy': 'bun --version',
          'aco:traceability': 'bun --version',
          'aco:test:acceptance': 'bun --version',
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

async function writeAcceptanceSurface(cwd: string, file: string, marker: string): Promise<void> {
  await writeFile(
    join(cwd, 'tests/acceptance/context-orchestrator', file),
    `import { test } from 'bun:test';\ntest('${marker} fixture', () => {});\n`,
    'utf8'
  );
}
