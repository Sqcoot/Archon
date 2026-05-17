import { describe, expect, test } from 'bun:test';
import { getGraphContext } from '@archon/context-orchestrator';

describe('ACO graph acceptance', () => {
  test('Spec: 004-graph-context-spec.md Acceptance: ACO-GRAPH-001 graph context includes complete and waived repos', async () => {
    const context = await getGraphContext({ cwd: process.cwd() });
    expect(context.repositories.length).toBeGreaterThanOrEqual(13);
    expect(
      context.repositories.some(repo => repo.name === 'codex' && repo.graphStatus === 'complete')
    ).toBe(true);
    expect(
      context.repositories.some(repo => repo.graphStatus === 'failed' && repo.waiverRequired)
    ).toBe(true);
  });
});
