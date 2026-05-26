import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  registerBuiltinProviders,
  registerCommunityProviders,
  clearRegistry,
} from '@archon/providers';

// Bootstrap provider registry (needed by capability-driven warnings in validator)
clearRegistry();
registerBuiltinProviders();
registerCommunityProviders();

import {
  levenshtein,
  findSimilar,
  validateWorkflowResources,
  validateCommand,
  discoverAvailableCommands,
} from './validator';
import type { WorkflowDefinition, DagNode } from './schemas';

// =============================================================================
// Test helpers
// =============================================================================

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'validator-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function makeWorkflow(name: string, nodes: DagNode[], provider?: string): WorkflowDefinition {
  return {
    name,
    description: 'test workflow',
    nodes,
    ...(provider && { provider }),
  } as WorkflowDefinition;
}

async function createCommandFile(name: string, content = '# Do something'): Promise<void> {
  const dir = join(tmpDir, '.archon', 'commands');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${name}.md`), content);
}

async function withIsolatedArchonHome<T>(run: () => Promise<T>): Promise<T> {
  const homeDir = await mkdtemp(join(tmpdir(), 'validator-home-empty-'));
  const originalArchonHome = process.env.ARCHON_HOME;
  const originalArchonDocker = process.env.ARCHON_DOCKER;
  process.env.ARCHON_HOME = homeDir;
  delete process.env.ARCHON_DOCKER;

  try {
    return await run();
  } finally {
    await rm(homeDir, { recursive: true, force: true });
    if (originalArchonHome === undefined) {
      delete process.env.ARCHON_HOME;
    } else {
      process.env.ARCHON_HOME = originalArchonHome;
    }
    if (originalArchonDocker === undefined) {
      delete process.env.ARCHON_DOCKER;
    } else {
      process.env.ARCHON_DOCKER = originalArchonDocker;
    }
  }
}

// =============================================================================
// levenshtein
// =============================================================================

describe('levenshtein', () => {
  test('identical strings → 0', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });

  test('single insertion', () => {
    expect(levenshtein('abc', 'abcd')).toBe(1);
  });

  test('single deletion', () => {
    expect(levenshtein('abcd', 'abc')).toBe(1);
  });

  test('single substitution', () => {
    expect(levenshtein('abc', 'axc')).toBe(1);
  });

  test('empty string → length of other', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  test('both empty → 0', () => {
    expect(levenshtein('', '')).toBe(0);
  });

  test('typical typo: "asist" vs "assist"', () => {
    expect(levenshtein('asist', 'assist')).toBe(1);
  });

  test('completely different strings', () => {
    expect(levenshtein('abc', 'xyz')).toBe(3);
  });
});

// =============================================================================
// findSimilar
// =============================================================================

describe('findSimilar', () => {
  test('returns closest candidates within threshold', () => {
    const result = findSimilar('asist', ['assist', 'assign', 'resist', 'totally-different']);
    expect(result).toContain('assist');
    expect(result.length).toBeLessThanOrEqual(3);
  });

  test('excludes exact match (distance = 0)', () => {
    expect(findSimilar('assist', ['assist', 'asist'])).not.toContain('assist');
  });

  test('returns empty array when nothing is close', () => {
    expect(findSimilar('xyz', ['totally-different', 'another-one'])).toEqual([]);
  });

  test('respects explicit maxDistance override', () => {
    const result = findSimilar('a', ['ab', 'abc', 'abcd'], 1);
    expect(result).toEqual(['ab']);
  });

  test('returns at most 3 suggestions', () => {
    const result = findSimilar('test', ['teat', 'tent', 'text', 'best', 'rest']);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  test('is case-insensitive for near-matches', () => {
    const result = findSimilar('ASIST', ['assist']);
    expect(result).toContain('assist');
  });
});

// =============================================================================
// validateWorkflowResources — command nodes
// =============================================================================

describe('validateWorkflowResources — command nodes', () => {
  test('no issues when command file exists', async () => {
    await createCommandFile('my-command');
    const workflow = makeWorkflow('test', [{ id: 'step1', command: 'my-command' } as DagNode]);
    const issues = await validateWorkflowResources(workflow, tmpDir);
    const errors = issues.filter(i => i.level === 'error');
    expect(errors).toHaveLength(0);
  });

  test('error when command file is missing', async () => {
    const workflow = makeWorkflow('test', [{ id: 'step1', command: 'nonexistent' } as DagNode]);
    const issues = await validateWorkflowResources(workflow, tmpDir, {
      loadDefaultCommands: false,
    });
    const errors = issues.filter(i => i.level === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('command');
    expect(errors[0].message).toContain('not found');
  });

  test('suggests similar command names', async () => {
    await createCommandFile('assist');
    const workflow = makeWorkflow('test', [{ id: 'step1', command: 'asist' } as DagNode]);
    const issues = await validateWorkflowResources(workflow, tmpDir, {
      loadDefaultCommands: false,
    });
    const errors = issues.filter(i => i.level === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].suggestions).toContain('assist');
  });

  test('error for invalid command name', async () => {
    const workflow = makeWorkflow('test', [{ id: 'step1', command: '../escape' } as DagNode]);
    const issues = await validateWorkflowResources(workflow, tmpDir);
    const errors = issues.filter(i => i.level === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Invalid command name');
  });
});

// =============================================================================
// validateWorkflowResources — MCP validation
// =============================================================================

describe('validateWorkflowResources — MCP validation', () => {
  test('error when MCP config file is missing', async () => {
    const workflow = makeWorkflow('test', [
      { id: 'step1', prompt: 'do stuff', mcp: 'missing.json' } as unknown as DagNode,
    ]);
    const issues = await validateWorkflowResources(workflow, tmpDir);
    expect(issues.some(i => i.field === 'mcp' && i.level === 'error')).toBe(true);
  });

  test('error when MCP config has invalid JSON', async () => {
    const mcpPath = join(tmpDir, 'bad.json');
    await writeFile(mcpPath, '{bad json');
    const workflow = makeWorkflow('test', [
      { id: 'step1', prompt: 'do stuff', mcp: mcpPath } as unknown as DagNode,
    ]);
    const issues = await validateWorkflowResources(workflow, tmpDir);
    const mcpErrors = issues.filter(i => i.field === 'mcp' && i.level === 'error');
    expect(mcpErrors).toHaveLength(1);
    expect(mcpErrors[0].message).toContain('invalid JSON');
  });

  test('error when MCP config is an array instead of object', async () => {
    const mcpPath = join(tmpDir, 'array.json');
    await writeFile(mcpPath, '[]');
    const workflow = makeWorkflow('test', [
      { id: 'step1', prompt: 'do stuff', mcp: mcpPath } as unknown as DagNode,
    ]);
    const issues = await validateWorkflowResources(workflow, tmpDir);
    const mcpErrors = issues.filter(i => i.field === 'mcp' && i.level === 'error');
    expect(mcpErrors).toHaveLength(1);
    expect(mcpErrors[0].message).toContain('JSON object');
  });

  test('no error when MCP config is a valid JSON object', async () => {
    const mcpPath = join(tmpDir, 'good.json');
    await writeFile(mcpPath, '{"server": {"command": "npx"}}');
    const workflow = makeWorkflow('test', [
      { id: 'step1', prompt: 'do stuff', mcp: mcpPath } as unknown as DagNode,
    ]);
    const issues = await validateWorkflowResources(workflow, tmpDir);
    const mcpErrors = issues.filter(i => i.field === 'mcp' && i.level === 'error');
    expect(mcpErrors).toHaveLength(0);
  });

  test('does not warn when MCP is used with codex provider', async () => {
    const mcpPath = join(tmpDir, 'good.json');
    await writeFile(mcpPath, '{"server": {"command": "npx"}}');
    const workflow = makeWorkflow(
      'test',
      [{ id: 'step1', prompt: 'do stuff', mcp: mcpPath } as unknown as DagNode],
      'codex'
    );
    const issues = await validateWorkflowResources(workflow, tmpDir);
    const mcpWarnings = issues.filter(i => i.field === 'mcp' && i.level === 'warning');
    expect(mcpWarnings).toHaveLength(0);
  });
});

// =============================================================================
// validateCommand
// =============================================================================

describe('validateCommand', () => {
  test('valid for non-empty command file', async () => {
    await createCommandFile('my-command', '# Do something useful');
    const result = await validateCommand('my-command', tmpDir, { loadDefaultCommands: false });
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  test('error for empty command file', async () => {
    await createCommandFile('empty-cmd', '   \n  ');
    const result = await validateCommand('empty-cmd', tmpDir, { loadDefaultCommands: false });
    expect(result.valid).toBe(false);
    expect(result.issues[0].field).toBe('content');
  });

  test('error for invalid command name', async () => {
    const result = await validateCommand('../escape', tmpDir);
    expect(result.valid).toBe(false);
    expect(result.issues[0].field).toBe('name');
  });

  test('error for missing command with suggestions', async () => {
    await createCommandFile('assist');
    const result = await validateCommand('asist', tmpDir, { loadDefaultCommands: false });
    expect(result.valid).toBe(false);
    expect(result.issues[0].suggestions).toContain('assist');
  });
});

// =============================================================================
// discoverAvailableCommands
// =============================================================================

describe('discoverAvailableCommands', () => {
  test('finds commands in .archon/commands/', async () => {
    await createCommandFile('my-command');
    await createCommandFile('other-command');
    const commands = await discoverAvailableCommands(tmpDir, { loadDefaultCommands: false });
    expect(commands).toContain('my-command');
    expect(commands).toContain('other-command');
  });

  test('returns sorted list', async () => {
    await createCommandFile('zebra');
    await createCommandFile('alpha');
    const commands = await withIsolatedArchonHome(() =>
      discoverAvailableCommands(tmpDir, { loadDefaultCommands: false })
    );
    expect(commands).toEqual(['alpha', 'zebra']);
  });

  test('returns empty array when no commands directory', async () => {
    const commands = await withIsolatedArchonHome(() =>
      discoverAvailableCommands(tmpDir, { loadDefaultCommands: false })
    );
    expect(commands).toEqual([]);
  });

  test('loadDefaultCommands: false suppresses bundled commands', async () => {
    const withDefaults = await discoverAvailableCommands(tmpDir, { loadDefaultCommands: true });
    const without = await discoverAvailableCommands(tmpDir, { loadDefaultCommands: false });
    expect(withDefaults.length).toBeGreaterThanOrEqual(without.length);
  });

  // --- Home-scoped commands (~/.archon/commands/) — new capability
  describe('home-scoped commands', () => {
    let homeDir: string;
    const originalArchonHome = process.env.ARCHON_HOME;
    const originalArchonDocker = process.env.ARCHON_DOCKER;

    beforeEach(async () => {
      homeDir = await mkdtemp(join(tmpdir(), 'validator-home-'));
      process.env.ARCHON_HOME = homeDir;
      delete process.env.ARCHON_DOCKER;
    });

    afterEach(async () => {
      await rm(homeDir, { recursive: true, force: true });
      if (originalArchonHome === undefined) {
        delete process.env.ARCHON_HOME;
      } else {
        process.env.ARCHON_HOME = originalArchonHome;
      }
      if (originalArchonDocker === undefined) {
        delete process.env.ARCHON_DOCKER;
      } else {
        process.env.ARCHON_DOCKER = originalArchonDocker;
      }
    });

    async function createHomeCommand(name: string, content = '# Home helper'): Promise<void> {
      const dir = join(homeDir, 'commands');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${name}.md`), content);
    }

    test('discovers commands placed at ~/.archon/commands/', async () => {
      await createHomeCommand('my-personal-helper');
      const commands = await discoverAvailableCommands(tmpDir, { loadDefaultCommands: false });
      expect(commands).toContain('my-personal-helper');
    });

    test('resolveCommand (via validateCommand) finds home-scoped commands when repo has none', async () => {
      await createHomeCommand('only-in-home');
      const result = await validateCommand('only-in-home', tmpDir, { loadDefaultCommands: false });
      expect(result.valid).toBe(true);
    });

    test('repo command overrides home command with the same name', async () => {
      await createHomeCommand('shared', '# Home version');
      await createCommandFile('shared', '# Repo version');
      // Both resolve but the repo wins — validator only asserts existence, so the
      // strong behavioral assertion lives in the executor-shared loadCommand tests.
      // Here we just confirm that having both doesn't error.
      const result = await validateCommand('shared', tmpDir, { loadDefaultCommands: false });
      expect(result.valid).toBe(true);
    });
  });
});

// =============================================================================
// validateWorkflowResources — script nodes
// =============================================================================

describe('validateWorkflowResources — script nodes', () => {
  test('error when named bun script file does not exist', async () => {
    const workflow = makeWorkflow('test', [
      { id: 'step1', script: 'nonexistent-script', runtime: 'bun' } as unknown as DagNode,
    ]);
    const issues = await validateWorkflowResources(workflow, tmpDir);
    const errors = issues.filter(i => i.level === 'error' && i.field === 'script');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Named script 'nonexistent-script' not found");
    expect(errors[0].nodeId).toBe('step1');
  });

  test('error when named uv script file does not exist', async () => {
    const workflow = makeWorkflow('test', [
      { id: 'step1', script: 'missing-py-script', runtime: 'uv' } as unknown as DagNode,
    ]);
    const issues = await validateWorkflowResources(workflow, tmpDir);
    const errors = issues.filter(i => i.level === 'error' && i.field === 'script');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Named script 'missing-py-script' not found");
    expect(errors[0].hint).toContain('.py');
  });

  test('no error when named bun script file exists', async () => {
    const scriptsDir = join(tmpDir, '.archon', 'scripts');
    await mkdir(scriptsDir, { recursive: true });
    await writeFile(join(scriptsDir, 'my-script.ts'), 'console.log("hi")');
    const workflow = makeWorkflow('test', [
      { id: 'step1', script: 'my-script', runtime: 'bun' } as unknown as DagNode,
    ]);
    const issues = await validateWorkflowResources(workflow, tmpDir);
    const scriptErrors = issues.filter(i => i.level === 'error' && i.field === 'script');
    expect(scriptErrors).toHaveLength(0);
  });

  test('no error for inline bun script (no file lookup needed)', async () => {
    const workflow = makeWorkflow('test', [
      {
        id: 'step1',
        script: 'console.log("inline")',
        runtime: 'bun',
      } as unknown as DagNode,
    ]);
    const issues = await validateWorkflowResources(workflow, tmpDir);
    const scriptErrors = issues.filter(i => i.level === 'error' && i.field === 'script');
    expect(scriptErrors).toHaveLength(0);
  });
});

// =============================================================================
// validateWorkflowResources — high-impact approval gates
// =============================================================================

describe('validateWorkflowResources — high-impact approval gates', () => {
  test('errors when interactive_only workflow does not foreground interactive runtime', async () => {
    const workflow = {
      ...makeWorkflow('test', [{ id: 'step1', prompt: 'p' } as unknown as DagNode]),
      mode: 'interactive_only',
    } as WorkflowDefinition;

    const issues = await validateWorkflowResources(workflow, tmpDir);
    const error = issues.find(i => i.level === 'error' && i.field === 'interactive');
    expect(error).toBeDefined();
    expect(error!.message).toContain('interactive_only');
    expect(error!.badBehaviour).toMatchObject({
      pattern: 'conflicting_metadata',
      classification: 'bug',
    });
  });

  test('errors when autonomous workflow declares external side effects', async () => {
    const workflow = {
      ...makeWorkflow('test', [{ id: 'step1', prompt: 'p' } as unknown as DagNode]),
      mode: 'autonomous',
      lock_scope: 'external_side_effect',
    } as WorkflowDefinition;

    const issues = await validateWorkflowResources(workflow, tmpDir);
    const error = issues.find(i => i.level === 'error' && i.field === 'lock_scope');
    expect(error).toBeDefined();
    expect(error!.message).toContain('external_side_effect');
    expect(error!.badBehaviour).toMatchObject({
      pattern: 'conflicting_metadata',
      classification: 'bug',
    });
  });

  test('errors when autonomous workflow declares checkout mutation', async () => {
    const workflow = {
      ...makeWorkflow('test', [{ id: 'step1', prompt: 'p' } as unknown as DagNode]),
      mode: 'autonomous',
      lock_scope: 'checkout_mutation',
    } as WorkflowDefinition;

    const issues = await validateWorkflowResources(workflow, tmpDir);
    const error = issues.find(i => i.level === 'error' && i.field === 'lock_scope');
    expect(error).toBeDefined();
    expect(error!.message).toContain('checkout_mutation');
    expect(error!.badBehaviour).toMatchObject({
      pattern: 'conflicting_metadata',
      classification: 'bug',
    });
  });

  test('warns when artifact-only workflow does not disable checkout mutation metadata', async () => {
    const workflow = {
      ...makeWorkflow('test', [{ id: 'step1', prompt: 'p' } as unknown as DagNode]),
      mode: 'autonomous',
      lock_scope: 'artifact_only',
    } as WorkflowDefinition;

    const issues = await validateWorkflowResources(workflow, tmpDir);
    const warning = issues.find(i => i.level === 'warning' && i.field === 'mutates_checkout');
    expect(warning).toBeDefined();
    expect(warning!.message).toContain('artifact_only');
    expect(warning!.badBehaviour).toMatchObject({
      pattern: 'warning_only_control',
      classification: 'warning-only',
    });
  });

  test('errors when provider cannot enforce system prompt control', async () => {
    const workflow = makeWorkflow(
      'test',
      [
        {
          id: 'step1',
          prompt: 'p',
          systemPrompt: 'Always produce a JSON object.',
        } as unknown as DagNode,
      ],
      'codex'
    );

    const issues = await validateWorkflowResources(workflow, tmpDir);
    const error = issues.find(i => i.level === 'error' && i.field === 'systemPrompt');
    expect(error).toBeDefined();
    expect(error!.message).toContain('System prompt controls are not supported');
    expect(error!.badBehaviour).toMatchObject({
      pattern: 'unsupported_control',
      classification: 'bug',
    });
  });

  test('errors when high-impact approval lacks reason and affected surface', async () => {
    const workflow = makeWorkflow('test', [
      {
        id: 'production-gate',
        approval: { message: 'Deploy to production?', mutation_class: 'production' },
      } as DagNode,
    ]);

    const issues = await validateWorkflowResources(workflow, tmpDir);
    const errors = issues.filter(i => i.level === 'error');
    expect(errors.map(i => i.field)).toContain('approval.reason');
    expect(errors.map(i => i.field)).toContain('approval.path');
  });

  test('errors when non-AI nodes declare ignored model or feature controls', async () => {
    const workflow = makeWorkflow('test', [
      {
        id: 'shell-step',
        bash: 'echo safe',
        fallbackModel: 'backup-model',
        effort: 'high',
        betas: ['experimental-mode'],
      } as unknown as DagNode,
    ]);

    const issues = await validateWorkflowResources(workflow, tmpDir);
    const error = issues.find(i => i.level === 'error' && i.field === 'effort,fallbackModel,betas');
    expect(error).toBeDefined();
    expect(error!.message).toContain('safety/output control fields that would be ignored');
    expect(error!.badBehaviour).toMatchObject({
      pattern: 'silent_behavior',
      classification: 'bug',
    });
  });

  test('treats explicit high_impact approval metadata as high impact for custom classes', async () => {
    const workflow = makeWorkflow('test', [
      {
        id: 'network-gate',
        approval: {
          message: 'Change network boundary?',
          mutation_class: 'network_boundary',
          high_impact: true,
          allowed_scopes: ['once', 'run'],
        },
      } as unknown as DagNode,
    ]);

    const issues = await validateWorkflowResources(workflow, tmpDir);
    const errors = issues.filter(i => i.level === 'error');
    expect(errors.map(i => i.field)).toContain('approval.reason');
    expect(errors.map(i => i.field)).toContain('approval.path');
    expect(errors.map(i => i.field)).toContain('approval.allowed_scopes');
  });

  test('errors when high-impact approval allows approve-for-run', async () => {
    const workflow = makeWorkflow('test', [
      {
        id: 'destructive-gate',
        approval: {
          message: 'Delete remote resources?',
          mutation_class: 'destructive',
          reason: 'Remote resources will be removed',
          command: 'terraform destroy',
          default_scope: 'run',
          allowed_scopes: ['once', 'run'],
        },
      } as DagNode,
    ]);

    const issues = await validateWorkflowResources(workflow, tmpDir);
    const errors = issues.filter(i => i.level === 'error');
    expect(errors.map(i => i.field)).toContain('approval.default_scope');
    expect(errors.map(i => i.field)).toContain('approval.allowed_scopes');
  });

  test('accepts one-shot high-impact approval with reason and affected surface', async () => {
    const workflow = makeWorkflow('test', [
      {
        id: 'credential-gate',
        approval: {
          message: 'Rotate credential?',
          mutation_class: 'credential',
          reason: 'Credential rotation changes production authentication material',
          command: 'rotate-secret',
          default_scope: 'once',
          allowed_scopes: ['once'],
        },
      } as DagNode,
    ]);

    const issues = await validateWorkflowResources(workflow, tmpDir);
    const errors = issues.filter(i => i.level === 'error');
    expect(errors).toHaveLength(0);
  });

  test('errors when standard approval allows approve-for-run before run scope is implemented', async () => {
    const workflow = makeWorkflow('test', [
      {
        id: 'review-gate',
        approval: {
          message: 'Review before continuing?',
          allowed_scopes: ['once', 'run'],
          default_scope: 'once',
        },
      } as DagNode,
    ]);

    const issues = await validateWorkflowResources(workflow, tmpDir);
    const error = issues.find(i => i.level === 'error' && i.field === 'approval.allowed_scopes');
    expect(error).toBeDefined();
    expect(error!.message).toContain('run-scoped approval execution is not implemented');
    expect(error!.badBehaviour).toMatchObject({
      pattern: 'deferred_behavior',
      classification: 'bug',
    });
  });

  test('errors when standard approval defaults to approve-for-run before run scope is implemented', async () => {
    const workflow = makeWorkflow('test', [
      {
        id: 'review-gate',
        approval: {
          message: 'Review before continuing?',
          default_scope: 'run',
          allowed_scopes: ['once'],
        },
      } as DagNode,
    ]);

    const issues = await validateWorkflowResources(workflow, tmpDir);
    const error = issues.find(i => i.level === 'error' && i.field === 'approval.default_scope');
    expect(error).toBeDefined();
    expect(error!.message).toContain('run-scoped approval execution is not implemented');
    expect(error!.badBehaviour).toMatchObject({
      pattern: 'deferred_behavior',
      classification: 'bug',
    });
  });
});

// =============================================================================
// validateWorkflowResources — inline agents capability
// =============================================================================

describe('validateWorkflowResources — agents capability', () => {
  const agentsField = {
    'brief-gen': { description: 'd', prompt: 'p' },
  };

  test('errors when provider does not support inline agents (codex)', async () => {
    const workflow = makeWorkflow(
      'test',
      [{ id: 'step1', prompt: 'p', agents: agentsField } as unknown as DagNode],
      'codex'
    );
    const issues = await validateWorkflowResources(workflow, tmpDir);
    const error = issues.find(i => i.level === 'error' && i.field === 'agents');
    expect(error).toBeDefined();
    expect(error!.message).toContain("not supported by provider 'codex'");
    expect(error!.hint).toContain('claude');
    expect(error!.badBehaviour?.classification).toBe('bug');
  });

  test('no agents-capability warning when provider is claude', async () => {
    const workflow = makeWorkflow(
      'test',
      [{ id: 'step1', prompt: 'p', agents: agentsField } as unknown as DagNode],
      'claude'
    );
    const issues = await validateWorkflowResources(workflow, tmpDir);
    const warning = issues.find(i => i.level === 'warning' && i.field === 'agents');
    expect(warning).toBeUndefined();
  });

  test('no warning when node has no agents field', async () => {
    const workflow = makeWorkflow(
      'test',
      [{ id: 'step1', prompt: 'p' } as unknown as DagNode],
      'codex'
    );
    const issues = await validateWorkflowResources(workflow, tmpDir);
    const warning = issues.find(i => i.level === 'warning' && i.field === 'agents');
    expect(warning).toBeUndefined();
  });
});

// =============================================================================
// validateWorkflowResources — output_format enforcement
// =============================================================================

describe('validateWorkflowResources — output_format enforcement', () => {
  test('errors when provider only supports best-effort structured output', async () => {
    const workflow = makeWorkflow(
      'test',
      [
        {
          id: 'step1',
          prompt: 'p',
          output_format: { type: 'object', properties: { ok: { type: 'boolean' } } },
        } as unknown as DagNode,
      ],
      'pi'
    );

    const issues = await validateWorkflowResources(workflow, tmpDir);
    const error = issues.find(i => i.level === 'error' && i.field === 'output_format');
    expect(error).toBeDefined();
    expect(error!.message).toContain('best-effort structured output');
    expect(error!.badBehaviour).toMatchObject({
      pattern: 'best_effort_surface',
      classification: 'bug',
    });
  });
});

// =============================================================================
// validateWorkflowResources — workflow-level sandbox capability
// =============================================================================

describe('validateWorkflowResources — workflow-level sandbox capability', () => {
  test('errors when provider does not support workflow-level sandbox settings', async () => {
    const workflow = {
      ...makeWorkflow('test', [{ id: 'step1', prompt: 'p' } as unknown as DagNode], 'codex'),
      sandbox: { mode: 'read-only' },
    } as WorkflowDefinition;

    const issues = await validateWorkflowResources(workflow, tmpDir);
    const error = issues.find(i => i.level === 'error' && i.field === 'sandbox');
    expect(error).toBeDefined();
    expect(error!.message).toContain(
      "Workflow-level sandbox settings are not supported by provider 'codex'"
    );
    expect(error!.badBehaviour?.pattern).toBe('unsupported_control');
  });

  test('accepts workflow-level sandbox settings when provider supports sandbox', async () => {
    const workflow = {
      ...makeWorkflow('test', [{ id: 'step1', prompt: 'p' } as unknown as DagNode], 'claude'),
      sandbox: { mode: 'read-only' },
    } as WorkflowDefinition;

    const issues = await validateWorkflowResources(workflow, tmpDir);
    const error = issues.find(i => i.level === 'error' && i.field === 'sandbox');
    expect(error).toBeUndefined();
  });

  test('errors when node provider override cannot enforce inherited workflow-level sandbox', async () => {
    const workflow = {
      ...makeWorkflow(
        'test',
        [{ id: 'step1', prompt: 'p', provider: 'codex' } as unknown as DagNode],
        'claude'
      ),
      sandbox: { mode: 'read-only' },
    } as WorkflowDefinition;

    const issues = await validateWorkflowResources(workflow, tmpDir);
    const error = issues.find(
      i => i.level === 'error' && i.nodeId === 'step1' && i.field === 'sandbox'
    );
    expect(error).toBeDefined();
    expect(error!.message).toContain("Workflow-level sandbox settings apply to node 'step1'");
    expect(error!.message).toContain("provider 'codex'");
    expect(error!.badBehaviour).toMatchObject({
      pattern: 'unsupported_control',
      classification: 'bug',
    });
  });
});

// =============================================================================
// validateWorkflowResources — inherited workflow-level advisory controls
// =============================================================================

describe('validateWorkflowResources — inherited workflow-level advisory controls', () => {
  test('warns when node provider override cannot honor inherited workflow-level model controls', async () => {
    const workflow = {
      ...makeWorkflow(
        'test',
        [{ id: 'step1', prompt: 'p', provider: 'codex' } as unknown as DagNode],
        'claude'
      ),
      effort: 'high',
      thinking: { type: 'enabled', budgetTokens: 4000 },
      betas: ['example-beta'],
      fallbackModel: 'fallback-model',
    } as WorkflowDefinition;

    const issues = await validateWorkflowResources(workflow, tmpDir);
    const inheritedErrors = issues.filter(i => i.level === 'error' && i.nodeId === 'step1');

    expect(inheritedErrors.map(i => i.field).sort()).toEqual([
      'betas',
      'effort',
      'fallbackModel',
      'thinking',
    ]);
    for (const issue of inheritedErrors) {
      expect(issue.badBehaviour).toMatchObject({
        pattern: 'unsupported_control',
        classification: 'bug',
      });
      expect(issue.message).toContain("applies to node 'step1'");
      expect(issue.message).toContain("provider 'codex'");
      expect(issue.message).toContain('must fail closed');
    }
  });
});
