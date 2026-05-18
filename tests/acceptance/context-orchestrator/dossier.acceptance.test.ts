import { describe, expect, test } from 'bun:test';
import { createDecisionDossier } from '@archon/context-orchestrator';

describe('ACO decision dossier acceptance', () => {
  test('Spec: 023-decision-dossier-gate-spec.md Acceptance: AC-DOSSIER-001 AC-DOSSIER-005 AC-DOSSIER-006 current repo dossier preserves approval-gated graph waivers', async () => {
    const dossier = await createDecisionDossier({
      cwd: process.cwd(),
      prompt: 'Implement ACO Decision Dossier Gate',
      timestamp: '2026-05-18T12:00:00.000Z',
    });

    expect(dossier.schemaVersion).toBe('aco.decision-dossier.v1');
    expect(dossier.route.id).toBe('brownfield-architecture');
    expect(dossier.validationStatus).toBe('passed');
    expect(dossier.readiness).toBe('needs_approval');
    expect(dossier.graphStatus).toBe('forbidden');
    expect(dossier.approvalRequired).toBe(true);
    expect(dossier.waivers.map(waiver => waiver.id)).toEqual(
      expect.arrayContaining([
        'graph-waiver.bmad-plugins-marketplace',
        'graph-waiver.bmad-sample-data',
      ])
    );
    expect(dossier.approvalCommands.length).toBeGreaterThan(0);
    expect(dossier.approvalCommands.every(command => command.willRun === false)).toBe(true);
    expect(dossier.approvalCommands.every(command => command.requiresApproval === true)).toBe(true);
    expect(dossier.rejectedAlternatives.map(alternative => alternative.id)).toContain(
      'static-handoff-prompt'
    );
  });
});
