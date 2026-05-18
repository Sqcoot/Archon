import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import {
  compilePromptPackage,
  getContextOrchestratorLedgers,
  getContextOrchestratorStatus,
} from '@archon/context-orchestrator';

const repoRoot = resolve(import.meta.dir, '../../..');
const objective =
  'Implement Goal-Bound Evidence Gate for ACO: bind readiness to explicit user intent and verified evidence provenance.';
const timestamp = '2026-05-18T12:00:00.000Z';

describe('Goal-Bound Evidence Gate acceptance', () => {
  test('AC-ACO-INTENT-001 status ledgers and compile share caller intent', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-goal-bound-'));
    const status = await getContextOrchestratorStatus(repoRoot, { objective, timestamp });
    const ledgers = await getContextOrchestratorLedgers(repoRoot, { objective, timestamp });
    const compiled = await compilePromptPackage({
      cwd: repoRoot,
      prompt: objective,
      archiveRoot,
      runId: 'aco-goal-bound-intent',
      timestamp,
    });

    expect(status.contextIntent.normalizedObjective).toBe(
      compiled.package.contextIntent.normalizedObjective
    );
    expect(ledgers.contextIntent.intentHash).toBe(compiled.package.contextIntent.intentHash);
    expect(status.contextIntent.normalizedObjective).not.toBe('implement aco confidence closure');
  });

  test('AC-ACO-EVIDENCE-001 ledger rows serialize provenance and freshness', async () => {
    const ledgers = await getContextOrchestratorLedgers(repoRoot, { objective, timestamp });
    const routeRow = ledgers.toolAvailability.find(entry => entry.id === 'tool.aco-route');

    expect(routeRow?.lastVerifiedAt).toBe(timestamp);
    expect(routeRow?.verificationSource).toContain('routeBmad');
    expect(routeRow?.verificationMethod).toBe('command');
    expect(routeRow?.sourceArtifact).toBe('bun run cli context route --cwd . "<prompt>"');
    expect(routeRow?.nextVerificationAction).toContain('Re-run');
    expect(routeRow?.freshness).toBe('fresh');
  });

  test('AC-ACO-BLOCKER-001 unresolved required docs evidence names exact row and next action', async () => {
    const identifyObjective = 'Use Hono for an ACO API route.';
    const status = await getContextOrchestratorStatus(repoRoot, {
      objective: identifyObjective,
      timestamp,
    });

    expect(status.evidenceBlockers.some(blocker => blocker.id === 'tool.docs-evidence')).toBe(true);
    expect(status.evidenceResolution.items.some(item => item.targetName === 'Hono')).toBe(true);
    expect(status.evidenceResolution.items.some(item => item.resolver === 'context7')).toBe(true);
    expect(
      status.evidenceBlockers.some(blocker =>
        blocker.nextVerificationAction.includes('Resolve docs')
      )
    ).toBe(true);
  });

  test('AC-ACO-WAIVER-001 forbidden graph waivers remain approval-gated under intent binding', async () => {
    const status = await getContextOrchestratorStatus(repoRoot, { objective, timestamp });

    expect(status.readiness).toBe('needs_approval');
    expect(status.graphStatus).toBe('forbidden');
    expect(status.graphWaiverIds).toContain('graph-waiver.bmad-plugins-marketplace');
    expect(status.graphWaiverIds).toContain('graph-waiver.bmad-sample-data');
  });
});
