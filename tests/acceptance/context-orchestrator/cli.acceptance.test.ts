import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('ACO CLI acceptance', () => {
  test('Spec: 012-cli-contract.md Acceptance: ACO-CLI-002 context route emits selected BMAD route', async () => {
    const proc = Bun.spawn(
      [
        process.execPath,
        'packages/cli/src/cli.ts',
        'context',
        'route',
        '--cwd',
        process.cwd(),
        '--json',
        'Implement an architecture-sensitive context orchestrator inside Archon.',
      ],
      { cwd: process.cwd(), stdout: 'pipe', stderr: 'pipe' }
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(stderr).toBe('');
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { id: string; steps: string[] };
    expect(parsed.id).toBe('brownfield-architecture');
    expect(parsed.steps).toContain('bmad-technical-research');
  });

  test('Spec: 012-cli-contract.md Acceptance: ACO-CLI-001 context compile emits JSON with archive paths', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-cli-'));
    const proc = Bun.spawn(
      [
        process.execPath,
        'packages/cli/src/cli.ts',
        'context',
        'compile',
        '--cwd',
        process.cwd(),
        '--archive-root',
        archiveRoot,
        '--run-id',
        'aco-cli-run',
        '--timestamp',
        '2026-05-17T12:00:00.000Z',
        '--json',
        'Validate the ACO MVP.',
      ],
      { cwd: process.cwd(), stdout: 'pipe', stderr: 'pipe' }
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(stderr).toBe('');
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { archivePath: string; files: Record<string, string> };
    expect(parsed.archivePath).toContain('aco-cli-run');
    expect(parsed.files['codex-prompt.md']).toContain('codex-prompt.md');
  });
});
