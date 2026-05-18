import { describe, expect, test } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';

interface WorkflowValidationReport {
  results: Array<{ workflowName: string; valid: boolean; issues: unknown[] }>;
  summary: { total: number; valid: number; errors: number; warnings: number };
}

describe('ACO workflow acceptance', () => {
  test('Spec: 014-workflow-contracts.md Acceptance: AC-P3-WF context-orchestrate workflow validates before use', async () => {
    const workflowSource = await readFile(
      join(process.cwd(), '.archon/workflows/defaults/context-orchestrate.yaml'),
      'utf8'
    );

    for (const evidence of [
      'name: context-orchestrate',
      'bun run cli context status --cwd "$PWD" --json "$ARGUMENTS"',
      'bun run cli context ledgers --cwd "$PWD" --json "$ARGUMENTS"',
      'bun run cli context compile',
      '--archive-root "$ARTIFACTS_DIR/context-orchestrator"',
      'graph-validation-gate',
      'graph-validation-gate.txt',
      'approval-capsule',
      'context approval-capsule',
      'approval-capsule.md',
      'Intent:',
      'Evidence blockers:',
      'approval:',
      'final-summary',
    ]) {
      expect(workflowSource).toContain(evidence);
    }

    const report = await validateContextWorkflow();
    const contextOrchestrate = report.results.find(
      result => result.workflowName === 'context-orchestrate'
    );
    expect(report.summary).toMatchObject({ total: 1, valid: 1, errors: 0, warnings: 0 });
    expect(contextOrchestrate?.valid).toBe(true);
    expect(contextOrchestrate?.issues).toEqual([]);
  });
});

async function validateContextWorkflow(): Promise<WorkflowValidationReport> {
  const proc = Bun.spawn(
    ['bun', 'run', 'cli', 'validate', 'workflows', 'context-orchestrate', '--json'],
    {
      cwd: process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    }
  );
  const [stdout, , exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  expect(exitCode).toBe(0);
  const jsonLine = stdout
    .trim()
    .split(/\r?\n/)
    .reverse()
    .find(line => line.startsWith('{') && line.includes('"results"'));
  expect(jsonLine).toBeDefined();
  return JSON.parse(jsonLine ?? '{}') as WorkflowValidationReport;
}
