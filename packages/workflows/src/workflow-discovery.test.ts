import { beforeEach, describe, expect, mock, test } from 'bun:test';

const mockReadFile = mock(async (_path: string, _encoding: string): Promise<string> => '');
const mockReaddir = mock(async (_path: string): Promise<string[]> => []);
const mockAccess = mock(async (_path: string): Promise<void> => undefined);
const mockStat = mock(async (_path: string) => ({ isDirectory: () => false }));

mock.module('fs/promises', () => ({
  readFile: mockReadFile,
  readdir: mockReaddir,
  access: mockAccess,
  stat: mockStat,
}));

const mockLogger = {
  fatal: mock(() => undefined),
  error: mock(() => undefined),
  warn: mock(() => undefined),
  info: mock(() => undefined),
  debug: mock(() => undefined),
  trace: mock(() => undefined),
};

let mockDefaultWorkflowsPath = '/app/.archon/workflows/defaults';

mock.module('@archon/paths', () => ({
  createLogger: mock(() => mockLogger),
  getLegacyHomeWorkflowsPath: mock(() => '/home/.archon/.archon/workflows'),
  getHomeWorkflowsPath: mock(() => '/home/.archon/workflows'),
  getArchonHome: mock(() => '/home/.archon'),
  getWorkflowFolderSearchPaths: mock(() => ['.archon/workflows']),
  getDefaultWorkflowsPath: mock(() => mockDefaultWorkflowsPath),
}));

mock.module('./defaults/bundled-defaults', () => ({
  BUNDLED_WORKFLOWS: {},
  isBinaryBuild: mock(() => false),
}));

mock.module('./loader', () => ({
  parseWorkflow: mock((_content: string, filename: string) => ({
    workflow: { name: filename },
  })),
}));

import { discoverWorkflows, resetLegacyHomeWarningForTests } from './workflow-discovery';

const pathEntries = new Map<string, string[]>();
const existingPaths = new Set<string>();

const enoent = (path: string): NodeJS.ErrnoException =>
  Object.assign(new Error(`ENOENT: no such file or directory, access '${path}'`), {
    code: 'ENOENT',
  });

describe('deprecated repo defaults warning', () => {
  beforeEach(() => {
    pathEntries.clear();
    existingPaths.clear();
    mockReadFile.mockClear();
    mockReaddir.mockClear();
    mockAccess.mockClear();
    mockStat.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.info.mockClear();
    mockLogger.debug.mockClear();
    resetLegacyHomeWarningForTests();

    mockAccess.mockImplementation(async (path: string) => {
      if (existingPaths.has(path)) return;
      throw enoent(path);
    });

    mockReaddir.mockImplementation(async (path: string) => {
      const entries = pathEntries.get(path);
      if (entries) return entries;
      throw enoent(path);
    });
  });

  test('skips deprecated warning when repo defaults path is app defaults path', async () => {
    const cwd = '/source';
    const workflowPath = '/source/.archon/workflows';
    const repoDefaultsPath = '/source/.archon/workflows/defaults';
    mockDefaultWorkflowsPath = repoDefaultsPath;

    existingPaths.add(workflowPath);
    existingPaths.add(repoDefaultsPath);
    pathEntries.set(workflowPath, []);
    pathEntries.set(repoDefaultsPath, ['context-orchestrate.yaml']);

    await discoverWorkflows(cwd, { loadDefaults: false });

    const deprecatedCalls = mockLogger.warn.mock.calls.filter(
      call => call[1] === 'deprecated_workflow_defaults_found'
    );
    expect(deprecatedCalls.length).toBe(0);
  });

  test('warns on deprecated non-prefixed defaults outside app defaults path', async () => {
    const cwd = '/repo';
    const workflowPath = '/repo/.archon/workflows';
    const repoDefaultsPath = '/repo/.archon/workflows/defaults';
    mockDefaultWorkflowsPath = '/app/.archon/workflows/defaults';

    existingPaths.add(workflowPath);
    existingPaths.add(repoDefaultsPath);
    pathEntries.set(workflowPath, []);
    pathEntries.set(repoDefaultsPath, ['context-orchestrate.yaml']);

    await discoverWorkflows(cwd, { loadDefaults: false });

    const deprecatedCalls = mockLogger.warn.mock.calls.filter(
      call => call[1] === 'deprecated_workflow_defaults_found'
    );
    expect(deprecatedCalls.length).toBe(1);
    expect(deprecatedCalls[0]?.[0]).toEqual(
      expect.objectContaining({ count: 1, repoDefaultsPath })
    );
  });
});
