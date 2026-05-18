import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import {
  compilePromptPackage,
  getContextOrchestratorLedgers,
  getContextOrchestratorStatus,
} from './index';

const repoRoot = resolve(import.meta.dir, '../../..');

describe('context orchestrator status confidence', () => {
  test('AC-CONFIDENCE-004 status ledgers compile agree on graph and ledger confidence', async () => {
    const prompt = 'implement aco confidence closure';
    const timestamp = '2026-05-18T12:00:00.000Z';
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-status-confidence-'));
    const status = await getContextOrchestratorStatus(repoRoot);
    const ledgers = await getContextOrchestratorLedgers(repoRoot, timestamp);
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
    expect(status.ledgerSchemaVersion).toBe(ledgers.schemaVersion);
    expect(status.ledgerSchemaVersion).toBe(compiled.package.ledgerBundle.schemaVersion);
    expect(status.ledgerSummary).toEqual(ledgers.summary);
    expect(status.ledgerSummary).toEqual(compiled.package.ledgerBundle.summary);
  });
});
