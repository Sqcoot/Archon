import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const hookPath = '.codex/hooks/verify-task-list.sh';

describe('ACO Codex hook acceptance', () => {
  test('Spec: 010-codex-readiness-spec.md Acceptance: ACO-CODEX-HOOK-001 restored task list is reported', async () => {
    const taskRoot = await mkdtemp(join(tmpdir(), 'aco-hook-'));
    await mkdir(join(taskRoot, 'safe-id'));
    await writeFile(join(taskRoot, 'safe-id', 'task.json'), '{}\n');

    const output = await runHook({
      CODEX_TASKS_DIR: taskRoot,
      CODEX_TASK_LIST_ID: 'safe-id',
    });

    expect(output).toContain('Task list safe-id restored (1 tasks).');
  });

  test('Spec: 010-codex-readiness-spec.md Acceptance: ACO-CODEX-HOOK-002 unsafe task IDs are ignored', async () => {
    const taskRoot = await mkdtemp(join(tmpdir(), 'aco-hook-'));
    const output = await runHook({
      CODEX_TASKS_DIR: taskRoot,
      CODEX_TASK_LIST_ID: '../escape',
    });

    expect(output).toContain('Ignoring unsafe CODEX_TASK_LIST_ID');
  });

  test('Spec: 010-codex-readiness-spec.md Acceptance: ACO-CODEX-HOOK-003 symlink task dirs cannot escape root', async () => {
    if (process.platform === 'win32') return;

    const taskRoot = await mkdtemp(join(tmpdir(), 'aco-hook-'));
    const outside = await mkdtemp(join(tmpdir(), 'aco-hook-outside-'));
    await symlink(outside, join(taskRoot, 'linked'), 'dir');

    const output = await runHook({
      CODEX_TASKS_DIR: taskRoot,
      CODEX_TASK_LIST_ID: 'linked',
    });

    expect(output).toContain('resolves outside the Codex task root');
  });
});

async function runHook(env: Record<string, string>): Promise<string> {
  const proc = Bun.spawn([hookPath], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  proc.stdin.write('{}\n');
  proc.stdin.end();
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  expect(stderr).toBe('');
  expect(exitCode).toBe(0);
  return stdout;
}
