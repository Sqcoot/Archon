import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { makeTestWorkflowWithSource } from '@archon/workflows/test-utils';

const mockDiscoverWorkflowsWithConfig = mock(() => Promise.resolve({ workflows: [], errors: [] }));
const mockValidateWorkflowResources = mock(async () => [] as Array<Record<string, unknown>>);
const mockValidateCommand = mock(() =>
  Promise.resolve({ commandName: 'mock', valid: true, issues: [] })
);
const mockValidateScript = mock(() =>
  Promise.resolve({ scriptName: 'mock', valid: true, issues: [] })
);
const mockDiscoverAvailableCommands = mock(() => Promise.resolve([] as string[]));
const mockDiscoverAvailableScripts = mock(() =>
  Promise.resolve([] as Array<{ name: string; description?: string }>)
);
const mockFindSimilar = mock((_: string, candidates: string[]) => candidates.slice(0, 3));
const mockLoadConfig = mock(() => Promise.resolve({ assistant: 'codex', envVars: {} }));
const mockLoadRepoConfig = mock(() => Promise.resolve(null));

mock.module('@archon/workflows/workflow-discovery', () => ({
  discoverWorkflowsWithConfig: mockDiscoverWorkflowsWithConfig,
}));

mock.module('@archon/workflows/validator', () => ({
  validateWorkflowResources: mockValidateWorkflowResources,
  validateCommand: mockValidateCommand,
  validateScript: mockValidateScript,
  discoverAvailableCommands: mockDiscoverAvailableCommands,
  discoverAvailableScripts: mockDiscoverAvailableScripts,
  findSimilar: mockFindSimilar,
  makeWorkflowResult: (
    workflowName: string,
    issues: Array<{ level: 'error' | 'warning' }>,
    filename?: string
  ) => ({
    workflowName,
    valid: !issues.some(issue => issue.level === 'error'),
    issues,
    ...(filename ? { filename } : {}),
  }),
}));

mock.module('@archon/core', () => ({
  loadConfig: mockLoadConfig,
  loadRepoConfig: mockLoadRepoConfig,
}));

const { validateWorkflowsCommand } = await import('./validate');
const { validateCommandsCommand } = await import('./validate');

describe('validateWorkflowsCommand', () => {
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    mockDiscoverWorkflowsWithConfig.mockReset();
    mockValidateWorkflowResources.mockReset();
    mockFindSimilar.mockReset();
    mockLoadConfig.mockReset();
    mockLoadRepoConfig.mockReset();
    mockValidateCommand.mockReset();
    mockValidateScript.mockReset();
    mockDiscoverAvailableCommands.mockReset();
    mockDiscoverAvailableScripts.mockReset();
    mockLoadConfig.mockResolvedValue({ assistant: 'codex', envVars: {} });
    mockLoadRepoConfig.mockResolvedValue(null);
    mockValidateCommand.mockResolvedValue({ commandName: 'mock', valid: true, issues: [] });
    mockValidateScript.mockResolvedValue({ scriptName: 'mock', valid: true, issues: [] });
    mockDiscoverAvailableCommands.mockResolvedValue([]);
    mockDiscoverAvailableScripts.mockResolvedValue([]);
    mockFindSimilar.mockImplementation((_: string, candidates: string[]) => candidates.slice(0, 3));
    mockValidateWorkflowResources.mockResolvedValue([]);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('validates only requested workflow when name is provided', async () => {
    mockDiscoverWorkflowsWithConfig.mockResolvedValueOnce({
      workflows: [
        makeTestWorkflowWithSource({ name: 'archon-self-improve', description: 'Self improve' }),
        makeTestWorkflowWithSource({ name: 'archon-prd', description: 'PRD' }),
      ],
      errors: [],
    });

    const exitCode = await validateWorkflowsCommand('/repo', 'archon-self-improve', true);

    expect(exitCode).toBe(0);
    expect(mockValidateWorkflowResources).toHaveBeenCalledTimes(1);
    expect(mockValidateWorkflowResources.mock.calls[0]?.[0].name).toBe('archon-self-improve');

    const jsonOutput = logSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(jsonOutput)) as {
      results: Array<{ workflowName: string }>;
      summary: { total: number };
    };
    expect(parsed.summary.total).toBe(1);
    expect(parsed.results[0]?.workflowName).toBe('archon-self-improve');
  });

  test('returns not-found payload with suggestions when workflow does not exist', async () => {
    mockDiscoverWorkflowsWithConfig.mockResolvedValueOnce({
      workflows: [
        makeTestWorkflowWithSource({ name: 'archon-self-improve', description: 'Self improve' }),
      ],
      errors: [],
    });
    mockFindSimilar.mockReturnValueOnce(['archon-self-improve']);

    const exitCode = await validateWorkflowsCommand('/repo', 'archon-self-imprve', true);

    expect(exitCode).toBe(1);
    expect(mockValidateWorkflowResources).not.toHaveBeenCalled();
    const jsonOutput = logSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(jsonOutput)) as {
      error: string;
      suggestions: string[];
      available: string[];
    };
    expect(parsed.error).toContain("Workflow 'archon-self-imprve' not found");
    expect(parsed.suggestions).toEqual(['archon-self-improve']);
    expect(parsed.available).toContain('archon-self-improve');
  });

  test('returns targeted load error when requested workflow failed to parse', async () => {
    mockDiscoverWorkflowsWithConfig.mockResolvedValueOnce({
      workflows: [
        makeTestWorkflowWithSource({ name: 'archon-self-improve', description: 'Self improve' }),
      ],
      errors: [{ filename: 'broken.yaml', error: 'Invalid YAML', errorType: 'parse_error' }],
    });

    const exitCode = await validateWorkflowsCommand('/repo', 'broken', true);

    expect(exitCode).toBe(1);
    expect(mockValidateWorkflowResources).not.toHaveBeenCalled();
    const jsonOutput = logSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(jsonOutput)) as {
      results: Array<{ workflowName: string }>;
      summary: { total: number; errors: number };
    };
    expect(parsed.summary.total).toBe(1);
    expect(parsed.summary.errors).toBe(1);
    expect(parsed.results[0]?.workflowName).toBe('broken');
  });
});

describe('validateCommandsCommand', () => {
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    mockLoadRepoConfig.mockReset();
    mockValidateCommand.mockReset();
    mockValidateScript.mockReset();
    mockDiscoverAvailableCommands.mockReset();
    mockDiscoverAvailableScripts.mockReset();
    mockLoadRepoConfig.mockResolvedValue(null);
    mockValidateCommand.mockResolvedValue({ commandName: 'mock', valid: true, issues: [] });
    mockValidateScript.mockResolvedValue({ scriptName: 'mock', valid: true, issues: [] });
    mockDiscoverAvailableCommands.mockResolvedValue([]);
    mockDiscoverAvailableScripts.mockResolvedValue([]);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('all-command mode returns JSON payload with command and script summary counts', async () => {
    mockDiscoverAvailableCommands.mockResolvedValueOnce(['archon-prd', 'archon-spec']);
    mockDiscoverAvailableScripts.mockResolvedValueOnce([{ name: 'sync-artifacts' }]);
    mockValidateCommand.mockImplementation(async (commandName: string) => ({
      commandName,
      valid: true,
      issues: [],
    }));
    mockValidateScript.mockImplementation(async (scriptName: string) => ({
      scriptName,
      valid: true,
      issues: [],
    }));

    const exitCode = await validateCommandsCommand('/repo', undefined, true);

    expect(exitCode).toBe(0);
    expect(mockDiscoverAvailableCommands).toHaveBeenCalledWith('/repo', {});
    expect(mockDiscoverAvailableScripts).toHaveBeenCalledWith('/repo');
    expect(mockValidateCommand).toHaveBeenCalledTimes(2);
    expect(mockValidateScript).toHaveBeenCalledTimes(1);

    const jsonOutput = logSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(jsonOutput)) as {
      results: Array<{ commandName: string }>;
      scripts: Array<{ scriptName: string }>;
      summary: { total: number; valid: number; errors: number };
    };
    expect(parsed.results.map(result => result.commandName)).toEqual(['archon-prd', 'archon-spec']);
    expect(parsed.scripts.map(result => result.scriptName)).toEqual(['sync-artifacts']);
    expect(parsed.summary).toEqual({ total: 3, valid: 3, errors: 0 });
  });

  test('all-command mode aggregates command and script errors into exit code and summary', async () => {
    mockDiscoverAvailableCommands.mockResolvedValueOnce(['archon-prd', 'archon-spec']);
    mockDiscoverAvailableScripts.mockResolvedValueOnce([{ name: 'sync-artifacts' }]);
    mockValidateCommand.mockImplementation(async (commandName: string) => ({
      commandName,
      valid: commandName === 'archon-prd',
      issues:
        commandName === 'archon-prd'
          ? []
          : [{ level: 'error', field: 'frontmatter', message: 'Missing description' }],
    }));
    mockValidateScript.mockResolvedValueOnce({
      scriptName: 'sync-artifacts',
      valid: false,
      issues: [{ level: 'error', field: 'script', message: 'Script failed lint' }],
    });

    const exitCode = await validateCommandsCommand('/repo', undefined, true);

    expect(exitCode).toBe(1);
    const jsonOutput = logSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(jsonOutput)) as {
      summary: { total: number; valid: number; errors: number };
    };
    expect(parsed.summary).toEqual({ total: 3, valid: 1, errors: 2 });
  });
});
