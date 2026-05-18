import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { resolve } from 'path';
import {
  contextCompileCommand,
  contextDossierCommand,
  contextGraphWaiversCommand,
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

  it('AC-CONFIDENCE-004 includes ledger confidence fields in status JSON', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});

    await contextStatusCommand({ cwd: repoRoot, json: true });

    const output = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as {
      graphStatus?: string;
      graphWaivers?: number;
      graphWaiverIds?: string[];
      ledgerSchemaVersion?: string;
      ledgerSummary?: unknown;
    };
    expect(parsed.graphStatus).toBeDefined();
    expect(typeof parsed.graphWaivers).toBe('number');
    expect(Array.isArray(parsed.graphWaiverIds)).toBe(true);
    expect(parsed.ledgerSchemaVersion).toBe('aco.ledger-bundle.v1');
    expect(parsed.ledgerSummary).toBeDefined();
  });

  it('AC-GWCL-005 emits graph waiver closure JSON with approval-required recommendations', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await contextGraphWaiversCommand({ cwd: repoRoot, json: true });

    expect(exitCode).toBe(0);
    const output = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as {
      schemaVersion?: string;
      diagnostics?: Array<{
        approvalStatus?: string;
        recommendedCommands?: Array<{ requiresApproval?: boolean; willRun?: boolean }>;
      }>;
    };
    expect(parsed.schemaVersion).toBe('aco.graph-waiver-closure.v1');
    expect(parsed.diagnostics?.length).toBeGreaterThan(0);
    for (const diagnostic of parsed.diagnostics ?? []) {
      expect(diagnostic.approvalStatus).toBe('approval_required');
      expect(diagnostic.recommendedCommands?.every(command => command.willRun === false)).toBe(
        true
      );
      expect(
        diagnostic.recommendedCommands?.every(command => command.requiresApproval === true)
      ).toBe(true);
    }
  });

  it('AC-DOSSIER-003 emits decision dossier JSON', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await contextDossierCommand('Implement ACO Decision Dossier Gate', {
      cwd: repoRoot,
      json: true,
      timestamp: '2026-05-18T12:00:00.000Z',
    });

    expect(exitCode).toBe(0);
    const output = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as {
      schemaVersion?: string;
      route?: { id?: string };
      readiness?: string;
      graphStatus?: string;
      approvalRequired?: boolean;
      waivers?: Array<{ id?: string }>;
    };
    expect(parsed.schemaVersion).toBe('aco.decision-dossier.v1');
    expect(parsed.route?.id).toBe('brownfield-architecture');
    expect(parsed.readiness).toBe('needs_approval');
    expect(parsed.graphStatus).toBe('forbidden');
    expect(parsed.approvalRequired).toBe(true);
    expect(parsed.waivers?.map(waiver => waiver.id)).toEqual(
      expect.arrayContaining([
        'graph-waiver.bmad-plugins-marketplace',
        'graph-waiver.bmad-sample-data',
      ])
    );
  });

  it('AC-DOSSIER-003 renders decision dossier Markdown by default', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await contextDossierCommand('Implement ACO Decision Dossier Gate', {
      cwd: repoRoot,
      timestamp: '2026-05-18T12:00:00.000Z',
    });

    expect(exitCode).toBe(0);
    const output = logSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('# ACO Decision Dossier');
    expect(output).toContain('Route: brownfield-architecture');
    expect(output).toContain('Readiness: needs_approval');
    expect(output).toContain('Graph: forbidden');
  });

  it('AC-LEDGER-007 keeps existing context command exports available', () => {
    expect(contextRouteCommand).toBeFunction();
    expect(contextStatusCommand).toBeFunction();
    expect(contextValidateCommand).toBeFunction();
    expect(contextCompileCommand).toBeFunction();
    expect(contextDossierCommand).toBeFunction();
    expect(contextLedgersCommand).toBeFunction();
    expect(contextGraphWaiversCommand).toBeFunction();
  });
});
