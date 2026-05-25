import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildCodexAgentRoleConfigOverrides, generateCodexAgentConfigs } from './agent-config';

describe('Codex generated agent config', () => {
  test('writes generated agent role files under the workflow artifact directory', async () => {
    const testDir = await mkdtemp(join(tmpdir(), 'codex-agent-config-'));
    const artifactDir = join(testDir, 'artifacts');

    try {
      const generated = await generateCodexAgentConfigs({
        cwd: testDir,
        artifactDir,
        agents: {
          'brief-gen': {
            description: 'Briefs an issue',
            prompt: 'Return JSON.',
            model: 'gpt-5.2-codex',
            tools: ['Read'],
            disallowedTools: ['Write'],
            skills: ['triage'],
            maxTurns: 2,
          },
        },
      });

      expect(generated).toBeDefined();
      expect(generated!.directory.startsWith(join(artifactDir, 'codex-agents'))).toBe(true);
      expect(generated!.agentIds).toEqual(['brief-gen']);
      expect(generated!.manifestFile).toBe(join(generated!.directory, 'manifest.json'));

      const role = generated!.roles['brief-gen'];
      expect(role.config_file.startsWith(generated!.directory)).toBe(true);
      const roleToml = await readFile(role.config_file, 'utf-8');
      expect(roleToml).toContain('name = "brief-gen"');
      expect(roleToml).toContain('description = "Briefs an issue"');
      expect(roleToml).toContain('model = "gpt-5.2-codex"');
      expect(roleToml).toContain('Requested tools: Read');
      expect(roleToml).toContain('Disallowed tools: Write');
      expect(roleToml).toContain('Requested skills: triage');
      expect(roleToml).toContain('Requested max turns: 2');

      const manifest = JSON.parse(await readFile(generated!.manifestFile, 'utf-8')) as {
        schemaVersion: string;
        agents: { id: string; configFile: string; metadata: { tools: string[] } }[];
      };
      expect(manifest.schemaVersion).toBe('archon.codex.generated-agents.v1');
      expect(manifest.agents.map(agent => agent.id)).toEqual(['brief-gen']);
      expect(manifest.agents[0].configFile).toBe(role.config_file);
      expect(manifest.agents[0].metadata.tools).toEqual(['Read']);

      expect(buildCodexAgentRoleConfigOverrides(generated)).toEqual({
        agents: {
          'brief-gen': {
            description: 'Briefs an issue',
            config_file: role.config_file,
          },
        },
      });
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test('rejects unsafe direct provider agent ids before writing config files', async () => {
    const testDir = await mkdtemp(join(tmpdir(), 'codex-agent-config-unsafe-'));
    try {
      await expect(
        generateCodexAgentConfigs({
          cwd: testDir,
          artifactDir: join(testDir, 'artifacts'),
          agents: {
            '../bad': { description: 'bad', prompt: 'bad' },
          },
        })
      ).rejects.toThrow("Invalid Codex agent id '../bad'");
      await expect(readdir(join(testDir, 'artifacts', 'codex-agents'))).rejects.toThrow();
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test('sorts generated agent ids in manifests and role overrides', async () => {
    const testDir = await mkdtemp(join(tmpdir(), 'codex-agent-config-sorted-'));
    try {
      const generated = await generateCodexAgentConfigs({
        cwd: testDir,
        artifactDir: join(testDir, 'artifacts'),
        agents: {
          'zeta-role': { description: 'Zeta', prompt: 'z' },
          'alpha-role': { description: 'Alpha', prompt: 'a' },
        },
      });

      expect(generated!.agentIds).toEqual(['alpha-role', 'zeta-role']);
      const manifest = JSON.parse(await readFile(generated!.manifestFile, 'utf-8')) as {
        agents: { id: string }[];
      };
      expect(manifest.agents.map(agent => agent.id)).toEqual(['alpha-role', 'zeta-role']);
      const overrides = buildCodexAgentRoleConfigOverrides(generated) as {
        agents: Record<string, unknown>;
      };
      expect(Object.keys(overrides.agents)).toEqual(['alpha-role', 'zeta-role']);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});
