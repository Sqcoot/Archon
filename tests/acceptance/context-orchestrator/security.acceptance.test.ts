import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { compilePromptPackage } from '@archon/context-orchestrator';

describe('ACO security acceptance', () => {
  test('Spec: 015-security-threat-model.md Acceptance: ACO-SECURITY-001 target env does not leak', async () => {
    const target = await mkdtemp(join(tmpdir(), 'aco-target-'));
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-security-'));
    await writeFile(join(target, '.env'), 'SECRET_TOKEN=do-not-read-this-value\n');
    const result = await compilePromptPackage({
      cwd: target,
      prompt: 'Compile safely.',
      archiveRoot,
      runId: 'aco-security-run',
      timestamp: '2026-05-17T12:00:00.000Z',
    });
    const finalPackage = await readFile(result.files['final-prompt-package.md'], 'utf8');
    expect(finalPackage).not.toContain('do-not-read-this-value');
  });
});
