import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { compilePromptPackage, redactSecrets } from '@archon/context-orchestrator';

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

  test('Spec: 015-security-threat-model.md Acceptance: ACO-SECURITY-002 prompt secrets are redacted across archive outputs', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-security-'));
    const privateKey = [
      '-----BEGIN PRIVATE KEY-----',
      'private-key-value',
      '-----END PRIVATE KEY-----',
    ].join('\n');
    const prompt = [
      'Plan with secret_token=lowercase-secret.',
      'Use ApiKey: "json-secret-value".',
      'Use password: yaml-secret-value.',
      'Send Authorization: Bearer abcdefghijklmnopqrstuvwxyz.',
      'Use sk-abcdefghijklmnopqrstuvwxyz.',
      'Use ghp_abcdefghijklmnopqrstuvwxyz.',
      'Use npm_abcdefghijklmnopqrstuvwxyz.',
      'Use AKIAABCDEFGHIJKLMNOP.',
      'Use https://user:pass@example.com/path.',
      privateKey,
    ].join('\n');
    const result = await compilePromptPackage({
      cwd: process.cwd(),
      prompt,
      archiveRoot,
      runId: 'aco-security-redaction',
      timestamp: '2026-05-17T12:00:00.000Z',
    });
    const finalPackage = await readFile(result.files['final-prompt-package.md'], 'utf8');
    const manifest = await readFile(result.files['manifest.json'], 'utf8');
    const outputs = `${finalPackage}\n${manifest}\n${JSON.stringify(result.package)}`;
    for (const leaked of [
      'lowercase-secret',
      'json-secret-value',
      'yaml-secret-value',
      'abcdefghijklmnopqrstuvwxyz',
      'AKIAABCDEFGHIJKLMNOP',
      'user:pass',
      'private-key-value',
    ]) {
      expect(outputs).not.toContain(leaked);
    }
    expect(outputs).toContain('[REDACTED]');
  });

  test('Spec: 015-security-threat-model.md Acceptance: ACO-SECURITY-003 next command is structured argv', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-security-'));
    const result = await compilePromptPackage({
      cwd: `${process.cwd()} with spaces; $(echo unsafe)`,
      prompt: 'Compile with TOKEN=secret-token-value; $(echo unsafe).',
      archiveRoot,
      runId: 'aco-command-vector',
      timestamp: '2026-05-17T12:00:00.000Z',
    });
    expect(Array.isArray(result.package.nextArchonCommand)).toBe(true);
    expect(result.package.nextArchonCommand).toContain('--');
    expect(result.package.nextArchonCommand.join(' ')).not.toContain('secret-token-value');
  });

  test('Spec: 015-security-threat-model.md Acceptance: ACO-SECURITY-004 redaction covers supported secret shapes', () => {
    const redacted = redactSecrets(
      [
        'mixedCaseSecret=secret-value',
        '{"api_key":"json-value"}',
        'password: yaml-value',
        'Authorization: Bearer abcdefghijklmnopqrstuvwxyz',
        'sk-abcdefghijklmnopqrstuvwxyz',
        'ghp_abcdefghijklmnopqrstuvwxyz',
        'npm_abcdefghijklmnopqrstuvwxyz',
        'AKIAABCDEFGHIJKLMNOP',
        'https://user:pass@example.com/path',
        '-----BEGIN PRIVATE KEY-----\nvalue\n-----END PRIVATE KEY-----',
      ].join('\n')
    );
    for (const leaked of [
      'secret-value',
      'json-value',
      'yaml-value',
      'abcdefghijklmnopqrstuvwxyz',
      'AKIAABCDEFGHIJKLMNOP',
      'user:pass',
      '-----BEGIN PRIVATE KEY-----',
    ]) {
      expect(redacted).not.toContain(leaked);
    }
    expect(redacted).toContain('[REDACTED]');
  });
});
