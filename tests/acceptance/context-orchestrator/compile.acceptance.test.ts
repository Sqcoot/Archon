import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { compilePromptPackage } from '@archon/context-orchestrator';

describe('ACO compile acceptance', () => {
  test('Spec: 008-prompt-package-spec.md Acceptance: ACO-COMPILE-001 AC-LEDGER-004 package includes traceability and ledger artifacts', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-compile-'));
    const result = await compilePromptPackage({
      cwd: process.cwd(),
      prompt: 'Implement a context orchestrator in Archon with SDD and ATDD.',
      archiveRoot,
      runId: 'aco-test-run',
      timestamp: '2026-05-17T12:00:00.000Z',
      json: true,
    });
    expect(result.package.runId).toBe('aco-test-run');
    expect(result.package.bmadRoute.steps.length).toBeGreaterThan(1);
    expect(result.package.acceptancePlan.scenarios.length).toBeGreaterThan(0);
    expect(result.package.validationReport.status).toBe('passed');
    expect(result.files['codex-prompt.md']).toContain('codex-prompt.md');
    expect(result.files['tool-availability-ledger.json']).toContain(
      'tool-availability-ledger.json'
    );
    expect(result.files['tool-availability-ledger.md']).toContain('tool-availability-ledger.md');
    expect(result.files['commands-ledger.json']).toContain('commands-ledger.json');
    expect(result.files['commands-ledger.md']).toContain('commands-ledger.md');
  });

  test('Spec: 010-codex-readiness-spec.md Acceptance: ACO-CODEX-003 compiled prompts include optional Codex Goal Handoff', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-codex-goal-'));
    const result = await compilePromptPackage({
      cwd: process.cwd(),
      prompt: 'Implement ACO Acceptance Reality Gate with Codex Goal Handoff.',
      archiveRoot,
      runId: 'aco-codex-goal',
      timestamp: '2026-05-18T12:00:00.000Z',
      json: true,
    });

    const codexPrompt = await readFile(result.files['codex-prompt.md'], 'utf8');
    const finalPackage = await readFile(result.files['final-prompt-package.md'], 'utf8');
    const goalCommand =
      '/goal Implement ACO Acceptance Reality Gate: convert selected native-loop acceptance todos to executable checks, add aco-acceptance validation, add ledger evidence, sync traceability, and keep graph waivers visible.';

    expect(codexPrompt).toContain('## Codex Goal Handoff');
    expect(codexPrompt).toContain(goalCommand);
    expect(finalPackage).toContain('## Codex Goal Handoff');
    expect(finalPackage).toContain(goalCommand);
    expect(goalCommand.length).toBeLessThan(4000);
  });
});
