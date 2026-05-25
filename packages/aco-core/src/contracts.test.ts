import { describe, expect, test } from 'bun:test';
import {
  createRegistry,
  parseAcoPath,
  parseArtifactRef,
  parseGateRunResult,
  parseLedgerEntry,
  parseReferenceSurfacePlan,
} from './index';
import type { Gate, GateRunResult, LedgerEntry, RegistryContract } from './index';

interface TestContract extends RegistryContract<'test-contract'> {
  readonly label: string;
}

const evidence = [
  {
    id: 'evidence.unit',
    source: 'unit-test',
    summary: 'unit test evidence',
    confidence: 'high',
    freshness: 'fresh',
  },
] as const;

describe('createRegistry', () => {
  test('registers contracts immutably and freezes after bootload', () => {
    const empty = createRegistry<'test-contract', TestContract>('test-contract');
    const one = empty.register({ kind: 'test-contract', id: 'b', label: 'second' });
    const two = one.register({ kind: 'test-contract', id: 'a', label: 'first' });

    expect(empty.list()).toEqual([]);
    expect(two.list().map(item => item.id)).toEqual(['a', 'b']);
    expect(two.get('a')?.label).toBe('first');

    const bootloaded = two.bootload();
    expect(bootloaded.bootloaded).toBe(true);
    expect(() => bootloaded.register({ kind: 'test-contract', id: 'c', label: 'third' })).toThrow(
      'immutable after bootload'
    );
  });

  test('rejects duplicate ids before bootload', () => {
    const registry = createRegistry<'test-contract', TestContract>('test-contract').register({
      kind: 'test-contract',
      id: 'same',
      label: 'one',
    });

    expect(() => registry.register({ kind: 'test-contract', id: 'same', label: 'two' })).toThrow(
      'already has id same'
    );
  });
});

describe('schemas', () => {
  test('rejects malformed artifact refs at unknown boundary', () => {
    const malformed = parseArtifactRef({
      kind: 'artifact-ref',
      id: 'capsule',
      schemaVersion: 'aco.bootstrap.v1',
      path: 'relative/file.json',
      sha256: 'not-a-sha',
      evidence,
    });

    expect(malformed.ok).toBe(false);
  });

  test('accepts valid artifact refs and brands artifact path', () => {
    const parsed = parseArtifactRef<'aco.bootstrap.v1'>({
      kind: 'artifact-ref',
      id: 'capsule',
      schemaVersion: 'aco.bootstrap.v1',
      path: '/repo/artifacts/capsule.json',
      sha256: 'a'.repeat(64),
      evidence,
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.path).toBe('/repo/artifacts/capsule.json');
    }
  });

  test('parses gate result discriminated union states', async () => {
    const gate: Gate<{ readonly ok: boolean }, string> = {
      kind: 'gate',
      id: 'gate.unit',
      mutates: 'read-only',
      run(input: { readonly ok: boolean }): Promise<GateRunResult<string>> {
        if (input.ok) {
          return Promise.resolve({ status: 'passed', value: 'done', evidence });
        }
        return Promise.resolve({ status: 'unknown', reason: 'missing input', evidence });
      },
    };

    expect(parseGateRunResult(await gate.run({ ok: true })).ok).toBe(true);
    expect(parseGateRunResult(await gate.run({ ok: false })).ok).toBe(true);
    expect(parseGateRunResult({ status: 'failed', errors: [], evidence }).ok).toBe(false);
  });

  test('parses ledger entries with typed subject and status', () => {
    const parsed = parseLedgerEntry<{ readonly command: string }, 'available'>({
      kind: 'ledger-entry',
      id: 'cmd.status',
      subject: { command: 'archon aco status' },
      status: 'available',
      confidence: 'high',
      freshness: 'fresh',
      evidence,
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const entry: LedgerEntry<{ readonly command: string }, 'available'> = parsed.value;
      expect(entry.subject.command).toBe('archon aco status');
      expect(entry.status).toBe('available');
    }
  });
});

describe('branded paths', () => {
  test('accepts absolute paths for every root kind', () => {
    expect(parseAcoPath('repo', '/repo').ok).toBe(true);
    expect(parseAcoPath('source', '/repo/source').ok).toBe(true);
    expect(parseAcoPath('artifact', '/repo/artifacts').ok).toBe(true);
    expect(parseAcoPath('worktree', '/repo/worktrees/feature').ok).toBe(true);
    expect(parseAcoPath('graph-cache', '/repo/graph-cache').ok).toBe(true);
    expect(parseAcoPath('user-config', '/home/user/.archon').ok).toBe(true);
  });

  test('rejects relative, null-byte, and traversal paths', () => {
    expect(parseAcoPath('repo', 'relative').ok).toBe(false);
    expect(parseAcoPath('repo', '/repo/\0bad').ok).toBe(false);
    expect(parseAcoPath('repo', '/repo/../other').ok).toBe(false);
  });
});

describe('reference surface fixture', () => {
  test('captures required preserved surfaces from stabilization oracle ledgers', async () => {
    const fixture = await Bun.file(
      new URL('../../../tests/fixtures/aco/reference-surface-plan.json', import.meta.url)
    ).json();
    const parsed = parseReferenceSurfacePlan(fixture);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const commandText = parsed.value.commands.map(command => command.command).join('\n');
    const capabilityIds = new Set(parsed.value.capabilities.map(capability => capability.id));

    expect(commandText).toContain('archon aco status');
    expect(commandText).toContain('archon aco bootstrap-codex');
    expect(commandText).toContain('archon context status');
    expect(commandText).toContain('archon context ledgers');
    expect(commandText).toContain('archon context route');
    expect(commandText).toContain('archon context compile');
    expect(commandText).toContain('archon context approval-capsule');
    expect(commandText).toContain('archon context graph-waivers');
    expect(commandText).toContain('archon context validate');
    expect(capabilityIds.has('workflows')).toBe(true);
    expect(parsed.value.requiredSurfaceAssertions).toEqual(
      expect.arrayContaining([
        '/aco:bootstrap-codex',
        'archon aco status',
        'all archon context commands',
        'context-orchestrate',
        'archon-aco-adversarial-loop',
      ])
    );
  });
});
