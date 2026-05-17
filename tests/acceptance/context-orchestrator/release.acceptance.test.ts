import { describe, expect, test } from 'bun:test';
import { validateContextOrchestrator } from '@archon/context-orchestrator';

describe('ACO release acceptance', () => {
  test('Spec: 018-release-readiness-spec.md Acceptance: ACO-RELEASE-001 validation reports no MVP blocker', async () => {
    const report = await validateContextOrchestrator({ cwd: process.cwd() });
    expect(report.status).toBe('passed');
    expect(report.checks.every(check => check.status !== 'failed')).toBe(true);
  });
});
