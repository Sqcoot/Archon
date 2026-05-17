import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { applyCavemanPolicy, compilePromptPackage, isPathInside, routeBmad } from './index';

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
    expect(result.files['manifest.json']).toContain('manifest.json');
  });
});
