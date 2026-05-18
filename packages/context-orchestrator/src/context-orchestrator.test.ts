import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import {
  applyCavemanPolicy,
  compilePromptPackage,
  isPathInside,
  redactSecrets,
  routeBmad,
  validateContextOrchestrator,
} from './index';

const repoRoot = resolve(import.meta.dir, '../../..');

describe('context orchestrator core', () => {
  test('routes ambiguous tasks to BMAD help', () => {
    expect(routeBmad({ prompt: 'help' }).steps).toEqual(['bmad-help']);
  });

  test('preserves fenced artifacts under Caveman policy', () => {
    const input =
      'Keep this:\n```json\n{"path":"docs/context-orchestrator/specs/007-caveman-policy-spec.md"}\n```';
    expect(applyCavemanPolicy(input, 'ultra')).toContain(
      '```json\n{"path":"docs/context-orchestrator/specs/007-caveman-policy-spec.md"}\n```'
    );
  });

  test('rejects paths outside archive root', () => {
    expect(isPathInside('/tmp/aco-root', '/tmp/aco-root/package')).toBe(true);
    expect(isPathInside('/tmp/aco-root', '/tmp/not-aco-root/package')).toBe(false);
  });

  test('compiles a deterministic redacted archive', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-core-'));
    const result = await compilePromptPackage({
      cwd: process.cwd(),
      prompt: 'Implement safely with SECRET_TOKEN=hidden-value.',
      archiveRoot,
      runId: 'aco-core-test',
      timestamp: '2026-05-17T12:00:00.000Z',
    });

    expect(result.package.runId).toBe('aco-core-test');
    expect(result.package.originalPrompt).toContain('SECRET_TOKEN=[REDACTED]');
    expect(result.package.nextArchonCommand).toEqual([
      'bun',
      'run',
      'cli',
      'context',
      'compile',
      '--cwd',
      process.cwd(),
      '--',
      'Implement safely with SECRET_TOKEN=[REDACTED]',
    ]);
    expect(result.files['manifest.json']).toContain('manifest.json');
    expect(result.files['prompt-package.json']).toContain('prompt-package.json');

    const policyInput = JSON.parse(await readFile(result.files['prompt-package.json'], 'utf8')) as {
      schema_version: string;
      package_id: string;
      evidence: {
        graph?: unknown;
        docs?: unknown;
        bmad?: unknown;
        acceptance?: unknown;
        security?: unknown;
      };
    };
    expect(policyInput.schema_version).toBe('aco.prompt-package.policy-input.v1');
    expect(policyInput.package_id).toBe('aco-core-test');
    expect(policyInput.evidence.graph).toBeDefined();
    expect(policyInput.evidence.docs).toBeDefined();
    expect(policyInput.evidence.bmad).toBeDefined();
    expect(policyInput.evidence.acceptance).toBeDefined();
    expect(policyInput.evidence.security).toBeDefined();
  });

  test('rejects unsafe archive run IDs', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-core-'));
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
        runId: 'bad\\id',
      })
    ).rejects.toThrow('Invalid ACO archive runId');
  });

  test('rejects symlink archive roots and file collisions', async () => {
    if (process.platform === 'win32') return;

    const outside = await mkdtemp(join(tmpdir(), 'aco-outside-'));
    const symlinkRoot = join(await mkdtemp(join(tmpdir(), 'aco-link-parent-')), 'archive-root');
    await symlink(outside, symlinkRoot, 'dir');
    await expect(
      compilePromptPackage({
        cwd: process.cwd(),
        prompt: 'Compile safely.',
        archiveRoot: symlinkRoot,
        runId: 'aco-symlink-root',
      })
    ).rejects.toThrow('Archive root must not be a symbolic link');

    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-core-'));
    const archivePath = join(archiveRoot, 'aco-file-collision');
    await mkdir(archivePath);
    const outsideFile = join(outside, 'manifest.json');
    await writeFile(outsideFile, 'outside');
    await symlink(outsideFile, join(archivePath, 'manifest.json'));
    await expect(
      compilePromptPackage({
        cwd: process.cwd(),
        prompt: 'Compile safely.',
        archiveRoot,
        runId: 'aco-file-collision',
      })
    ).rejects.toThrow('Archive file must not be a symbolic link');
  });

  test('redacts broad secret-like values', () => {
    const privateKey = ['-----BEGIN PRIVATE KEY-----', 'abc123', '-----END PRIVATE KEY-----'].join(
      '\n'
    );
    const input = [
      'secret_token=lowercase-secret',
      'ApiKey: "json-style-secret"',
      'password: yaml-style-secret',
      'Authorization: Bearer abcdefghijklmnopqrstuvwxyz',
      'openai=sk-abcdefghijklmnopqrstuvwxyz',
      'github=ghp_abcdefghijklmnopqrstuvwxyz',
      'npm=npm_abcdefghijklmnopqrstuvwxyz',
      'aws=AKIAABCDEFGHIJKLMNOP',
      'url=https://user:pass@example.com/path',
      privateKey,
    ].join('\n');
    const redacted = redactSecrets(input);
    expect(redacted).not.toContain('lowercase-secret');
    expect(redacted).not.toContain('json-style-secret');
    expect(redacted).not.toContain('yaml-style-secret');
    expect(redacted).not.toContain('abcdefghijklmnopqrstuvwxyz');
    expect(redacted).not.toContain('AKIAABCDEFGHIJKLMNOP');
    expect(redacted).not.toContain('user:pass');
    expect(redacted).not.toContain(privateKey);
    expect(redacted).toContain('[REDACTED]');
  });

  test('archive output does not contain rendered prompt secrets', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-core-'));
    const result = await compilePromptPackage({
      cwd: process.cwd(),
      prompt: 'Plan with api_key: "json-secret-value" and token=npm_abcdefghijklmnop.',
      archiveRoot,
      runId: 'aco-redacted-output',
      timestamp: '2026-05-17T12:00:00.000Z',
    });
    const finalPackage = await readFile(result.files['final-prompt-package.md'], 'utf8');
    const manifest = await readFile(result.files['manifest.json'], 'utf8');
    const policyInput = await readFile(result.files['prompt-package.json'], 'utf8');
    expect(finalPackage).not.toContain('json-secret-value');
    expect(finalPackage).not.toContain('npm_abcdefghijklmnop');
    expect(manifest).not.toContain('json-secret-value');
    expect(manifest).not.toContain('npm_abcdefghijklmnop');
    expect(policyInput).not.toContain('json-secret-value');
    expect(policyInput).not.toContain('npm_abcdefghijklmnop');
  });

  test('reports explicit local OPA policy skip for aggregate validation only', async () => {
    const originalSkip = process.env.ARCHON_SKIP_OPA;
    const originalCi = process.env.CI;
    try {
      process.env.ARCHON_SKIP_OPA = '1';
      delete process.env.CI;
      const report = await validateContextOrchestrator({ cwd: repoRoot });
      const policyCheck = report.checks.find(check => check.id === 'aco-policy');
      expect(report.status).toBe('warning');
      expect(policyCheck?.status).toBe('warning');
      expect(policyCheck?.message).toContain('local aggregate validation only');
    } finally {
      if (originalSkip === undefined) {
        delete process.env.ARCHON_SKIP_OPA;
      } else {
        process.env.ARCHON_SKIP_OPA = originalSkip;
      }
      if (originalCi === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = originalCi;
      }
    }
  });

  test('fails closed when OPA policy skip is requested in CI', async () => {
    const originalSkip = process.env.ARCHON_SKIP_OPA;
    const originalCi = process.env.CI;
    try {
      process.env.ARCHON_SKIP_OPA = '1';
      process.env.CI = 'true';
      const report = await validateContextOrchestrator({ cwd: repoRoot });
      const policyCheck = report.checks.find(check => check.id === 'aco-policy');
      expect(report.status).toBe('failed');
      expect(policyCheck?.status).toBe('failed');
      expect(policyCheck?.message).toContain('forbidden');
    } finally {
      if (originalSkip === undefined) {
        delete process.env.ARCHON_SKIP_OPA;
      } else {
        process.env.ARCHON_SKIP_OPA = originalSkip;
      }
      if (originalCi === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = originalCi;
      }
    }
  });
});
