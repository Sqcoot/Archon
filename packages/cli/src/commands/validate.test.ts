import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { makeTestWorkflowWithSource } from '@archon/workflows/test-utils';

const mockDiscoverWorkflowsWithConfig = mock(() => Promise.resolve({ workflows: [], errors: [] }));
const mockValidateWorkflowResources = mock(async () => [] as Array<Record<string, unknown>>);
const mockFindSimilar = mock((_: string, candidates: string[]) => candidates.slice(0, 3));
const mockLoadConfig = mock(() => Promise.resolve({ assistant: 'codex', envVars: {} }));
const mockLoadRepoConfig = mock(() => Promise.resolve(null));

mock.module('@archon/workflows/workflow-discovery', () => ({
  discoverWorkflowsWithConfig: mockDiscoverWorkflowsWithConfig,
}));

mock.module('@archon/workflows/validator', () => ({
  validateWorkflowResources: mockValidateWorkflowResources,
  validateCommand: mock(() => Promise.resolve({ commandName: 'mock', valid: true, issues: [] })),
  validateScript: mock(() => Promise.resolve({ scriptName: 'mock', valid: true, issues: [] })),
  discoverAvailableCommands: mock(() => Promise.resolve([])),
  discoverAvailableScripts: mock(() => Promise.resolve([])),
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
    mockLoadConfig.mockResolvedValue({ assistant: 'codex', envVars: {} });
    mockLoadRepoConfig.mockResolvedValue(null);
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
