import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  acoBootstrapEvents,
  buildAcoBootstrapContext,
  buildCapabilitySnapshot,
} from './capability-snapshot';

const timestamp = '2026-05-24T12:00:00.000Z';

describe('ACO capability snapshot and bootstrap context', () => {
  test('builds deterministic fixture-backed capability claims', async () => {
    const cwd = await writeFixture();
    const first = await buildCapabilitySnapshot({ cwd, prompt: 'Use Context7.', timestamp });
    const second = await buildCapabilitySnapshot({ cwd, prompt: 'Use Context7.', timestamp });

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.providers.map(item => item.id)).toContain('fixture.provider');
    expect(first.commands.map(item => item.id)).toContain('script.aco:test:acceptance');
    expect(first.workflows.map(item => item.id)).toContain('workflow.fixture-workflow');
    expect(first.roles.map(item => item.id)).toContain('bmad-agent-dev');
    expect(first.graph.status).toBe('available');
    expect(first.evidenceClaims.every(claim => claim.budget.maxBytes > 0)).toBe(true);
  });

  test('redacts secrets and keeps active config unknown', async () => {
    const cwd = await writeFixture();
    const snapshot = await buildCapabilitySnapshot({
      cwd,
      prompt: 'Use token=super-secret-value and sk-abcdef123456.',
      timestamp,
    });
    const rendered = JSON.stringify(snapshot);

    expect(rendered).not.toContain('super-secret-value');
    expect(rendered).not.toContain('sk-abcdef123456');
    expect(rendered).toContain('codex.active-config');
    expect(snapshot.unknowns.map(item => item.id)).toContain('codex.active-config');
  });

  test('renders every bootstrap event within byte budget', async () => {
    const cwd = await writeFixture();

    for (const event of acoBootstrapEvents) {
      const context = await buildAcoBootstrapContext({
        cwd,
        prompt: 'Implement event context.',
        event,
        maxBytes: 1_500,
        timestamp,
        goalStatus: event === 'Stop' ? 'incomplete' : 'unknown',
      });

      expect(context.markdown.length).toBeLessThanOrEqual(1_500);
      expect(context.json.eventGuidance.length).toBeGreaterThan(0);
    }
  });
});

async function writeFixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'aco-capability-snapshot-'));
  await mkdir(join(cwd, '.archon/capabilities'), { recursive: true });
  await mkdir(join(cwd, '.archon/commands/defaults'), { recursive: true });
  await mkdir(join(cwd, '.archon/workflows/defaults'), { recursive: true });
  await mkdir(join(cwd, '_bmad/_config'), { recursive: true });
  await mkdir(join(cwd, 'docs/context-orchestrator/research'), { recursive: true });
  await mkdir(join(cwd, 'packages/providers/src/fixture'), { recursive: true });

  await writeFile(
    join(cwd, 'package.json'),
    `${JSON.stringify({
      scripts: {
        'aco:test:acceptance': 'bun test ./tests/acceptance/context-orchestrator',
      },
    })}\n`
  );
  await writeFile(
    join(cwd, '.archon/capabilities/fixture.json'),
    `${JSON.stringify({
      schemaVersion: 'aco.capability-manifest.v1',
      providers: [{ id: 'fixture.provider', label: 'Fixture Provider' }],
      plugins: [{ id: 'fixture.plugin', label: 'Fixture Plugin' }],
    })}\n`
  );
  await writeFile(join(cwd, '.archon/commands/defaults/fixture.md'), '# Fixture command\n');
  await writeFile(
    join(cwd, '.archon/workflows/defaults/fixture.yaml'),
    'name: fixture-workflow\nnodes: []\n'
  );
  await writeFile(join(cwd, '_bmad/_config/manifest.yaml'), 'installation:\n  version: 6.7.1\n');
  await writeFile(
    join(cwd, '_bmad/_config/skill-manifest.csv'),
    'canonicalId,name,description,module,path\n"bmad-agent-dev","bmad-agent-dev","Developer role","bmm","_bmad/bmm/4-implementation/bmad-agent-dev/SKILL.md"\n'
  );
  await writeFile(
    join(cwd, 'docs/context-orchestrator/research/upstream-manifest.json'),
    `${JSON.stringify({
      repositories: [
        {
          name: 'fixture',
          cloneStatus: 'fetched',
          graphStatus: 'complete',
          waiverRequired: false,
          nodes: 1,
          edges: 0,
        },
      ],
    })}\n`
  );
  await writeFile(
    join(cwd, 'packages/providers/src/fixture/capabilities.ts'),
    'export const fixtureCapabilities = { hooks: false };\n'
  );

  return cwd;
}
