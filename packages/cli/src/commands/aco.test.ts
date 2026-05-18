import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { resolve } from 'path';
import {
  getContextOrchestratorStatus,
  type ContextOrchestratorStatus,
} from '@archon/context-orchestrator';
import { contextLedgersCommand, contextStatusCommand } from './context';
import { acoStatusCommand, formatAcoStatusText } from './aco';

const repoRoot = resolve(import.meta.dir, '../../../..');

const fixtureStatus: ContextOrchestratorStatus = {
  cwd: repoRoot,
  contextIntent: {
    objective: 'Inspect Context Orchestrator readiness',
    normalizedObjective: 'inspect context orchestrator readiness',
    intentHash: 'intent-123',
    cwd: repoRoot,
    commitSha: 'abc123',
    generatedAt: '2026-05-18T12:00:00.000Z',
  },
  validationStatus: 'passed',
  graphStatus: 'forbidden',
  graphWaivers: 2,
  graphWaiverIds: ['graph-waiver.bmad-plugins-marketplace', 'graph-waiver.bmad-sample-data'],
  waivers: [],
  approvalRequired: true,
  readiness: 'needs_approval',
  ledgerSchemaVersion: 'aco.ledger-bundle.v1',
  evidenceBlockers: [],
  ledgerSummary: {
    toolAvailability: {
      total: 20,
      counts: {
        available: 17,
        partial: 1,
        blocked: 0,
        deferred: 0,
        forbidden: 2,
        'not used': 0,
        unknown: 0,
      },
    },
    commands: {
      total: 19,
      counts: {
        available: 9,
        partial: 1,
        blocked: 0,
        deferred: 3,
        forbidden: 6,
        'not used': 0,
        unknown: 0,
      },
    },
    combined: {
      total: 39,
      counts: {
        available: 26,
        partial: 2,
        blocked: 0,
        deferred: 3,
        forbidden: 8,
        'not used': 0,
        unknown: 0,
      },
    },
  },
};

describe('aco commands', () => {
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
  });

  it('AC-ACO-STATUS-001 AC-P1-CLI renders validation graph waivers schema and ledger counts', () => {
    const output = formatAcoStatusText(fixtureStatus);

    expect(output).toContain('Context Orchestrator Status');
    expect(output).toContain('Readiness: Needs approval');
    expect(output).toContain('validation: passed');
    expect(output).toContain('graph: forbidden');
    expect(output).toContain('waivers: 2');
    expect(output).toContain('schema: aco.ledger-bundle.v1');
    expect(output).toContain(
      'ledger counts: total=39 available=26 partial=2 deferred=3 forbidden=8 unknown=0'
    );
  });

  it('AC-ACO-STATUS-007 AC-FORBIDDEN-GRAPH-001 keeps forbidden waiver IDs visible', () => {
    const output = formatAcoStatusText(fixtureStatus);

    expect(output).toContain('Approval-required graph confidence limits');
    expect(output).toContain('graph-waiver.bmad-plugins-marketplace');
    expect(output).toContain('graph-waiver.bmad-sample-data');
    expect(output).not.toContain('Ready with known limits');
  });

  it('AC-ACO-STATUS-002 emits raw getContextOrchestratorStatus JSON', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    const timestamp = '2026-05-18T12:00:00.000Z';
    await acoStatusCommand({ cwd: repoRoot, json: true, timestamp });

    expect(errorSpy).not.toHaveBeenCalled();
    const output = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output) as ContextOrchestratorStatus;
    const expected = await getContextOrchestratorStatus(repoRoot, { timestamp });
    expect(parsed).toEqual(expected);
  });

  it('prints Context Orchestrator status text by default', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});

    await acoStatusCommand({ cwd: repoRoot });

    const output = logSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('Context Orchestrator Status');
    expect(output).toContain('ledger counts:');
  });

  it('AC-ACO-STATUS-006 AC-NONREG leaves existing context status and context ledgers commands available', async () => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    await contextStatusCommand({ cwd: repoRoot, json: true });
    const ledgersExitCode = await contextLedgersCommand({ cwd: repoRoot, json: true });

    expect(ledgersExitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    const statusOutput = logSpy.mock.calls[0]?.[0] as string;
    const ledgersOutput = logSpy.mock.calls[1]?.[0] as string;
    expect(JSON.parse(statusOutput)).toHaveProperty('ledgerSchemaVersion', 'aco.ledger-bundle.v1');
    expect(JSON.parse(ledgersOutput)).toHaveProperty('schemaVersion', 'aco.ledger-bundle.v1');
  });
});
