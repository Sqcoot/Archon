import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { acoCommand, resolveAcoCommandInvocation } from './aco';

describe('ACO CLI adapter', () => {
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('renders a stable JSON status envelope from the contract package', async () => {
    const exitCode = await acoCommand('/repo', ['aco', 'status'], { json: true });

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]?.[0]).toBe(
      (await loadGolden('cli-aco-status-json.expected.txt')).trimEnd()
    );
  });

  test('renders ledger command help as representative stdout golden', async () => {
    const exitCode = await acoCommand('/repo', ['context', 'ledgers']);

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls[0]?.[0]).toBe(
      (await loadGolden('cli-context-ledgers-stdout.expected.md')).trimEnd()
    );
  });

  test('denies write commands in readonly context before side effects', async () => {
    const exitCode = await acoCommand('/repo', ['context', 'compile', 'build', 'bundle']);

    expect(exitCode).toBe(2);
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy.mock.calls[0]?.[0]).toBe(
      (await loadGolden('cli-context-compile-stderr.expected.txt')).trimEnd()
    );
  });

  test('denies write-artifact bootstrap variant before invoking artifact writes', async () => {
    const exitCode = await acoCommand('/repo', ['aco', 'bootstrap-codex'], {
      event: 'SessionStart',
      format: 'markdown',
      writeArtifact: true,
    });

    expect(exitCode).toBe(2);
    expect(logSpy).not.toHaveBeenCalled();
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('readonly context forbids');
  });

  test('maps CLI surfaces to descriptor ids without local command truth', () => {
    const status = resolveAcoCommandInvocation('/repo', ['aco', 'status'], { json: true });
    const route = resolveAcoCommandInvocation('/repo', ['context', 'route', 'next slice']);
    const compile = resolveAcoCommandInvocation('/repo', ['context', 'compile', 'next slice']);

    expect(status.ok && status.invocation.commandId).toBe('archon.aco.status');
    expect(route.ok && route.invocation.commandId).toBe('archon.context.route');
    expect(compile.ok && compile.invocation.commandId).toBe('archon.context.compile');
  });
});

async function loadGolden(fileName: string): Promise<string> {
  const root = new URL('../../../../tests/fixtures/aco/cli-contracts/', import.meta.url);
  return Bun.file(new URL(fileName, root)).text();
}
