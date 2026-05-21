import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { getGraphContext } from './graph';
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

  test('AC-CONFIDENCE-002 summary counts reconcile for every ledger section', () => {
    const bundle = normalizeLedgerBundle(
      minimalBundle({
        toolAvailability: [
          { ...toolEntry('tool.available'), status: 'available' },
          { ...toolEntry('tool.partial'), status: 'partial' },
          { ...toolEntry('tool.deferred'), status: 'deferred' },
          { ...toolEntry('tool.unknown'), status: 'unknown', sourceEvidence: 'unknown' },
        ],
        commands: [
          { ...commandEntry('cmd.available'), status: 'available' },
          { ...commandEntry('cmd.forbidden'), status: 'forbidden' },
          { ...commandEntry('cmd.blocked'), status: 'blocked' },
        ],
      })
    );

    expectSummaryCountsReconcile(bundle.summary.toolAvailability);
    expectSummaryCountsReconcile(bundle.summary.commands);
    expectSummaryCountsReconcile(bundle.summary.combined);
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

  test('AC-CONFIDENCE-005 represents mutating commands as forbidden and approval-required guardrails', () => {
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

  test('AC-CONFIDENCE-003 records observed git status evidence instead of unexplained unknown', async () => {
    const bundle = await buildLedgerBundle({
      cwd: '/tmp/aco-ledger-no-history',
      timestamp,
      graphContext: graphContext(),
      documentationPlan: documentationPlan(),
      bmadRoute: bmadRoute(),
      acceptancePlan: {
        status: 'ready',
        scenarios: [],
      },
      selectedCapabilities: { capabilities: [] },
      validationReport: { status: 'warning', checks: [] },
      packageScripts: {},
      repositoryStatus: {
        status: 'available',
        sourceEvidence: 'git status exited 0; clean=true; tracked=0; untracked=0.',
        verification: 'Worktree is clean.',
        notes: 'No tracked or untracked files reported.',
        confidence: 'observed',
      },
    });
    const toolGitStatus = bundle.toolAvailability.find(entry => entry.id === 'tool.git-status');
    const commandGitStatus = bundle.commands.find(entry => entry.id === 'cmd.git-status');

    expect(toolGitStatus?.status).toBe('available');
    expect(toolGitStatus?.sourceEvidence).toContain('clean=true');
    expect(toolGitStatus?.confidence).toBe('observed');
    expect(commandGitStatus?.status).toBe('available');
    expect(commandGitStatus?.sourceEvidence).toContain('tracked=0');
  });

  test('records cmd.aco-test-acceptance as read-only validation evidence', async () => {
    const bundle = await buildLedgerBundle({
      cwd: '/tmp/aco-ledger-no-history',
      timestamp,
      graphContext: graphContext(),
      documentationPlan: documentationPlan(),
      bmadRoute: bmadRoute(),
      acceptancePlan: {
        status: 'ready',
        scenarios: [],
      },
      selectedCapabilities: { capabilities: [] },
      validationReport: {
        status: 'passed',
        checks: [
          {
            id: 'aco-acceptance',
            status: 'passed',
            message:
              'ACO acceptance reality check passed for API, slash command, workflow, and events.',
          },
        ],
      },
      packageScripts: {
        'aco:test:acceptance': 'bun test ./tests/acceptance/context-orchestrator/*.test.ts',
      },
      repositoryStatus: {
        status: 'available',
        sourceEvidence: 'git status exited 0; clean=true; tracked=0; untracked=0.',
        verification: 'Worktree is clean.',
        notes: 'No tracked or untracked files reported.',
        confidence: 'observed',
      },
    });
    const acceptanceCommand = bundle.commands.find(entry => entry.id === 'cmd.aco-test-acceptance');

    expect(acceptanceCommand?.status).toBe('available');
    expect(acceptanceCommand?.command).toBe('bun run aco:test:acceptance');
    expect(acceptanceCommand?.safety).toBe('read-only');
    expect(acceptanceCommand?.mutatesTrackedFiles).toBe(false);
    expect(acceptanceCommand?.requiresApproval).toBe(false);
  });

  test('AC-CONFIDENCE-003 includes named graph waivers as explicit confidence limits', async () => {
    const bundle = await buildLedgerBundle({
      cwd: '/tmp/aco-ledger-no-history',
      timestamp,
      graphContext: graphContext(),
      documentationPlan: documentationPlan(),
      bmadRoute: bmadRoute(),
      acceptancePlan: {
        status: 'ready',
        scenarios: [],
      },
      selectedCapabilities: { capabilities: [] },
      validationReport: { status: 'warning', checks: [] },
      packageScripts: {},
      repositoryStatus: {
        status: 'blocked',
        sourceEvidence: 'git status failed: not a git repository.',
        verification: 'Git repository unavailable.',
        notes: 'Repository status could not be observed.',
        confidence: 'observed',
      },
    });
    const graphEntry = bundle.toolAvailability.find(entry => entry.id === 'tool.graph-evidence');

    expect(graphEntry?.status).toBe('partial');
    expect(graphEntry?.notes).toContain('graph-waiver.sample-upstream');
    expect(graphEntry?.notes).toContain('owner=context-orchestrator');
    expect(graphEntry?.notes).toContain('expiry=');
    expect(graphEntry?.sourceEvidence).toContain('graph-waiver.sample-upstream');
  });

  test('AC-FORBIDDEN-GRAPH-001 marks failed waiver-required graph evidence as forbidden graph waivers', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'aco-forbidden-graph-'));
    const manifestDir = join(cwd, 'docs/context-orchestrator/research');
    await mkdir(manifestDir, { recursive: true });
    await writeFile(
      join(manifestDir, 'upstream-manifest.json'),
      JSON.stringify(
        {
          repositories: [
            {
              name: 'bmad-plugins-marketplace',
              cloneStatus: 'fetched',
              graphStatus: 'failed',
              waiverRequired: true,
              error: 'Graphify failed for marketplace repository.',
            },
            {
              name: 'bmad-sample-data',
              cloneStatus: 'fetched',
              graphStatus: 'failed',
              waiverRequired: true,
              error: 'Graphify failed for sample data repository.',
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    const context = await getGraphContext({ cwd });

    expect(context.status).toBe('forbidden');
    expect(context.waivers.map(waiver => waiver.id)).toEqual([
      'graph-waiver.bmad-plugins-marketplace',
      'graph-waiver.bmad-sample-data',
    ]);
    expect(context.summary).toContain('failed graph waiver(s) forbidden');
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
    contextIntent: {
      objective: 'test objective',
      normalizedObjective: 'test objective',
      intentHash: 'intent-test',
      cwd: '/repo',
      commitSha: 'abc123',
      generatedAt: timestamp,
    },
    toolAvailability: (overrides.toolAvailability ?? [
      toolEntry('tool.base'),
    ]) as ToolAvailabilityLedgerEntry[],
    commands: (overrides.commands ?? [commandEntry('cmd.base')]) as CommandLedgerEntry[],
    evidenceBlockers: [],
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
    lastVerifiedAt: timestamp,
    verificationSource: `source ${id}`,
    verificationMethod: 'command',
    sourceArtifact: `invoke ${id}`,
    nextVerificationAction: `fallback ${id}`,
    freshness: 'fresh',
    notes: `notes ${id}`,
    confidence: 'observed',
    evidence: [
      {
        sourceType: 'command',
        sourceEvidence: `source ${id}`,
        invocationPath: `invoke ${id}`,
        confidence: 'observed',
        reason: `reason ${id}`,
        lastVerifiedAt: timestamp,
        verificationSource: `source ${id}`,
        verificationMethod: 'command',
        sourceArtifact: `invoke ${id}`,
        nextVerificationAction: `fallback ${id}`,
        freshness: 'fresh',
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
    lastVerifiedAt: timestamp,
    verificationSource: `source ${id}`,
    verificationMethod: 'command',
    sourceArtifact: `invoke ${id}`,
    nextVerificationAction: `fallback ${id}`,
    freshness: 'fresh',
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
        lastVerifiedAt: timestamp,
        verificationSource: `source ${id}`,
        verificationMethod: 'command',
        sourceArtifact: `invoke ${id}`,
        nextVerificationAction: `fallback ${id}`,
        freshness: 'fresh',
      },
    ],
  };
}

function graphContext(): GraphContext {
  return {
    status: 'partial',
    repositories: [],
    waiverCount: 1,
    waivers: [
      {
        id: 'graph-waiver.sample-upstream',
        repository: 'sample-upstream',
        owner: 'context-orchestrator',
        reason: 'Graphify failed for non-controlling sample upstream.',
        evidence: 'upstream-manifest.json sample-upstream waiverRequired=true.',
        expiryCondition:
          'Regenerate graph evidence successfully or remove sample-upstream dependency.',
      },
    ],
    summary: 'Graph evidence partial; waivers=graph-waiver.sample-upstream.',
  };
}

function documentationPlan(): DocumentationPlan {
  return {
    readiness: {
      openaiDocsMcp: 'deferred_by_design',
      context7: 'deferred_by_design',
    },
    integrations: [
      {
        id: 'openai-docs-mcp',
        label: 'OpenAI Docs MCP',
        state: 'deferred_by_design',
        reason: 'No OpenAI docs target in fixture.',
        checkedAt: 'fixture',
        networkAccess: 'not_attempted',
      },
      {
        id: 'context7',
        label: 'Context7',
        state: 'deferred_by_design',
        reason: 'No Context7 target in fixture.',
        checkedAt: 'fixture',
        networkAccess: 'not_attempted',
      },
    ],
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
    confidence: 'high',
    matchedSignals: ['architecture'],
    rejectedAlternatives: [],
    fallbackBehavior: 'Stop for clarification if evidence is missing.',
    nextRecommendedAction: 'Generate project context before architecture.',
    requiresDecision: false,
  };
}

function expectSummaryCountsReconcile(summary: LedgerBundle['summary']['combined']): void {
  const counted = ledgerStatusOrder.reduce((total, status) => total + summary.counts[status], 0);
  expect(counted).toBe(summary.total);
}
