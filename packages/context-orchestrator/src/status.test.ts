import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import {
  compilePromptPackage,
  getContextOrchestratorLedgers,
  getContextOrchestratorReadiness,
  getContextOrchestratorStatus,
} from './index';

const repoRoot = resolve(import.meta.dir, '../../..');

describe('context orchestrator status confidence', () => {
  test('ACO-READINESS-001 readiness contract covers ready, blocked, needs_approval, needs_decision, unknown', () => {
    const passed = { status: 'passed' as const };
    const failed = { status: 'failed' as const };
    const warning = { status: 'warning' as const };
    const available = { status: 'available' as const };
    const forbidden = { status: 'forbidden' as const };

    expect(getContextOrchestratorReadiness(available, passed)).toBe('ready');
    expect(getContextOrchestratorReadiness(available, failed)).toBe('blocked');
    expect(getContextOrchestratorReadiness(forbidden, passed)).toBe('needs_approval');
    expect(
      getContextOrchestratorReadiness(available, passed, [], {
        route: { requiresDecision: true },
      })
    ).toBe('needs_decision');
    expect(getContextOrchestratorReadiness(available, warning)).toBe('unknown');
  });

  test('AC-CONFIDENCE-004 status ledgers compile agree on graph and ledger confidence', async () => {
    const cwd = await writeStatusFixture();
    const prompt = 'implement aco confidence closure';
    const timestamp = '2026-05-18T12:00:00.000Z';
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-status-confidence-'));
    const status = await getContextOrchestratorStatus(cwd, { objective: prompt, timestamp });
    const ledgers = await getContextOrchestratorLedgers(cwd, { objective: prompt, timestamp });
    const compiled = await compilePromptPackage({
      cwd,
      prompt,
      archiveRoot,
      runId: 'aco-status-confidence',
      timestamp,
    });
    const graphEntry = ledgers.toolAvailability.find(entry => entry.id === 'tool.graph-evidence');

    expect(status.graphStatus).toBe(compiled.package.graphContext.status);
    expect(status.graphWaivers).toBe(compiled.package.graphContext.waiverCount);
    expect(status.graphWaiverIds).toEqual(
      compiled.package.graphContext.waivers.map(waiver => waiver.id)
    );
    for (const waiverId of status.graphWaiverIds) {
      expect(graphEntry?.sourceEvidence).toContain(waiverId);
      expect(graphEntry?.notes).toContain(waiverId);
    }
    expect(status.graphStatus).toBe('forbidden');
    expect(graphEntry?.status).toBe('forbidden');
    const waiverBackedRows = [...ledgers.toolAvailability, ...ledgers.commands].filter(entry =>
      status.graphWaiverIds.some(
        waiverId => entry.sourceEvidence.includes(waiverId) || entry.notes.includes(waiverId)
      )
    );
    expect(waiverBackedRows.length).toBeGreaterThan(0);
    for (const entry of waiverBackedRows) {
      expect(entry.status).not.toBe('partial');
    }
    expect(status.ledgerSchemaVersion).toBe(ledgers.schemaVersion);
    expect(status.ledgerSchemaVersion).toBe(compiled.package.ledgerBundle.schemaVersion);
    expect(status.ledgerSummary).toEqual(ledgers.summary);
    expect(status.ledgerSummary).toEqual(compiled.package.ledgerBundle.summary);
    expect(status.nextDecision).toEqual(compiled.package.nextDecision);
    if (status.evidenceBlockers.length > 0) {
      expect(status.nextDecision.kind).toBe('blocked_by_evidence');
      expect(status.nextDecision.evidenceBlockerIds).toEqual(
        status.evidenceBlockers.map(blocker => blocker.id).sort()
      );
    } else {
      expect(status.nextDecision.kind).toBe('approval_required');
    }
  });

  test('AC-ACO-BLOCKER-001 status and compile expose matching evidence resolution', async () => {
    const prompt = 'Use Hono for an ACO API route.';
    const timestamp = '2026-05-18T12:00:00.000Z';
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-status-resolution-'));
    const status = await getContextOrchestratorStatus(repoRoot, { objective: prompt, timestamp });
    const compiled = await compilePromptPackage({
      cwd: repoRoot,
      prompt,
      archiveRoot,
      runId: 'aco-status-resolution',
      timestamp,
    });

    expect(status.evidenceResolution.required).toBe(true);
    expect(compiled.package.evidenceResolution).toEqual(status.evidenceResolution);
    expect(compiled.package.nextDecision).toEqual(status.nextDecision);
    expect(
      status.evidenceResolution.items.some(
        item => item.evidenceId === 'tool.docs-evidence' && item.targetName === 'Hono'
      )
    ).toBe(true);
  });
});

async function writeStatusFixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'aco-status-cwd-'));
  await mkdir(join(cwd, 'docs/context-orchestrator/specs'), { recursive: true });
  await mkdir(join(cwd, 'docs/context-orchestrator/research'), { recursive: true });
  await mkdir(join(cwd, 'tests/acceptance/context-orchestrator'), { recursive: true });

  await writeFile(join(cwd, 'docs/context-orchestrator/specs/000-product-charter.md'), '# ACO\n');
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
            error: 'Graph evidence unavailable in fixture.',
          },
        ],
      },
      null,
      2
    )}\n`
  );
  await writeFile(
    join(cwd, 'package.json'),
    `${JSON.stringify({
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
    })}\n`
  );

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

async function writeAcceptanceSurface(cwd: string, file: string, marker: string): Promise<void> {
  await writeFile(
    join(cwd, 'tests/acceptance/context-orchestrator', file),
    `import { test } from 'bun:test';\ntest('${marker} fixture', () => {});\n`
  );
}
