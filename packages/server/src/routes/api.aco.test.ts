import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { ConversationLockManager } from '@archon/core';
import type { WebAdapter } from '../adapters/web';
import { validationErrorHook } from './openapi-defaults';
import { mockAllWorkflowModules } from '../test/workflow-mock-factories';

const mockListCodebases = mock(async () => [{ default_cwd: '/tmp/project' }]);
const mockGetContextOrchestratorStatus = mock(async (_cwd: string) => ({
  cwd: '/tmp/project',
  validationStatus: 'passed',
  graphStatus: 'forbidden',
  graphWaivers: 2,
  graphWaiverIds: ['graph-waiver.bmad-plugins-marketplace', 'graph-waiver.bmad-sample-data'],
  ledgerSchemaVersion: 'aco.ledger-bundle.v1',
  ledgerSummary: {
    toolAvailability: {
      total: 20,
      counts: {
        available: 17,
        partial: 1,
        blocked: 0,
        deferred: 0,
        forbidden: 2,
        'not used': 0,
        unknown: 0,
      },
    },
    commands: {
      total: 19,
      counts: {
        available: 9,
        partial: 1,
        blocked: 0,
        deferred: 3,
        forbidden: 6,
        'not used': 0,
        unknown: 0,
      },
    },
    combined: {
      total: 39,
      counts: {
        available: 26,
        partial: 2,
        blocked: 0,
        deferred: 3,
        forbidden: 8,
        'not used': 0,
        unknown: 0,
      },
    },
  },
}));

mock.module('@archon/context-orchestrator', () => ({
  getContextOrchestratorStatus: mockGetContextOrchestratorStatus,
}));

mock.module('@archon/core', () => ({
  handleMessage: mock(async () => {}),
  getDatabaseType: () => 'sqlite',
  loadConfig: mock(async () => ({})),
  cloneRepository: mock(async () => ({ codebaseId: 'x', alreadyExisted: false })),
  registerRepository: mock(async () => ({ codebaseId: 'x', alreadyExisted: false })),
  ConversationNotFoundError: class ConversationNotFoundError extends Error {
    constructor(id: string) {
      super(`Conversation not found: ${id}`);
      this.name = 'ConversationNotFoundError';
    }
  },
  getArchonWorkspacesPath: () => '/tmp/.archon/workspaces',
  toSafeConfig: (config: unknown) => config,
  generateAndSetTitle: mock(async () => {}),
  createLogger: () => ({
    fatal: mock(() => undefined),
    error: mock(() => undefined),
    warn: mock(() => undefined),
    info: mock(() => undefined),
    debug: mock(() => undefined),
    trace: mock(() => undefined),
    child: mock(function (this: unknown) {
      return this;
    }),
    bindings: mock(() => ({ module: 'test' })),
    isLevelEnabled: mock(() => true),
    level: 'info',
  }),
}));

mock.module('@archon/paths', () => ({
  createLogger: () => ({
    fatal: mock(() => undefined),
    error: mock(() => undefined),
    warn: mock(() => undefined),
    info: mock(() => undefined),
    debug: mock(() => undefined),
    trace: mock(() => undefined),
    child: mock(function (this: unknown) {
      return this;
    }),
    bindings: mock(() => ({ module: 'test' })),
    isLevelEnabled: mock(() => true),
    level: 'info',
  }),
  getWorkflowFolderSearchPaths: mock(() => ['.archon/workflows']),
  getCommandFolderSearchPaths: mock(() => ['.archon/commands']),
  getDefaultCommandsPath: mock(() => '/tmp/.archon-test-nonexistent/commands/defaults'),
  getDefaultWorkflowsPath: mock(() => '/tmp/.archon-test-nonexistent/workflows/defaults'),
  getHomeCommandsPath: mock(() => '/tmp/.archon/commands'),
  getHomeWorkflowsPath: mock(() => '/tmp/.archon/workflows'),
  getArchonHome: () => '/tmp/.archon',
  getArchonWorkspacesPath: () => '/tmp/.archon/workspaces',
  getRunArtifactsPath: () => '/tmp/.archon/artifacts',
  isDocker: mock(() => false),
  checkForUpdate: mock(async () => ({ updateAvailable: false })),
  BUNDLED_IS_BINARY: false,
  BUNDLED_VERSION: '0.0.0',
}));

mockAllWorkflowModules();

mock.module('@archon/git', () => ({
  removeWorktree: mock(async () => {}),
  toRepoPath: (p: string) => p,
  toWorktreePath: (p: string) => p,
}));

mock.module('@archon/core/db/conversations', () => ({
  findConversationByPlatformId: mock(async () => null),
  listConversations: mock(async () => []),
  getOrCreateConversation: mock(async () => ({
    id: 'internal-uuid-123',
    platform_conversation_id: 'web-test-abc',
    title: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    platform_type: 'web',
    deleted_at: null,
    codebase_id: null,
    ai_assistant_type: 'claude',
  })),
  softDeleteConversation: mock(async () => {}),
  updateConversationTitle: mock(async () => {}),
  getConversationById: mock(async () => null),
}));

mock.module('@archon/core/db/codebases', () => ({
  listCodebases: mockListCodebases,
  getCodebase: mock(async () => null),
  deleteCodebase: mock(async () => {}),
}));

mock.module('@archon/core/db/isolation-environments', () => ({
  listByCodebase: mock(async () => []),
  updateStatus: mock(async () => {}),
}));

mock.module('@archon/core/db/workflows', () => ({
  listWorkflowRuns: mock(async () => []),
  listDashboardRuns: mock(async () => ({
    runs: [],
    total: 0,
    counts: { all: 0, running: 0, completed: 0, failed: 0, cancelled: 0, pending: 0 },
  })),
  getWorkflowRun: mock(async () => null),
  cancelWorkflowRun: mock(async () => {}),
  getWorkflowRunByWorkerPlatformId: mock(async () => null),
  getRunningWorkflows: mock(async () => []),
}));

mock.module('@archon/core/db/workflow-events', () => ({
  listWorkflowEvents: mock(async () => []),
}));

mock.module('@archon/core/db/messages', () => ({
  addMessage: mock(async () => ({
    id: 'msg-1',
    conversation_id: 'conv-1',
    role: 'user',
    content: 'hello',
    metadata: '{}',
    created_at: new Date().toISOString(),
  })),
  listMessages: mock(async () => []),
}));

mock.module('@archon/core/utils/commands', () => ({
  findMarkdownFilesRecursive: mock(async () => []),
}));

import { registerApiRoutes } from './api';

function makeApp(): OpenAPIHono {
  const app = new OpenAPIHono({ defaultHook: validationErrorHook });
  const mockWebAdapter = {
    setConversationDbId: mock((_platformId: string, _dbId: string) => {}),
    emitSSE: mock(async () => {}),
    emitLockEvent: mock(async () => {}),
  } as unknown as WebAdapter;
  const mockLockManager = {
    acquireLock: mock(async (_id: string, fn: () => Promise<void>) => {
      await fn();
      return { status: 'started' };
    }),
    getStats: mock(() => ({ active: 0, queuedTotal: 0, maxConcurrent: 10 })),
  } as unknown as ConversationLockManager;
  registerApiRoutes(app, mockWebAdapter, mockLockManager);
  return app;
}

describe('GET /api/aco/status', () => {
  beforeEach(() => {
    mockListCodebases.mockReset();
    mockListCodebases.mockImplementation(async () => [{ default_cwd: '/tmp/project' }]);
    mockGetContextOrchestratorStatus.mockReset();
    mockGetContextOrchestratorStatus.mockImplementation(async (_cwd: string) => ({
      cwd: '/tmp/project',
      validationStatus: 'passed',
      graphStatus: 'forbidden',
      graphWaivers: 2,
      graphWaiverIds: ['graph-waiver.bmad-plugins-marketplace', 'graph-waiver.bmad-sample-data'],
      ledgerSchemaVersion: 'aco.ledger-bundle.v1',
      ledgerSummary: {
        toolAvailability: {
          total: 20,
          counts: {
            available: 17,
            partial: 1,
            blocked: 0,
            deferred: 0,
            forbidden: 2,
            'not used': 0,
            unknown: 0,
          },
        },
        commands: {
          total: 19,
          counts: {
            available: 9,
            partial: 1,
            blocked: 0,
            deferred: 3,
            forbidden: 6,
            'not used': 0,
            unknown: 0,
          },
        },
        combined: {
          total: 39,
          counts: {
            available: 26,
            partial: 2,
            blocked: 0,
            deferred: 3,
            forbidden: 8,
            'not used': 0,
            unknown: 0,
          },
        },
      },
    }));
  });

  test('AC-P1-API returns raw ACO status for a registered cwd', async () => {
    const app = makeApp();
    const response = await app.request('/api/aco/status?cwd=/tmp/project');

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ledgerSchemaVersion?: string;
      graphStatus?: string;
      graphWaiverIds?: string[];
    };
    expect(body.ledgerSchemaVersion).toBe('aco.ledger-bundle.v1');
    expect(body.graphStatus).toBe('forbidden');
    expect(body.graphWaiverIds).toContain('graph-waiver.bmad-plugins-marketplace');
    expect(mockGetContextOrchestratorStatus).toHaveBeenCalledWith('/tmp/project');
  });

  test('AC-ACO-STATUS-003 rejects missing cwd before status read', async () => {
    const app = makeApp();
    const response = await app.request('/api/aco/status');

    expect(response.status).toBe(400);
    expect(mockGetContextOrchestratorStatus).not.toHaveBeenCalled();
  });

  test('AC-ACO-STATUS-003 rejects unregistered cwd before status read', async () => {
    const app = makeApp();
    const response = await app.request('/api/aco/status?cwd=/tmp/other');

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBe('cwd is not registered');
    expect(mockGetContextOrchestratorStatus).not.toHaveBeenCalled();
  });

  test('returns 500 when status read fails', async () => {
    mockGetContextOrchestratorStatus.mockImplementationOnce(async () => {
      throw new Error('status unavailable');
    });
    const app = makeApp();
    const response = await app.request('/api/aco/status?cwd=/tmp/project');

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error?: string; detail?: string };
    expect(body.error).toBe('ACO status read failed');
    expect(body.detail).toContain('status unavailable');
  });
});
