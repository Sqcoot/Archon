import { describe, expect, test } from 'bun:test';
import { getGraphContext } from '@archon/context-orchestrator';

describe('ACO graph acceptance', () => {
  test('Spec: 004-graph-context-spec.md Acceptance: ACO-GRAPH-001 AC-CONFIDENCE-003 AC-FORBIDDEN-GRAPH-001 graph context includes complete repos and named forbidden waivers', async () => {
    const context = await getGraphContext({ cwd: process.cwd() });
    expect(context.status).toBe('forbidden');
    expect(context.repositories.length).toBeGreaterThanOrEqual(13);
    expect(
      context.repositories.some(repo => repo.name === 'codex' && repo.graphStatus === 'complete')
    ).toBe(true);
    expect(
      context.repositories.some(repo => repo.graphStatus === 'failed' && repo.waiverRequired)
    ).toBe(true);
    expect(context.waivers.length).toBe(context.waiverCount);
    for (const waiver of context.waivers) {
      expect(waiver.id.startsWith('graph-waiver.')).toBe(true);
      expect(waiver.owner).toBe('context-orchestrator');
      expect(waiver.reason.length).toBeGreaterThan(0);
      expect(waiver.evidence).toContain('upstream-manifest.json');
      expect(waiver.expiryCondition.length).toBeGreaterThan(0);
    }
  });
});
