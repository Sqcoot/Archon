import type { Gate, GateRunResult } from '@archon/aco-core';
import { buildLedgerBundle } from './bundle';
import type { CommandLedgerEntry, LedgerBundle, LedgerBundleInput, LedgerCounts } from './schemas';

const REQUIRED_LEDGERS_COMMAND = 'archon context ledgers [prompt] [--no-write-artifact]';

export interface LedgerFixtureParityResult {
  readonly gate: 'ledger-fixture-parity-gate';
  readonly counts: LedgerCounts;
  readonly requiredCommand: CommandLedgerEntry;
  readonly bundle: LedgerBundle;
}

const EXPECTED_COUNTS: LedgerCounts = {
  artifact: 12,
  capability: 17,
  command: 12,
  risk: 8,
  tool: 10,
  unknowns: 6,
  workflow: 5,
  total: 70,
};

export const ledgerFixtureParityGate: Gate<LedgerBundleInput, LedgerFixtureParityResult> = {
  kind: 'gate',
  id: 'ledger-fixture-parity-gate',
  mutates: 'read-only',
  run(input: LedgerBundleInput): Promise<GateRunResult<LedgerFixtureParityResult>> {
    const bundle = buildLedgerBundle(input);
    const evidence = [
      {
        id: 'evidence.gate.ledger-fixture-parity',
        source: 'ledger-fixture-parity-gate',
        summary: 'S3 fixture parity gate is pure and read-only',
        confidence: 'high',
        freshness: 'unknown',
      },
    ] as const;

    if (!bundle.ok) {
      return Promise.resolve({ status: 'failed', errors: bundle.issues, evidence });
    }

    const errors = validateParity(bundle.value);
    if (errors.length > 0) {
      return Promise.resolve({ status: 'failed', errors, evidence });
    }

    const requiredCommand = findRequiredCommand(bundle.value);
    if (requiredCommand === undefined) {
      return Promise.resolve({
        status: 'failed',
        errors: [`missing required command ${REQUIRED_LEDGERS_COMMAND}`],
        evidence,
      });
    }

    return Promise.resolve({
      status: 'passed',
      value: {
        gate: 'ledger-fixture-parity-gate',
        counts: bundle.value.counts,
        requiredCommand,
        bundle: bundle.value,
      },
      evidence,
    });
  },
};

function validateParity(bundle: LedgerBundle): readonly string[] {
  const errors: string[] = [];
  for (const [name, expected] of Object.entries(EXPECTED_COUNTS)) {
    const actual = bundle.counts[name as keyof LedgerCounts];
    if (actual !== expected) {
      errors.push(`expected ${name} count ${expected} but received ${actual}`);
    }
  }

  const requiredCommand = findRequiredCommand(bundle);
  if (requiredCommand === undefined) {
    errors.push(`missing required command ${REQUIRED_LEDGERS_COMMAND}`);
  } else {
    if (requiredCommand.mutates !== 'writes-artifacts') {
      errors.push('required ledgers command must be scoped artifact-writing');
    }
    if (requiredCommand.subject.safety !== 'read-only-or-writes-artifacts') {
      errors.push('required ledgers command must have read-only or writes-artifacts safety');
    }
    if (requiredCommand.approvalRequired) {
      errors.push('required ledgers command must not require approval');
    }
    if (requiredCommand.owner !== 'aco-ledgers') {
      errors.push('required ledgers command owner must be aco-ledgers');
    }
    if (requiredCommand.compatibility !== 'preserve') {
      errors.push('required ledgers command compatibility must be preserve');
    }
    const evidence = requiredCommand.evidence[0];
    if (
      evidence?.id !== 'evidence.ledger.command.4' ||
      evidence.source !== 'command-ledger.csv#L5'
    ) {
      errors.push('required ledgers command must retain stable evidence');
    }
  }

  return errors;
}

function findRequiredCommand(bundle: LedgerBundle): CommandLedgerEntry | undefined {
  return bundle.commands.find(command => command.subject.command === REQUIRED_LEDGERS_COMMAND);
}
