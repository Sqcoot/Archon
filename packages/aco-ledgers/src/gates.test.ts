import { describe, expect, test } from 'bun:test';
import { ledgerFixtureParityGate } from './index';
import { loadLedgerInputs, loadLedgerObjectInputs, REQUIRED_COMMAND } from './bundle.test';
import type { LedgerObjectInputs } from './index';

describe('ledger fixture parity gate', () => {
  test('passes current oracle fixture and proves the required ledgers command surface', async () => {
    const result = await ledgerFixtureParityGate.run(await loadLedgerInputs());

    expect(result.status).toBe('passed');
    if (result.status !== 'passed') throw new Error(result.errors.join('\n'));
    expect(result.value.counts).toEqual({
      artifact: 12,
      capability: 17,
      command: 12,
      risk: 8,
      tool: 10,
      unknowns: 6,
      workflow: 5,
      total: 70,
    });
    expect(result.value.requiredCommand).toMatchObject({
      owner: 'aco-ledgers',
      mutates: 'writes-artifacts',
      approvalRequired: false,
      compatibility: 'preserve',
    });
    expect(result.value.requiredCommand.evidence[0]).toMatchObject({
      id: 'evidence.ledger.command.4',
      source: 'command-ledger.csv#L5',
    });
  });

  test('fails closed on missing required ledger and malformed headers', async () => {
    const inputs = await loadLedgerInputs();
    const missing = { ...inputs } as Record<string, unknown>;
    delete missing.command;
    await expectGateFailure(missing, 'missing required ledger command');

    await expectGateFailure(
      { ...inputs, command: inputs.command.replace('command,surface', 'cmd,surface') },
      'malformed header'
    );
  });

  test('fails closed on duplicate generated ids', async () => {
    const rows = await loadLedgerObjectInputs();
    await expectGateFailure(
      {
        ...rows,
        command: [rows.command[0], ...rows.command],
      },
      'duplicate ledger entry id'
    );
  });

  test('fails closed on invalid confidence, status, safety, and freshness', async () => {
    const rows = await loadLedgerObjectInputs();
    await expectGateFailure(
      {
        ...rows,
        capability: rows.capability.map((row, index) =>
          index === 0 ? { ...row, confidence: 'certain' } : row
        ),
      },
      'invalid confidence'
    );
    await expectGateFailure(
      {
        ...rows,
        tool: rows.tool.map((row, index) => (index === 0 ? { ...row, status: 'ready' } : row)),
      },
      'invalid status'
    );
    await expectGateFailure(
      {
        ...rows,
        command: rows.command.map((row, index) =>
          index === 3 ? { ...row, safety: 'safe enough' } : row
        ),
      },
      'invalid safety'
    );
    await expectGateFailure(
      {
        ...rows,
        command: rows.command.map((row, index) =>
          index === 3 ? { ...row, freshness: 'ancient' } : row
        ),
      },
      'invalid freshness'
    );
  });

  test('fails closed on approval mismatch, broken command surface, and unsupported compatibility', async () => {
    const rows = await loadLedgerObjectInputs();
    await expectGateFailure(
      {
        ...rows,
        command: rows.command.map(row =>
          row.command === REQUIRED_COMMAND ? { ...row, approval_required: 'yes' } : row
        ),
      },
      'approval mismatch'
    );
    await expectGateFailure(
      {
        ...rows,
        command: rows.command.map(row =>
          row.command === REQUIRED_COMMAND
            ? { ...row, command: 'archon context ledger [prompt]' }
            : row
        ),
      },
      'missing required command'
    );
    await expectGateFailure(
      {
        ...rows,
        command: rows.command.map((row, index) =>
          index === 0 ? { ...row, compatibility: 'maybe-preserve' } : row
        ),
      },
      'unsupported compatibility'
    );
  });
});

async function expectGateFailure(input: unknown, expectedMessage: string): Promise<void> {
  const result = await ledgerFixtureParityGate.run(input as LedgerObjectInputs);
  expect(result.status).toBe('failed');
  if (result.status !== 'failed') {
    throw new Error(`expected gate failure, received ${result.status}`);
  }
  expect(result.errors.join('\n')).toContain(expectedMessage);
}
