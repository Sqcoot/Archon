import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { resolve } from 'path';
import {
  contextCompileCommand,
  contextLedgersCommand,
  contextRouteCommand,
  contextStatusCommand,
  contextValidateCommand,
} from './context';

const repoRoot = resolve(import.meta.dir, '../../../..');

describe('context commands', () => {
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
  });

  it('AC-LEDGER-005 emits combined ledger bundle JSON', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    const exitCode = await contextLedgersCommand({ cwd: repoRoot, json: true });

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    const output = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as {
      schemaVersion?: string;
      toolAvailability?: unknown[];
      commands?: unknown[];
      summary?: unknown;
    };
    expect(parsed.schemaVersion).toBe('aco.ledger-bundle.v1');
    expect(parsed.toolAvailability?.length).toBeGreaterThan(0);
    expect(parsed.commands?.length).toBeGreaterThan(0);
    expect(parsed.summary).toBeDefined();
  });

  it('renders ledger Markdown by default', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    const exitCode = await contextLedgersCommand({ cwd: repoRoot });

    expect(exitCode).toBe(0);
    const output = logSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('# Tool Availability Ledger');
    expect(output).toContain('# Commands Ledger');
  });

  it('AC-LEDGER-007 keeps existing context command exports available', () => {
    expect(contextRouteCommand).toBeFunction();
    expect(contextStatusCommand).toBeFunction();
    expect(contextValidateCommand).toBeFunction();
    expect(contextCompileCommand).toBeFunction();
    expect(contextLedgersCommand).toBeFunction();
  });
});
