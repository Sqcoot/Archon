import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'fs/promises';
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
    const prompt = 'implement aco confidence closure';
    const timestamp = '2026-05-18T12:00:00.000Z';
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-status-confidence-'));
    const status = await getContextOrchestratorStatus(repoRoot, { objective: prompt, timestamp });
    const ledgers = await getContextOrchestratorLedgers(repoRoot, { objective: prompt, timestamp });
    const compiled = await compilePromptPackage({
      cwd: repoRoot,
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
