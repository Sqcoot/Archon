import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'fs/promises';
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
    const policyInput = await readFile(result.files['prompt-package.json'], 'utf8');
    const policyDecision = await readFile(result.files['policy-decision.json'], 'utf8');
    const finalPackage = await readFile(result.files['final-prompt-package.md'], 'utf8');
    expect(manifest).toContain('aco-archive-run');
    expect(policyInput).toContain('aco.prompt-package.policy-input.v1');
    expect(policyInput).not.toContain('policy-decision.json');
    expect(policyDecision).toContain('aco.policy-decision.v1');
    expect(policyDecision).toContain('ACO_POLICY_GRAPH_WAIVER');
    expect(finalPackage).not.toContain('super-secret-token-value');
    expect(finalPackage).toContain('[REDACTED]');
  });

  test('Spec: 009-archive-artifact-spec.md Acceptance: ACO-ARCHIVE-002 unsafe run IDs are rejected', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-archive-'));
    await expect(
      compilePromptPackage({
        cwd: process.cwd(),
        prompt: 'Compile safely.',
        archiveRoot,
        runId: '../escape',
      })
    ).rejects.toThrow('Invalid ACO archive runId');
    await expect(
      compilePromptPackage({
        cwd: process.cwd(),
        prompt: 'Compile safely.',
        archiveRoot,
        runId: '/tmp/escape',
      })
    ).rejects.toThrow('Invalid ACO archive runId');
    await expect(
      compilePromptPackage({
        cwd: process.cwd(),
        prompt: 'Compile safely.',
        archiveRoot,
        runId: 'bad/id',
      })
    ).rejects.toThrow('Invalid ACO archive runId');
  });

  test('Spec: 009-archive-artifact-spec.md Acceptance: ACO-ARCHIVE-003 symlink archive escapes are blocked', async () => {
    if (process.platform === 'win32') return;

    const outside = await mkdtemp(join(tmpdir(), 'aco-outside-'));
    const symlinkRoot = join(await mkdtemp(join(tmpdir(), 'aco-root-parent-')), 'archive-root');
    await symlink(outside, symlinkRoot, 'dir');
    await expect(
      compilePromptPackage({
        cwd: process.cwd(),
        prompt: 'Compile safely.',
        archiveRoot: symlinkRoot,
        runId: 'aco-symlink-root',
      })
    ).rejects.toThrow('Archive root must not be a symbolic link');

    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-archive-'));
    const archivePath = join(archiveRoot, 'aco-symlink-file');
    await mkdir(archivePath);
    const outsideFile = join(outside, 'manifest.json');
    await writeFile(outsideFile, 'outside');
    await symlink(outsideFile, join(archivePath, 'manifest.json'));
    await expect(
      compilePromptPackage({
        cwd: process.cwd(),
        prompt: 'Compile safely.',
        archiveRoot,
        runId: 'aco-symlink-file',
      })
    ).rejects.toThrow('Archive file must not be a symbolic link');
  });
});
