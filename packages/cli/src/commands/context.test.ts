import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdtemp, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { compilePromptPackage } from '@archon/context-orchestrator';
import {
  contextApprovalCapsuleCommand,
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

  it('ACO-APPROVAL-002 contextApprovalCapsuleCommand emits approval capsule JSON without artifact writes', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await contextApprovalCapsuleCommand('Implement ACO Approval Capsule', {
      cwd: repoRoot,
      json: true,
      runId: 'aco-cli-approval-readonly',
      timestamp: '2026-05-18T12:00:00.000Z',
    });

    expect(exitCode).toBe(0);
    const output = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as {
      schemaVersion?: string;
      runId?: string;
      graphStatus?: string;
      approvalCommands?: Array<{ willRun?: boolean }>;
    };
    expect(parsed.schemaVersion).toBe('aco.approval-capsule.v1');
    expect(parsed.runId).toBe('aco-cli-approval-readonly');
    expect(parsed.graphStatus).toBe('forbidden');
    expect(parsed.approvalCommands?.every(command => command.willRun === false)).toBe(true);
  });

  it('ACO-APPROVAL-002 renders approval capsule Markdown by default', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await contextApprovalCapsuleCommand('Implement ACO Approval Capsule', {
      cwd: repoRoot,
      runId: 'aco-cli-approval-markdown',
      timestamp: '2026-05-18T12:00:00.000Z',
    });

    expect(exitCode).toBe(0);
    const output = logSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('# ACO Approval Capsule');
    expect(output).toContain('Readiness: needs_approval');
    expect(output).toContain('Graph: forbidden');
  });

  it('ACO-APPROVAL-003 writes approval capsule artifacts when artifact root is provided', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-cli-approval-'));
    await compilePromptPackage({
      cwd: repoRoot,
      prompt: 'Implement ACO Approval Capsule',
      archiveRoot,
      runId: 'aco-cli-approval-write',
      timestamp: '2026-05-18T12:00:00.000Z',
    });

    const exitCode = await contextApprovalCapsuleCommand('Implement ACO Approval Capsule', {
      cwd: repoRoot,
      json: true,
      artifactRoot: archiveRoot,
      runId: 'aco-cli-approval-write',
      timestamp: '2026-05-18T12:00:00.000Z',
    });

    expect(exitCode).toBe(0);
    const output = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as { files?: { json?: string; markdown?: string } };
    expect(parsed.files?.json).toBe(
      join(archiveRoot, 'aco-cli-approval-write', 'approval-capsule.json')
    );
    expect(parsed.files?.markdown).toBe(
      join(archiveRoot, 'aco-cli-approval-write', 'approval-capsule.md')
    );
    expect(await readFile(parsed.files?.json ?? '', 'utf8')).toContain('"aco.approval-capsule.v1"');
  });

  it('AC-LEDGER-007 keeps existing context command exports available', () => {
    expect(contextRouteCommand).toBeFunction();
    expect(contextStatusCommand).toBeFunction();
    expect(contextValidateCommand).toBeFunction();
    expect(contextCompileCommand).toBeFunction();
    expect(contextDossierCommand).toBeFunction();
    expect(contextApprovalCapsuleCommand).toBeFunction();
    expect(contextLedgersCommand).toBeFunction();
    expect(contextGraphWaiversCommand).toBeFunction();
  });
});
