import { describe, expect, test } from 'bun:test';
import { existsSync } from 'fs';
import { lstat, mkdir, mkdtemp, readFile, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  runAcoBootstrapCodexCommand,
  runAcoCleanupCodexCommand,
} from '../../../packages/context-orchestrator/src/index';

const timestamp = '2026-05-24T12:00:00.000Z';
const specPath = 'docs/context-orchestrator/specs/025-aco-codex-real-bootstrap-cleanup-hooks.md';

describe('ACO Codex bootstrap cleanup acceptance', () => {
  test('Spec: 025-aco-codex-real-bootstrap-cleanup-hooks.md Acceptance: ACO-CODEX-REAL-003 bootstrap emits cleanup manifest in a clean temp setup', async () => {
    const cwd = await writeCleanupFixture();
    const result = await runAcoBootstrapCodexCommand({
      cwd,
      runId: 'aco-real-cleanup-run-1',
      prompt: 'Bootstrap in a temp cleanup fixture.',
      event: 'SessionStart',
      format: 'json',
      maxBytes: 4_000,
      writeArtifact: true,
      timestamp,
    });

    expect(result.artifacts?.cleanupManifest).toMatch(/cleanup-manifest\.json$/);
    expect(existsSync(join(cwd, result.artifacts!.cleanupManifest))).toBe(true);

    const manifest = JSON.parse(
      await readFile(join(cwd, result.artifacts!.cleanupManifest), 'utf8')
    ) as { runId: string; entries: Array<{ ownedBy: string; runId: string; path: string }> };
    expect(manifest.runId).toBe('aco-real-cleanup-run-1');
    expect(manifest.entries.length).toBeGreaterThanOrEqual(5);
    expect(manifest.entries.every(entry => entry.ownedBy === 'aco')).toBe(true);
    expect(manifest.entries.every(entry => entry.runId === manifest.runId)).toBe(true);
  });

  test('Spec: 025-aco-codex-real-bootstrap-cleanup-hooks.md Acceptance: ACO-CODEX-REAL-004 cleanup dry-runs by default, applies only manifest-owned paths, and is idempotent', async () => {
    const cwd = await writeCleanupFixture();
    const runId = 'aco-real-cleanup-run-2';
    const bootstrap = await runAcoBootstrapCodexCommand({
      cwd,
      runId,
      prompt: 'Bootstrap then cleanup.',
      event: 'SessionStart',
      format: 'markdown',
      maxBytes: 4_000,
      writeArtifact: true,
      timestamp,
    });
    const manifest = join(cwd, bootstrap.artifacts!.cleanupManifest);
    const unmanagedCodexConfig = join(cwd, '.codex/config.toml');
    const graphEvidence = join(cwd, 'docs/context-orchestrator/research/upstream-manifest.json');

    const dryRun = await runAcoCleanupCodexCommand({ cwd, manifest, runId });
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.deletedPaths).toHaveLength(0);
    expect(dryRun.plannedPaths.length).toBeGreaterThan(0);
    expect(existsSync(join(cwd, bootstrap.artifacts!.capsuleJson))).toBe(true);

    const applied = await runAcoCleanupCodexCommand({ cwd, manifest, runId, apply: true });
    expect(applied.dryRun).toBe(false);
    expect(applied.deletedPaths.length).toBeGreaterThan(0);
    expect(applied.refusedPaths).toHaveLength(0);
    expect(existsSync(join(cwd, bootstrap.artifacts!.capsuleJson))).toBe(false);
    expect(existsSync(unmanagedCodexConfig)).toBe(true);
    expect(existsSync(graphEvidence)).toBe(true);
    expect(await readFile(unmanagedCodexConfig, 'utf8')).toContain('trust_level');
    expect(await readFile(graphEvidence, 'utf8')).toContain('fixture-graph');

    const second = await runAcoCleanupCodexCommand({ cwd, manifest, runId, apply: true });
    expect(second.idempotentNoopWhenRepeated).toBe(true);
    expect(second.deletedPaths).toHaveLength(0);
    expect(second.status).toBe('passed');
  });

  test('Spec: 025-aco-codex-real-bootstrap-cleanup-hooks.md Acceptance: ACO-CODEX-REAL-010 cleanup refuses protected and symlink-escape paths', async () => {
    const cwd = await writeCleanupFixture();
    const outside = await mkdtemp(join(tmpdir(), 'aco-cleanup-outside-'));
    const runId = 'aco-real-cleanup-run-3';
    const runRoot = join(cwd, '.archon/artifacts/context-orchestrator', runId);
    await mkdir(runRoot, { recursive: true });
    await writeFile(join(runRoot, 'owned.txt'), 'owned\n');
    await symlink(join(outside, 'escape.txt'), join(runRoot, 'escape-link'));
    const manifestPath = join(runRoot, 'cleanup-manifest.json');
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          schemaVersion: 'aco.cleanup-codex-manifest.v1',
          runId,
          root: cwd,
          entries: [
            { path: '.codex/config.toml', ownedBy: 'aco', runId, kind: 'hookConfig' },
            {
              path: 'docs/context-orchestrator/research/upstream-manifest.json',
              ownedBy: 'aco',
              runId,
              kind: 'graphEvidence',
            },
            {
              path: `.archon/artifacts/context-orchestrator/${runId}/escape-link`,
              ownedBy: 'aco',
              runId,
              kind: 'artifact',
            },
            {
              path: `.archon/artifacts/context-orchestrator/${runId}/owned.txt`,
              ownedBy: 'aco',
              runId,
              kind: 'artifact',
            },
          ],
        },
        null,
        2
      )}\n`
    );

    const result = await runAcoCleanupCodexCommand({
      cwd,
      manifest: manifestPath,
      runId,
      apply: true,
    });

    expect(result.refusedPaths.map(path => path.path)).toContain('.codex/config.toml');
    expect(result.refusedPaths.map(path => path.path)).toContain(
      'docs/context-orchestrator/research/upstream-manifest.json'
    );
    expect(result.refusedPaths.map(path => path.path)).toContain(
      `.archon/artifacts/context-orchestrator/${runId}/escape-link`
    );
    expect(result.deletedPaths).toContain(
      `.archon/artifacts/context-orchestrator/${runId}/owned.txt`
    );
    expect(existsSync(join(cwd, '.codex/config.toml'))).toBe(true);
    expect(existsSync(join(cwd, 'docs/context-orchestrator/research/upstream-manifest.json'))).toBe(
      true
    );
    expect((await lstat(join(runRoot, 'escape-link'))).isSymbolicLink()).toBe(true);
  });
});

async function writeCleanupFixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'aco-cleanup-fixture-'));
  await mkdir(join(cwd, '.archon/commands/defaults'), { recursive: true });
  await mkdir(join(cwd, '.archon/workflows/defaults'), { recursive: true });
  await mkdir(join(cwd, '.codex'), { recursive: true });
  await mkdir(join(cwd, 'docs/context-orchestrator/specs'), { recursive: true });
  await mkdir(join(cwd, 'docs/context-orchestrator/research'), { recursive: true });
  await mkdir(join(cwd, '_bmad/_config'), { recursive: true });

  await writeFile(join(cwd, specPath), '# Cleanup Spec Fixture\nACO-CODEX-REAL-004\n');
  await writeFile(join(cwd, '.archon/commands/defaults/fixture.md'), '# Fixture command\n');
  await writeFile(join(cwd, '.archon/workflows/defaults/fixture.yaml'), 'name: fixture\n');
  await writeFile(
    join(cwd, '.codex/config.toml'),
    '[projects."/tmp/not-this"]\ntrust_level = "trusted"\n'
  );
  await writeFile(
    join(cwd, 'docs/context-orchestrator/research/upstream-manifest.json'),
    `${JSON.stringify({
      repositories: [{ name: 'fixture-graph', graphStatus: 'complete', nodes: 1, edges: 0 }],
    })}\n`
  );
  await writeFile(
    join(cwd, '_bmad/_config/skill-manifest.csv'),
    'canonicalId,name,description,module,path\n"bmad-agent-dev","bmad-agent-dev","Developer role","bmm","_bmad/dev/SKILL.md"\n'
  );
  await writeFile(join(cwd, 'package.json'), '{"scripts":{"aco:test:acceptance":"bun test"}}\n');

  return cwd;
}
