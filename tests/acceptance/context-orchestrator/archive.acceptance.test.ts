import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { compilePromptPackage } from '@archon/context-orchestrator';

describe('ACO archive acceptance', () => {
  test('Spec: 009-archive-artifact-spec.md Acceptance: ACO-ARCHIVE-001 archive files are written and redacted', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-archive-'));
    const result = await compilePromptPackage({
      cwd: process.cwd(),
      prompt: 'Use SECRET_TOKEN=super-secret-token-value while planning.',
      archiveRoot,
      runId: 'aco-archive-run',
      timestamp: '2026-05-17T12:00:00.000Z',
    });
    const manifest = await readFile(result.files['manifest.json'], 'utf8');
    const finalPackage = await readFile(result.files['final-prompt-package.md'], 'utf8');
    expect(manifest).toContain('aco-archive-run');
    expect(finalPackage).not.toContain('super-secret-token-value');
    expect(finalPackage).toContain('[REDACTED]');
  });
});
