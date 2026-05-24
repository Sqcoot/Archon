import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  buildAcoBootstrapContext,
  buildCapabilitySnapshot,
  type AcoBootstrapEvent,
  type CapabilitySnapshot,
} from '../../../packages/context-orchestrator/src/index';

const timestamp = '2026-05-24T12:00:00.000Z';
const specPath =
  'docs/context-orchestrator/specs/023-always-on-aco-bootstrap-and-capability-discovery.md';

describe('ACO bootstrap acceptance', () => {
  test('Spec: 023-always-on-aco-bootstrap-and-capability-discovery.md Acceptance: ACO-BOOTSTRAP-001 every capability claim is evidence-backed or explicitly unknown/blocked/deferred', async () => {
    const cwd = await writeBootstrapFixture();
    const snapshot = await buildCapabilitySnapshot({
      cwd,
      prompt: 'Use Context7 and BMAD to implement a provider.',
      timestamp,
    });

    expect(snapshot.schemaVersion).toBe('aco.capability-snapshot.v1');
    expect(snapshot.sourceRefs.some(ref => ref.path?.endsWith('package.json'))).toBe(true);
    expect(snapshot.evidenceClaims.length).toBeGreaterThan(0);

    for (const claim of snapshot.evidenceClaims) {
      expect(claim.budget.maxBytes).toBeGreaterThan(0);
      expect(typeof claim.safeToInject).toBe('boolean');
      if (claim.status === 'verified') {
        expect(claim.sourceArtifact ?? claim.command).toBeDefined();
        expect(claim.verificationSource).not.toBe('unknown');
      } else {
        expect(['unknown', 'blocked', 'deferred']).toContain(claim.status);
      }
    }
  });

  test('Spec: 023-always-on-aco-bootstrap-and-capability-discovery.md Acceptance: ACO-BOOTSTRAP-002 hook events map to compact event-specific ACO context', async () => {
    const cwd = await writeBootstrapFixture();
    const events: Record<AcoBootstrapEvent, string> = {
      SessionStart: 'bootstrap status',
      UserPromptSubmit: 'route prompt',
      PreToolUse: 'forbidden ledger commands',
      PermissionRequest: 'approval capsule',
      PostToolUse: 'capture evidence',
      PreCompact: 'durable summary',
      PostCompact: 'reload handoff',
      SubagentStart: 'role contract',
      SubagentStop: 'role artifact',
      Stop: 'evaluator continuation',
    };

    for (const [event, marker] of Object.entries(events) as [AcoBootstrapEvent, string][]) {
      const context = await buildAcoBootstrapContext({
        cwd,
        prompt: 'Implement bootstrap event routing.',
        event,
        maxBytes: 4_000,
        timestamp,
        goalStatus: event === 'Stop' ? 'incomplete' : 'unknown',
      });

      expect(context.schemaVersion).toBe('aco.bootstrap-context.v1');
      expect(context.event).toBe(event);
      expect(context.markdown.length).toBeLessThanOrEqual(4_000);
      expect(context.markdown.toLowerCase()).toContain(marker);
    }
  });

  test('Spec: 023-always-on-aco-bootstrap-and-capability-discovery.md Acceptance: ACO-BOOTSTRAP-003 manifests/adapters/ledgers register new capabilities without router rewrites', async () => {
    const cwd = await writeBootstrapFixture();
    const snapshot = await buildCapabilitySnapshot({
      cwd,
      prompt: 'Route through a future provider.',
      timestamp,
    });
    const routerSource = await readFile(
      join(process.cwd(), 'packages/context-orchestrator/src/capabilities.ts'),
      'utf8'
    );

    expect(snapshot.providers.map(item => item.id)).toContain('future-provider.fixture');
    expect(snapshot.mcpServers.map(item => item.id)).toContain('mcp.fixture-docs');
    expect(snapshot.plugins.map(item => item.id)).toContain('plugin.fixture-review');
    expect(snapshot.commands.map(item => item.id)).toContain('cmd.fixture-capability');
    expect(snapshot.ledgers.map(item => item.id)).toContain('ledger.fixture');
    expect(routerSource).not.toContain('future-provider.fixture');
    expect(routerSource).not.toContain('plugin.fixture-review');
  });

  test('Spec: 023-always-on-aco-bootstrap-and-capability-discovery.md Acceptance: ACO-BOOTSTRAP-004 no auth or secrets are emitted in snapshot or bootstrap context', async () => {
    const cwd = await writeBootstrapFixture();
    await mkdir(join(cwd, '.archon/capabilities'), { recursive: true });
    await writeFile(
      join(cwd, '.archon/capabilities/secret-source.json'),
      JSON.stringify({
        schemaVersion: 'aco.capability-manifest.v1',
        providers: [{ id: 'secret-provider', label: 'Secret provider', apiKey: 'sk-testsecret' }],
      })
    );

    const prompt = 'Use OPENAI_API_KEY=sk-testsecret123456 and password=hunter2 safely.';
    const snapshot = await buildCapabilitySnapshot({ cwd, prompt, timestamp });
    const context = await buildAcoBootstrapContext({
      cwd,
      prompt,
      event: 'PreToolUse',
      maxBytes: 4_000,
      timestamp,
    });
    const emitted = `${JSON.stringify(snapshot)}\n${JSON.stringify(context.json)}\n${context.markdown}`;

    expect(emitted).not.toContain('sk-testsecret');
    expect(emitted).not.toContain('hunter2');
    expect(emitted).not.toContain('OPENAI_API_KEY=sk-testsecret');
    expect(emitted).toContain('[REDACTED]');
  });

  test('Spec: 023-always-on-aco-bootstrap-and-capability-discovery.md Acceptance: ACO-BOOTSTRAP-005 Stop/evaluator emits continuation when goal is incomplete', async () => {
    const cwd = await writeBootstrapFixture();
    const context = await buildAcoBootstrapContext({
      cwd,
      prompt: 'Implement ACO bootstrap slice.',
      event: 'Stop',
      maxBytes: 4_000,
      timestamp,
      goalStatus: 'incomplete',
      nextGoalObjective: 'Continue ACO bootstrap validation and handoff.',
    });

    expect(context.json.continuation.required).toBe(true);
    expect(context.json.continuation.reason).toContain('incomplete');
    expect(context.json.continuation.nextGoal).toContain('/goal Continue ACO bootstrap');
    expect(context.markdown).toContain('Evaluator continuation');
    expect(context.markdown).toContain('/goal Continue ACO bootstrap validation and handoff.');
  });
});

async function writeBootstrapFixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'aco-bootstrap-'));
  await mkdir(join(cwd, 'docs/context-orchestrator/specs'), { recursive: true });
  await mkdir(join(cwd, 'docs/context-orchestrator/research'), { recursive: true });
  await mkdir(join(cwd, '.archon/commands/defaults'), { recursive: true });
  await mkdir(join(cwd, '.archon/workflows/defaults'), { recursive: true });
  await mkdir(join(cwd, '.archon/artifacts/context-orchestrator/bootstrap-fixture'), {
    recursive: true,
  });
  await mkdir(join(cwd, '.archon/capabilities'), { recursive: true });
  await mkdir(join(cwd, '_bmad/_config'), { recursive: true });
  await mkdir(join(cwd, 'packages/providers/src/future'), { recursive: true });

  await writeFile(join(cwd, specPath), '# Always-On ACO Bootstrap Fixture\nACO-BOOTSTRAP-001\n');
  await writeFile(
    join(cwd, 'package.json'),
    `${JSON.stringify(
      {
        scripts: {
          cli: 'bun --cwd packages/cli src/cli.ts',
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
    join(cwd, '.archon/artifacts/context-orchestrator/bootstrap-fixture/commands-ledger.json'),
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
    join(cwd, 'packages/providers/src/future/capabilities.ts'),
    'export const futureCapabilities = { hooks: false, mcp: true };\n'
  );
  await writeFile(
    join(cwd, '.archon/capabilities/future-provider.json'),
    `${JSON.stringify(
      {
        schemaVersion: 'aco.capability-manifest.v1',
        providers: [{ id: 'future-provider.fixture', label: 'Future Provider Fixture' }],
        mcpServers: [{ id: 'mcp.fixture-docs', label: 'Fixture Docs MCP' }],
        plugins: [{ id: 'plugin.fixture-review', label: 'Fixture Review Plugin' }],
        commands: [{ id: 'cmd.fixture-capability', label: 'Fixture Capability Command' }],
        ledgers: [{ id: 'ledger.fixture', label: 'Fixture Ledger' }],
      },
      null,
      2
    )}\n`
  );

  return cwd;
}
