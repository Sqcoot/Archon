import { mkdir, mkdtemp, writeFile } from 'fs/promises';
import { isAbsolute, join, resolve } from 'path';
import { tmpdir } from 'os';
import type { CodexProviderDefaults, NodeConfig } from '../types';
import type { CodexConfigOverrides } from './config-overrides';

const CODEX_AGENT_ID_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface GeneratedCodexAgents {
  directory: string;
  manifestFile: string;
  roles: Record<string, { description: string; config_file: string }>;
  agentIds: string[];
}

interface CodexAgentManifest {
  schemaVersion: 'archon.codex.generated-agents.v1';
  directory: string;
  agents: {
    id: string;
    description: string;
    configFile: string;
    model?: string;
    metadata: {
      tools: string[];
      disallowedTools: string[];
      skills: string[];
      maxTurns?: number;
    };
  }[];
}

export class InvalidCodexAgentIdError extends Error {
  constructor(agentId: string) {
    super(
      `Invalid Codex agent id '${agentId}': expected kebab-case letters, digits, and single hyphens`
    );
    this.name = 'InvalidCodexAgentIdError';
  }
}

export function isInvalidCodexAgentIdError(error: unknown): error is InvalidCodexAgentIdError {
  return error instanceof InvalidCodexAgentIdError;
}

export async function generateCodexAgentConfigs(options: {
  agents: NodeConfig['agents'];
  cwd: string;
  artifactDir?: string;
}): Promise<GeneratedCodexAgents | undefined> {
  const agents = options.agents;
  if (!agents || Object.keys(agents).length === 0) return undefined;
  const sortedAgents = Object.entries(agents).sort(([a], [b]) => a.localeCompare(b));
  for (const [agentId] of sortedAgents) {
    validateCodexAgentId(agentId);
  }

  const parentDir = await resolveCodexAgentParentDir(options.cwd, options.artifactDir);
  const directory = await mkdtemp(join(parentDir, 'run-'));
  const manifestFile = join(directory, 'manifest.json');
  const roles: GeneratedCodexAgents['roles'] = {};
  const manifestAgents: CodexAgentManifest['agents'] = [];

  for (const [agentId, definition] of sortedAgents) {
    const configFile = join(directory, `${agentId}.toml`);
    await writeFile(configFile, renderCodexAgentToml(agentId, definition), 'utf-8');
    roles[agentId] = {
      description: definition.description,
      config_file: configFile,
    };
    manifestAgents.push({
      id: agentId,
      description: definition.description,
      configFile,
      ...(definition.model ? { model: definition.model } : {}),
      metadata: {
        tools: definition.tools ?? [],
        disallowedTools: definition.disallowedTools ?? [],
        skills: definition.skills ?? [],
        ...(definition.maxTurns !== undefined ? { maxTurns: definition.maxTurns } : {}),
      },
    });
  }

  await writeFile(
    manifestFile,
    `${JSON.stringify(
      {
        schemaVersion: 'archon.codex.generated-agents.v1',
        directory,
        agents: manifestAgents,
      } satisfies CodexAgentManifest,
      null,
      2
    )}\n`,
    'utf-8'
  );

  return {
    directory,
    manifestFile,
    roles,
    agentIds: Object.keys(roles).sort(),
  };
}

export function buildCodexAgentRoleConfigOverrides(
  generated: GeneratedCodexAgents | undefined
): CodexConfigOverrides | undefined {
  if (!generated) return undefined;
  const agents: CodexConfigOverrides = {};
  for (const roleId of generated.agentIds) {
    const role = generated.roles[roleId];
    agents[roleId] = {
      description: role.description,
      config_file: role.config_file,
    };
  }
  return Object.keys(agents).length > 0 ? { agents } : undefined;
}

export function buildCodexRuntimeHint(
  config: CodexProviderDefaults,
  generated: GeneratedCodexAgents | undefined
): string | undefined {
  const lines: string[] = [];

  if (generated && generated.agentIds.length > 0) {
    lines.push(
      `Codex custom agents are configured for this turn: ${generated.agentIds.join(', ')}. ` +
        'Spawn them only when they materially reduce risk or latency, keep work bounded, and summarize each worker result in the final answer.'
    );
  }

  if (config.features?.multiAgentV2 === true) {
    lines.push(
      'Experimental Codex multi_agent_v2 is enabled by explicit configuration for this turn. Treat it as under-development and fall back to ordinary single-agent work if spawned workers fail.'
    );
  }

  if (config.features?.enableFanout === true || config.fanout?.enabled === true) {
    const limit =
      config.fanout?.maxConcurrency !== undefined
        ? ` Keep fanout concurrency at or below ${String(config.fanout.maxConcurrency)} workers.`
        : '';
    lines.push(
      `Experimental Codex fanout is enabled by explicit configuration for this turn.${limit} Avoid recursive fanout and include partial-failure summaries.`
    );
  }

  return lines.length > 0 ? lines.join('\n') : undefined;
}

export function applyCodexRuntimeHint(prompt: string, hint: string | undefined): string {
  if (!hint) return prompt;
  return `${hint}\n\n${prompt}`;
}

function validateCodexAgentId(agentId: string): void {
  if (!CODEX_AGENT_ID_REGEX.test(agentId)) {
    throw new InvalidCodexAgentIdError(agentId);
  }
}

async function resolveCodexAgentParentDir(
  cwd: string,
  artifactDir: string | undefined
): Promise<string> {
  if (artifactDir) {
    const resolvedArtifactDir = isAbsolute(artifactDir) ? artifactDir : resolve(cwd, artifactDir);
    const parentDir = join(resolvedArtifactDir, 'codex-agents');
    await mkdir(parentDir, { recursive: true });
    return parentDir;
  }

  return mkdtemp(join(tmpdir(), 'archon-codex-agents-'));
}

function renderCodexAgentToml(
  agentId: string,
  definition: NonNullable<NodeConfig['agents']>[string]
): string {
  const lines = [
    `name = ${tomlString(agentId)}`,
    `description = ${tomlString(definition.description)}`,
    `developer_instructions = ${tomlMultilineString(buildDeveloperInstructions(definition))}`,
  ];

  if (definition.model) {
    lines.push(`model = ${tomlString(definition.model)}`);
  }

  return `${lines.join('\n')}\n`;
}

function buildDeveloperInstructions(definition: NonNullable<NodeConfig['agents']>[string]): string {
  const metadataLines: string[] = [];
  if (definition.tools?.length) {
    metadataLines.push(`Requested tools: ${definition.tools.join(', ')}`);
  }
  if (definition.disallowedTools?.length) {
    metadataLines.push(`Disallowed tools: ${definition.disallowedTools.join(', ')}`);
  }
  if (definition.skills?.length) {
    metadataLines.push(`Requested skills: ${definition.skills.join(', ')}`);
  }
  if (definition.maxTurns !== undefined) {
    metadataLines.push(`Requested max turns: ${String(definition.maxTurns)}`);
  }

  if (metadataLines.length === 0) return definition.prompt;
  return `${definition.prompt}\n\nArchon inline-agent metadata:\n${metadataLines.map(line => `- ${line}`).join('\n')}`;
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function tomlMultilineString(value: string): string {
  return `"""\n${value.replaceAll('"""', '\\"\\"\\"')}\n"""`;
}
