import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  discoverAvailableCommands,
  validateCommand,
} from '../../../packages/workflows/src/validator';
import {
  buildAcoBootstrapContext,
  buildCapabilitySnapshot,
  runAcoBootstrapCodexCommand,
  type AcoBootstrapEvent,
} from '../../../packages/context-orchestrator/src/index';

const timestamp = '2026-05-24T12:00:00.000Z';
const commandSpec = 'docs/context-orchestrator/specs/024-aco-codex-bootstrap-command.md';
const commandName = 'aco-bootstrap-codex';

describe('ACO Codex bootstrap command acceptance', () => {
  test('Spec: 024-aco-codex-bootstrap-command.md Acceptance: ACO-CODEX-CMD-001 command discoverable in Archon registry/catalog/help', async () => {
    const commands = await discoverAvailableCommands(process.cwd());
    const validation = await validateCommand(commandName, process.cwd());
    const [defaultCommand, cliSource, slashSource, docsSource] = await Promise.all([
      readFile(join(process.cwd(), '.archon/commands/defaults/aco-bootstrap-codex.md'), 'utf8'),
      readFile(join(process.cwd(), 'packages/cli/src/cli.ts'), 'utf8'),
      readFile(join(process.cwd(), 'packages/core/src/handlers/command-handler.ts'), 'utf8'),
      readFile(
        join(
          process.cwd(),
          'packages/docs-web/src/content/docs/guides/context-orchestrator-aco.md'
        ),
        'utf8'
      ),
    ]);

    expect(commands).toContain(commandName);
    expect(validation.valid).toBe(true);
    expect(defaultCommand).toContain('/aco:bootstrap-codex');
    expect(cliSource).toContain('aco bootstrap-codex');
    expect(slashSource).toContain("case 'aco:bootstrap-codex'");
    expect(docsSource).toContain(
      '/aco:bootstrap-codex --event SessionStart --max-bytes 4000 --format markdown --write-artifact'
    );
  });

  test('Spec: 024-aco-codex-bootstrap-command.md Acceptance: ACO-CODEX-CMD-002 handler reuses bootstrap context and capability snapshot builders', async () => {
    const source = await readFile(
      join(process.cwd(), 'packages/context-orchestrator/src/bootstrap-command.ts'),
      'utf8'
    );
    const routerSource = await readFile(
      join(process.cwd(), 'packages/context-orchestrator/src/capabilities.ts'),
      'utf8'
    );

    expect(source).toContain('buildCapabilitySnapshot');
    expect(source).toContain('buildAcoBootstrapContext');
    expect(source).toContain('snapshot: capabilitySnapshot');
    expect(routerSource).not.toContain('codex-bootstrap-fixture-provider');
    expect(routerSource).not.toContain('/aco:bootstrap-codex');
  });

  test('Spec: 024-aco-codex-bootstrap-command.md Acceptance: ACO-CODEX-CMD-003 max-bytes 4000 emits compact event-specific context', async () => {
    const cwd = await writeBootstrapCommandFixture();
    const result = await runAcoBootstrapCodexCommand({
      cwd,
      prompt: 'Route through ACO before tool use.',
      event: 'PreToolUse',
      maxBytes: 4_000,
      format: 'markdown',
      writeArtifact: false,
      timestamp,
    });

    expect(result.schemaVersion).toBe('aco.bootstrap-codex-command.v1');
    expect(result.command).toBe('/aco:bootstrap-codex');
    expect(result.event).toBe('PreToolUse');
    expect(result.output.format).toBe('markdown');
    expect(result.output.bytes).toBeLessThanOrEqual(4_000);
    expect(result.output.text).toContain('Event: PreToolUse');
    expect(result.output.text).toContain('forbidden ledger commands');
    expect(result.output.text).toContain('Snapshot Ref');
    expect(result.output.text).toContain('Evidence Summary');
    expect(result.output.text).toContain('Risks and Unknowns');
    expect(result.budget.maxBytes).toBe(4_000);
  });

  test('Spec: 024-aco-codex-bootstrap-command.md Acceptance: ACO-CODEX-CMD-004 writes safe capsule snapshot and evidence artifacts', async () => {
    const cwd = await writeBootstrapCommandFixture();
    const result = await runAcoBootstrapCodexCommand({
      cwd,
      prompt: 'Use token=sk-testsecret123456 safely.',
      event: 'SessionStart',
      maxBytes: 4_000,
      format: 'markdown',
      writeArtifact: true,
      timestamp,
    });

    expect(result.artifacts).toBeDefined();
    expect(result.artifacts?.capsuleMarkdown).toMatch(
      /^\.archon\/artifacts\/context-orchestrator\//
    );
    expect(result.artifacts?.snapshotJson).toMatch(/^\.archon\/artifacts\/context-orchestrator\//);
    expect(result.artifacts?.evidenceJsonl).toMatch(/^\.archon\/artifacts\/context-orchestrator\//);

    const files = [
      result.artifacts?.capsuleMarkdown,
      result.artifacts?.capsuleJson,
      result.artifacts?.snapshotJson,
      result.artifacts?.evidenceJsonl,
    ].filter((value): value is string => typeof value === 'string');
    for (const relativePath of files) {
      expect(relativePath.startsWith('/')).toBe(false);
      expect(existsSync(join(cwd, relativePath))).toBe(true);
      const emitted = await readFile(join(cwd, relativePath), 'utf8');
      expect(emitted).not.toContain('sk-testsecret');
      expect(emitted).not.toContain('token=sk-testsecret');
    }
    expect(result.mutationReport.userConfigMutated).toBe(false);
    expect(result.mutationReport.activeHooksChanged).toBe(false);
    expect(result.mutationReport.graphRefreshAttempted).toBe(false);
  });

  test('Spec: 024-aco-codex-bootstrap-command.md Acceptance: ACO-CODEX-CMD-005 evidence-backed claims and unknown/deferred claims are reported', async () => {
    const cwd = await writeBootstrapCommandFixture();
    const result = await runAcoBootstrapCodexCommand({
      cwd,
      prompt: 'Use docs and future provider manifest.',
      event: 'SessionStart',
      maxBytes: 4_000,
      format: 'json',
      writeArtifact: false,
      timestamp,
    });

    expect(result.evidenceSummary.claims.length).toBeGreaterThan(0);
    for (const claim of result.evidenceSummary.claims) {
      expect(claim.confidence).toBeDefined();
      expect(typeof claim.safeToInject).toBe('boolean');
      expect(claim.budget.estimatedBytes).toBeGreaterThanOrEqual(0);
      if (claim.status === 'verified') {
        expect(claim.sourceArtifact ?? claim.command ?? claim.verificationSource).toBeDefined();
        expect(claim.verificationSource).not.toBe('unknown');
      } else {
        expect(['unknown', 'blocked', 'deferred']).toContain(claim.status);
      }
    }
    expect(result.risksUnknowns.unknowns.length).toBeGreaterThan(0);
  });

  test('Spec: 024-aco-codex-bootstrap-command.md Acceptance: ACO-CODEX-CMD-006 supports markdown and JSON with same event and snapshot identity', async () => {
    const cwd = await writeBootstrapCommandFixture();
    const base = {
      cwd,
      prompt: 'Bootstrap Codex capsule.',
      event: 'UserPromptSubmit' as AcoBootstrapEvent,
      maxBytes: 4_000,
      writeArtifact: false,
      timestamp,
    };
    const markdown = await runAcoBootstrapCodexCommand({ ...base, format: 'markdown' });
    const json = await runAcoBootstrapCodexCommand({ ...base, format: 'json' });

    expect(markdown.output.format).toBe('markdown');
    expect(json.output.format).toBe('json');
    expect(JSON.parse(json.output.text)).toHaveProperty('event', 'UserPromptSubmit');
    expect(markdown.event).toBe(json.event);
    expect(markdown.snapshotRef.generatedAt).toBe(json.snapshotRef.generatedAt);
    expect(markdown.bootstrapContext.generatedAt).toBe(json.bootstrapContext.generatedAt);
  });

  test('Spec: 024-aco-codex-bootstrap-command.md Acceptance: ACO-CODEX-CMD-007 Stop evaluator emits continuation and next /goal', async () => {
    const cwd = await writeBootstrapCommandFixture();
    const result = await runAcoBootstrapCodexCommand({
      cwd,
      prompt: 'Finish bootstrap command validation.',
      event: 'Stop',
      maxBytes: 4_000,
      format: 'markdown',
      writeArtifact: false,
      evaluator: true,
      goalStatus: 'incomplete',
      nextGoalObjective: 'Continue ACO Codex bootstrap command validation.',
      timestamp,
    });

    expect(result.continuation.required).toBe(true);
    expect(result.continuation.nextGoal).toContain(
      '/goal Continue ACO Codex bootstrap command validation.'
    );
    expect(result.output.text).toContain('Evaluator continuation');
  });

  test('Spec: 024-aco-codex-bootstrap-command.md Acceptance: ACO-CODEX-CMD-008 PreToolUse and PermissionRequest emit guard capsules', async () => {
    const cwd = await writeBootstrapCommandFixture();
    for (const event of ['PreToolUse', 'PermissionRequest'] as const) {
      const result = await runAcoBootstrapCodexCommand({
        cwd,
        prompt: 'Guard graph refresh and destructive commands.',
        event,
        maxBytes: 4_000,
        format: 'markdown',
        writeArtifact: false,
        timestamp,
      });
      const output = result.output.text.toLowerCase();
      expect(output).toContain('forbidden');
      expect(output).toContain('graph refresh');
      expect(output).toContain('destructive');
      expect(output).toContain('secret');
      expect(output).toContain(event === 'PermissionRequest' ? 'approval' : 'guard');
    }
  });

  test('Spec: 024-aco-codex-bootstrap-command.md Acceptance: ACO-CODEX-CMD-009 manifest capabilities appear without router source edits', async () => {
    const cwd = await writeBootstrapCommandFixture();
    const snapshot = await buildCapabilitySnapshot({
      cwd,
      prompt: 'Use codex bootstrap fixture provider.',
      timestamp,
    });
    const context = await buildAcoBootstrapContext({
      cwd,
      prompt: 'Use codex bootstrap fixture provider.',
      event: 'SessionStart',
      maxBytes: 4_000,
      timestamp,
      snapshot,
    });
    const routerSource = await readFile(
      join(process.cwd(), 'packages/context-orchestrator/src/capabilities.ts'),
      'utf8'
    );

    expect(snapshot.providers.map(item => item.id)).toContain('codex-bootstrap-fixture-provider');
    expect(context.json.snapshot.counts.providers).toBeGreaterThan(0);
    expect(routerSource).not.toContain('codex-bootstrap-fixture-provider');
  });

  test('Spec: 024-aco-codex-bootstrap-command.md Acceptance: ACO-CODEX-CMD-010 docs and bundled defaults carry exact command usage', async () => {
    const [spec, docs, defaultCommand, generated] = await Promise.all([
      readFile(join(process.cwd(), commandSpec), 'utf8'),
      readFile(
        join(
          process.cwd(),
          'packages/docs-web/src/content/docs/guides/context-orchestrator-aco.md'
        ),
        'utf8'
      ),
      readFile(join(process.cwd(), '.archon/commands/defaults/aco-bootstrap-codex.md'), 'utf8'),
      readFile(
        join(process.cwd(), 'packages/workflows/src/defaults/bundled-defaults.generated.ts'),
        'utf8'
      ),
    ]);
    const exactUsage =
      '/aco:bootstrap-codex --event SessionStart --max-bytes 4000 --format markdown --write-artifact';

    expect(spec).toContain(exactUsage);
    expect(docs).toContain(exactUsage);
    expect(defaultCommand).toContain(exactUsage);
    expect(generated).toContain('aco-bootstrap-codex');
  });
});

async function writeBootstrapCommandFixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'aco-bootstrap-command-'));
  await mkdir(join(cwd, 'docs/context-orchestrator/specs'), { recursive: true });
  await mkdir(join(cwd, 'docs/context-orchestrator/research'), { recursive: true });
  await mkdir(join(cwd, '.archon/commands/defaults'), { recursive: true });
  await mkdir(join(cwd, '.archon/workflows/defaults'), { recursive: true });
  await mkdir(join(cwd, '.archon/capabilities'), { recursive: true });
  await mkdir(join(cwd, '.archon/artifacts/context-orchestrator/bootstrap-command-fixture'), {
    recursive: true,
  });
  await mkdir(join(cwd, '_bmad/_config'), { recursive: true });
  await mkdir(join(cwd, 'packages/providers/src/fixture'), { recursive: true });

  await writeFile(join(cwd, commandSpec), '# ACO Codex Bootstrap Command\nACO-CODEX-CMD-001\n');
  await writeFile(
    join(cwd, 'package.json'),
    `${JSON.stringify(
      {
        scripts: {
          cli: 'bun --cwd packages/cli src/cli.ts',
          'aco:traceability': 'bun scripts/context-orchestrator/validate-traceability.ts',
          'aco:test:acceptance': 'bun test ./tests/acceptance/context-orchestrator',
        },
      },
      null,
      2
    )}\n`
  );
  await writeFile(join(cwd, '.archon/commands/defaults/fixture.md'), '# Fixture command\n');
  await writeFile(
    join(cwd, '.archon/workflows/defaults/fixture.yaml'),
    'name: fixture-workflow\nnodes:\n  - id: fixture\n'
  );
  await writeFile(
    join(
      cwd,
      '.archon/artifacts/context-orchestrator/bootstrap-command-fixture/commands-ledger.json'
    ),
    `${JSON.stringify({ schemaVersion: 'aco.ledger-bundle.v1', id: 'ledger.fixture' })}\n`
  );
  await writeFile(
    join(cwd, 'docs/context-orchestrator/research/upstream-manifest.json'),
    `${JSON.stringify({
      repositories: [
        {
          name: 'fixture-graph',
          cloneStatus: 'fetched',
          graphStatus: 'complete',
          waiverRequired: false,
          nodes: 3,
          edges: 2,
        },
      ],
    })}\n`
  );
  await writeFile(
    join(cwd, '_bmad/_config/skill-manifest.csv'),
    'canonicalId,name,description,module,path\n"bmad-agent-dev","bmad-agent-dev","Developer role","bmm","_bmad/bmm/4-implementation/bmad-agent-dev/SKILL.md"\n'
  );
  await writeFile(
    join(cwd, '_bmad/_config/manifest.yaml'),
    'installation:\n  version: 6.7.1\nmodules:\n  - name: bmm\nides:\n  - codex\n'
  );
  await writeFile(
    join(cwd, 'packages/providers/src/fixture/capabilities.ts'),
    'export const fixtureCapabilities = { codexBootstrap: true };\n'
  );
  await writeFile(
    join(cwd, '.archon/capabilities/codex-bootstrap-fixture.json'),
    `${JSON.stringify(
      {
        schemaVersion: 'aco.capability-manifest.v1',
        providers: [
          {
            id: 'codex-bootstrap-fixture-provider',
            label: 'Codex Bootstrap Fixture Provider',
          },
        ],
        mcpServers: [{ id: 'mcp.codex-bootstrap-fixture', label: 'Fixture MCP' }],
        plugins: [{ id: 'plugin.codex-bootstrap-fixture', label: 'Fixture Plugin' }],
        commands: [{ id: 'cmd.codex-bootstrap-fixture', label: 'Fixture Command' }],
        ledgers: [{ id: 'ledger.codex-bootstrap-fixture', label: 'Fixture Ledger' }],
      },
      null,
      2
    )}\n`
  );

  return cwd;
}
