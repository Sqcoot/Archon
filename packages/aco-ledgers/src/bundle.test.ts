import { describe, expect, test } from 'bun:test';
import {
  buildLedgerBundle,
  parseCsv,
  parseLedgerBundle,
  parseLedgerCsvInputs,
  renderLedgerBundleSummary,
  serializeLedgerBundle,
  stringifyCsv,
} from './index';
import type { LedgerCsvInputs, LedgerObjectInputs } from './index';

describe('ledger bundle builder', () => {
  test('parses fixture CSVs with quoted comma cells into a stable golden bundle', async () => {
    const inputs = await loadLedgerInputs();
    const rows = parseLedgerCsvInputs(inputs);

    expect(rows.ok).toBe(true);
    if (!rows.ok) throw new Error(rows.issues.join('\n'));
    expect(rows.value.capability.find(row => row.id === 'artifacts')?.capability).toBe(
      'Prompt packages, capsules, ledgers, dossiers'
    );
    expect(rows.value.capability.find(row => row.id === 'tools')?.current_surface).toBe(
      'MCP, Context7, OpenAI docs, graph, CLI, git'
    );

    const bundle = buildLedgerBundle(inputs);
    expect(bundle.ok).toBe(true);
    if (!bundle.ok) throw new Error(bundle.issues.join('\n'));

    const expected = await loadExpectedBundle();
    expect(bundle.value).toEqual(expected);
    expect(serializeLedgerBundle(bundle.value)).toBe(serializeLedgerBundle(expected));
    expect(parseLedgerBundle(expected).ok).toBe(true);
    expect(renderLedgerBundleSummary(bundle.value)).toContain('requiredCommandOwner: aco-ledgers');
  });

  test('CSV parser round-trips quoted fields and fails on broken quotes', () => {
    const parsed = parseCsv('name,summary\none,"two, three"\nquoted,"a ""quote"""\n');

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
    expect(parsed.value[1]).toEqual(['one', 'two, three']);
    expect(parsed.value[2]).toEqual(['quoted', 'a "quote"']);
    expect(stringifyCsv(parsed.value)).toBe(
      'name,summary\none,"two, three"\nquoted,"a ""quote"""\n'
    );
    expect(parseCsv('name\n"unterminated\n').ok).toBe(false);
  });

  test('builds object inputs without filesystem dependencies', async () => {
    const csvInputs = await loadLedgerInputs();
    const rows = parseLedgerCsvInputs(csvInputs);
    expect(rows.ok).toBe(true);
    if (!rows.ok) throw new Error(rows.issues.join('\n'));

    const bundle = buildLedgerBundle(rows.value);
    expect(bundle.ok).toBe(true);
    if (!bundle.ok) throw new Error(bundle.issues.join('\n'));
    expect(bundle.value.counts.total).toBe(70);
    expect(
      bundle.value.commands.find(command => command.subject.command === REQUIRED_COMMAND)
    ).toMatchObject({
      owner: 'aco-ledgers',
      mutates: 'writes-artifacts',
      approvalRequired: false,
      compatibility: 'preserve',
    });
  });
});

export const REQUIRED_COMMAND = 'archon context ledgers [prompt] [--no-write-artifact]';

export async function loadLedgerInputs(): Promise<LedgerCsvInputs> {
  const root = new URL('../../../tests/fixtures/aco/ledgers/', import.meta.url);
  return {
    artifact: await Bun.file(new URL('artifact-ledger.csv', root)).text(),
    capability: await Bun.file(new URL('capability-inventory.csv', root)).text(),
    command: await Bun.file(new URL('command-ledger.csv', root)).text(),
    risk: await Bun.file(new URL('risk-ledger.csv', root)).text(),
    tool: await Bun.file(new URL('tool-availability-ledger.csv', root)).text(),
    unknowns: await Bun.file(new URL('unknowns-ledger.csv', root)).text(),
    workflow: await Bun.file(new URL('workflow-ledger.csv', root)).text(),
  };
}

export async function loadLedgerObjectInputs(): Promise<LedgerObjectInputs> {
  const inputs = await loadLedgerInputs();
  const rows = parseLedgerCsvInputs(inputs);
  if (!rows.ok) throw new Error(rows.issues.join('\n'));
  return rows.value;
}

async function loadExpectedBundle(): Promise<unknown> {
  return Bun.file(
    new URL('../../../tests/fixtures/aco/ledger-bundle.expected.json', import.meta.url)
  ).json();
}
