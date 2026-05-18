import { describe, expect, test } from 'bun:test';
import {
  buildLedgerBundle,
  ledgerStatusOrder,
  normalizeLedgerBundle,
  renderCommandsLedgerMarkdown,
  renderLedgerBundleMarkdown,
  serializeLedgerBundle,
} from './ledgers';
import type {
  BmadRoute,
  CommandLedgerEntry,
  DocumentationPlan,
  GraphContext,
  LedgerBundle,
  ToolAvailabilityLedgerEntry,
} from './types';

const timestamp = '2026-05-18T12:00:00.000Z';

describe('ACO ledgers', () => {
  test('AC-LEDGER-001 exposes exact generic status vocabulary', () => {
    expect(ledgerStatusOrder).toEqual([
      'available',
      'partial',
      'blocked',
      'deferred',
      'forbidden',
      'not used',
      'unknown',
    ]);
  });

  test('rejects invalid statuses', () => {
    const bundle = minimalBundle({
      toolAvailability: [{ ...toolEntry('tool.bad'), status: 'ready' }],
    });

    expect(() => normalizeLedgerBundle(bundle as unknown as LedgerBundle)).toThrow(
      'Invalid ledger status'
    );
  });

  test('AC-LEDGER-002 serializes deterministically by stable IDs', () => {
    const first = minimalBundle({
      toolAvailability: [toolEntry('tool.z'), toolEntry('tool.a')],
      commands: [commandEntry('cmd.z'), commandEntry('cmd.a')],
    });
    const second = minimalBundle({
      toolAvailability: [toolEntry('tool.a'), toolEntry('tool.z')],
      commands: [commandEntry('cmd.a'), commandEntry('cmd.z')],
    });

    expect(JSON.stringify(serializeLedgerBundle(normalizeLedgerBundle(first)))).toBe(
      JSON.stringify(serializeLedgerBundle(normalizeLedgerBundle(second)))
    );
    expect(normalizeLedgerBundle(first).toolAvailability.map(entry => entry.id)).toEqual([
      'tool.a',
      'tool.z',
    ]);
  });

  test('AC-LEDGER-003 preserves unknown blocked and partial statuses', () => {
    const normalized = normalizeLedgerBundle(
      minimalBundle({
        toolAvailability: [
          { ...toolEntry('tool.unknown'), status: 'unknown', sourceEvidence: 'unknown' },
          { ...toolEntry('tool.blocked'), status: 'blocked' },
          { ...toolEntry('tool.partial'), status: 'partial' },
        ],
      })
    );

    expect(normalized.toolAvailability.map(entry => entry.status)).toEqual([
      'blocked',
      'partial',
      'unknown',
    ]);
    expect(normalized.summary.toolAvailability.counts.unknown).toBe(1);
    expect(normalized.summary.toolAvailability.counts.blocked).toBe(1);
    expect(normalized.summary.toolAvailability.counts.partial).toBe(1);
  });

  test('renders both Tool Availability and Commands ledgers as Markdown', () => {
    const normalized = normalizeLedgerBundle(minimalBundle({}));
    const markdown = renderLedgerBundleMarkdown(normalized);

    expect(markdown).toContain('# Tool Availability Ledger');
    expect(markdown).toContain('# Commands Ledger');
    expect(markdown).toContain('tool.base');
    expect(markdown).toContain('cmd.base');
  });

  test('represents mutating commands as forbidden and approval-required', () => {
    const markdown = renderCommandsLedgerMarkdown([
      {
        ...commandEntry('cmd.mutating'),
        status: 'forbidden',
        mutatesTrackedFiles: true,
        requiresApproval: true,
        safety: 'writes-tracked-files',
        notes: 'Forbidden during read-only discovery because it writes tracked files.',
      },
    ]);

    expect(markdown).toContain('forbidden');
    expect(markdown).toContain('writes-tracked-files');
    expect(markdown).toContain('true');
  });

  test('AC-LEDGER-006 redacts secret-like values from JSON and Markdown', () => {
    const normalized = normalizeLedgerBundle(
      minimalBundle({
        toolAvailability: [
          {
            ...toolEntry('tool.secret'),
            sourceEvidence: 'SECRET_TOKEN=hidden-value',
            notes: 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz',
          },
        ],
      })
    );
    const serialized = JSON.stringify(serializeLedgerBundle(normalized));
    const markdown = renderLedgerBundleMarkdown(normalized);

    expect(serialized).not.toContain('hidden-value');
    expect(serialized).not.toContain('abcdefghijklmnopqrstuvwxyz');
    expect(markdown).not.toContain('hidden-value');
    expect(markdown).not.toContain('abcdefghijklmnopqrstuvwxyz');
  });

  test('AC-LEDGER-001 builds without .history dependency', async () => {
    const bundle = await buildLedgerBundle({
      cwd: '/tmp/aco-ledger-no-history',
      timestamp,
      graphContext: graphContext(),
      documentationPlan: documentationPlan(),
      bmadRoute: bmadRoute(),
      acceptancePlan: {
        status: 'ready',
        scenarios: [
          {
            id: 'AC-LEDGER-001',
            spec: '017-implementation-discovery-protocol.md',
            given: 'no .history directory',
            when: 'ledger bundle builds',
            then: 'bundle still renders',
          },
        ],
      },
      selectedCapabilities: { capabilities: [] },
      validationReport: { status: 'warning', checks: [] },
      packageScripts: {
        test: 'bun test',
        'type-check': 'bun x tsc --noEmit',
        'format:check': 'bun x prettier --check .',
      },
    });

    expect(bundle.schemaVersion).toBe('aco.ledger-bundle.v1');
    expect(JSON.stringify(bundle)).not.toContain('.history/scripts/context-orchestrator');
  });
});

function minimalBundle(overrides: {
  toolAvailability?: Array<ToolAvailabilityLedgerEntry | Record<string, unknown>>;
  commands?: Array<CommandLedgerEntry | Record<string, unknown>>;
}): Omit<LedgerBundle, 'summary'> {
  return {
    schemaVersion: 'aco.ledger-bundle.v1',
    generatedAt: timestamp,
    toolAvailability: (overrides.toolAvailability ?? [
      toolEntry('tool.base'),
    ]) as ToolAvailabilityLedgerEntry[],
    commands: (overrides.commands ?? [commandEntry('cmd.base')]) as CommandLedgerEntry[],
  };
}

function toolEntry(id: string): ToolAvailabilityLedgerEntry {
  return {
    id,
    name: `Tool ${id}`,
    category: 'test',
    status: 'available',
    sourceEvidence: `source ${id}`,
    invocationPath: `invoke ${id}`,
    scope: `scope ${id}`,
    preconditions: `preconditions ${id}`,
    verification: `verification ${id}`,
    primaryUse: `primary use ${id}`,
    failureMode: `failure ${id}`,
    fallback: `fallback ${id}`,
    owner: 'test',
    lastVerified: '2026-05-18',
    notes: `notes ${id}`,
    confidence: 'observed',
    evidence: [
      {
        sourceType: 'command',
        sourceEvidence: `source ${id}`,
        invocationPath: `invoke ${id}`,
        confidence: 'observed',
        reason: `reason ${id}`,
      },
    ],
  };
}

function commandEntry(id: string): CommandLedgerEntry {
  return {
    id,
    command: `command ${id}`,
    category: 'test',
    status: 'available',
    sourceEvidence: `source ${id}`,
    invocationPath: `invoke ${id}`,
    scope: `scope ${id}`,
    preconditions: `preconditions ${id}`,
    verification: `verification ${id}`,
    primaryUse: `primary use ${id}`,
    failureMode: `failure ${id}`,
    fallback: `fallback ${id}`,
    owner: 'test',
    lastVerified: '2026-05-18',
    mutatesTrackedFiles: false,
    requiresApproval: false,
    safety: 'read-only',
    notes: `notes ${id}`,
    confidence: 'observed',
    evidence: [
      {
        sourceType: 'command',
        sourceEvidence: `source ${id}`,
        invocationPath: `invoke ${id}`,
        confidence: 'observed',
        reason: `reason ${id}`,
      },
    ],
  };
}

function graphContext(): GraphContext {
  return {
    status: 'partial',
    repositories: [],
    waiverCount: 1,
    summary: 'Graph evidence partial.',
  };
}

function documentationPlan(): DocumentationPlan {
  return {
    readiness: {
      openaiDocsMcp: 'available',
      context7: 'available',
    },
    targets: [],
    unresolved: [],
  };
}

function bmadRoute(): BmadRoute {
  return {
    id: 'brownfield-architecture',
    label: 'Brownfield architecture-sensitive route',
    steps: ['bmad-index-docs'],
    rationale: 'Test route.',
  };
}
