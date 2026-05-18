import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { ConversationLockManager } from '@archon/core';
import type { WebAdapter } from '../adapters/web';
import { validationErrorHook } from './openapi-defaults';
import { mockAllWorkflowModules } from '../test/workflow-mock-factories';

const mockListCodebases = mock(async () => [{ default_cwd: '/tmp/project' }]);
const testContextIntent = {
  objective: 'Implement native loop',
  normalizedObjective: 'implement native loop',
  intentHash: 'intent-123',
  cwd: '/tmp/project',
  commitSha: 'abc123',
  generatedAt: '2026-05-18T12:00:00.000Z',
};
const testEvidenceBlockers: [] = [];
const testEvidenceResolution = {
  required: true,
  items: [
    {
      evidenceId: 'graph-waiver.bmad-plugins-marketplace',
      capabilityId: 'graph-context',
      targetKind: 'graph',
      targetName: 'bmad-plugins-marketplace',
      resolver: 'approval',
      reason: 'Graph evidence failed.',
      nextAction: 'Keep waiver explicit or request graph refresh approval.',
      requiresApproval: true,
      blockingAcceptanceIds: ['AC-ACO-WAIVER-001'],
      expectedSuccessEvidence: ['Graph waiver remains visible.'],
    },
  ],
};
const testNextDecision = {
  schemaVersion: 'aco.next-decision.v1',
  kind: 'approval_required',
  title: 'Approval required',
  summary: 'Implementation needs explicit graph waiver approval.',
  primaryAction: {
    id: 'next.approve-current-graph-waivers',
    kind: 'approval',
    label: 'Approve preserving current graph waivers',
    payload: {
      waiverIds: ['graph-waiver.bmad-plugins-marketplace', 'graph-waiver.bmad-sample-data'],
    },
    requiresApproval: true,
    willRun: false,
    successEvidence: ['User approves preserving listed graph waivers.'],
  },
  secondaryActions: [],
  decisionFactors: [
    {
      id: 'graph',
      status: 'forbidden',
      source: 'graphContext.status',
      summary: 'Graph waivers remain active.',
    },
  ],
  evidenceSummary: {
    readiness: 'needs_approval',
    validationStatus: 'passed',
    graphStatus: 'forbidden',
    graphWaivers: 2,
    evidenceBlockers: 0,
    evidenceResolutionRequired: true,
    ledgerSummary: {
      toolAvailability: { total: 0, counts: zeroLedgerCounts() },
      commands: { total: 0, counts: zeroLedgerCounts() },
      combined: { total: 0, counts: zeroLedgerCounts() },
    },
  },
  waiverIds: ['graph-waiver.bmad-plugins-marketplace', 'graph-waiver.bmad-sample-data'],
  evidenceBlockerIds: [],
  evidenceResolutionIds: ['graph-waiver.bmad-plugins-marketplace'],
  nextPrompt: 'Request explicit approval before implementation.',
};

const mockGetContextOrchestratorStatus = mock(async (_cwd: string, _options?: unknown) => ({
  cwd: '/tmp/project',
  contextIntent: testContextIntent,
  validationStatus: 'passed',
  graphStatus: 'forbidden',
  graphWaivers: 2,
  graphWaiverIds: ['graph-waiver.bmad-plugins-marketplace', 'graph-waiver.bmad-sample-data'],
  waivers: [],
  approvalRequired: true,
  readiness: 'needs_approval',
  ledgerSchemaVersion: 'aco.ledger-bundle.v1',
  evidenceBlockers: testEvidenceBlockers,
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
  evidenceResolution: testEvidenceResolution,
  nextDecision: testNextDecision,
}));
const mockGetContextOrchestratorLedgers = mock(async (_cwd: string, _options?: unknown) => ({
  schemaVersion: 'aco.ledger-bundle.v1',
  contextIntent: testContextIntent,
  toolAvailability: [],
  commands: [],
  evidenceBlockers: testEvidenceBlockers,
  summary: {
    toolAvailability: { total: 0, counts: zeroLedgerCounts() },
    commands: { total: 0, counts: zeroLedgerCounts() },
    combined: { total: 0, counts: zeroLedgerCounts() },
  },
}));
const mockRouteBmad = mock((_input: { prompt: string }) => ({
  id: 'brownfield-architecture',
  label: 'Brownfield Architecture',
  steps: ['bmad-investigate', 'bmad-create-architecture'],
  rationale: 'Architecture-sensitive request.',
}));
const mockCompilePromptPackage = mock(async (_input: { cwd: string; prompt: string }) => ({
  archivePath: '/tmp/project/.archon/artifacts/context-orchestrator/run-1',
  files: {
    'manifest.json': '/tmp/project/.archon/artifacts/context-orchestrator/run-1/manifest.json',
  },
  package: {
    runId: 'run-1',
    contextIntent: testContextIntent,
    graphContext: {
      status: 'forbidden',
      waiverCount: 2,
      waivers: [],
    },
    validationReport: { status: 'passed' },
    bmadRoute: mockRouteBmad({ prompt: 'compile' }),
    ledgerBundle: {
      schemaVersion: 'aco.ledger-bundle.v1',
      evidenceBlockers: testEvidenceBlockers,
      summary: {
        toolAvailability: { total: 0, counts: zeroLedgerCounts() },
        commands: { total: 0, counts: zeroLedgerCounts() },
        combined: { total: 0, counts: zeroLedgerCounts() },
      },
    },
    evidenceResolution: testEvidenceResolution,
    nextDecision: testNextDecision,
  },
}));
const mockReadArtifactPackageManifest = mock(async (_cwd: string, _runId: string) => ({
  runId: 'run-1',
  archivePath: '/tmp/project/.archon/artifacts/context-orchestrator/run-1',
  manifest: { runId: 'run-1', ledgerSchemaVersion: 'aco.ledger-bundle.v1' },
  files: [
    {
      name: 'manifest.json',
      path: '/tmp/project/.archon/artifacts/context-orchestrator/run-1/manifest.json',
    },
  ],
}));

function zeroLedgerCounts(): Record<string, number> {
  return {
    available: 0,
    partial: 0,
    blocked: 0,
    deferred: 0,
    forbidden: 0,
    'not used': 0,
    unknown: 0,
  };
}

mock.module('@archon/context-orchestrator', () => ({
  getContextOrchestratorStatus: mockGetContextOrchestratorStatus,
  getContextOrchestratorLedgers: mockGetContextOrchestratorLedgers,
  routeBmad: mockRouteBmad,
  compilePromptPackage: mockCompilePromptPackage,
  readArtifactPackageManifest: mockReadArtifactPackageManifest,
  serializeLedgerBundle: (bundle: unknown) => bundle,
  getContextOrchestratorReadiness: () => 'needs_approval',
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
    mockGetContextOrchestratorStatus.mockImplementation(
      async (_cwd: string, _options?: unknown) => ({
        cwd: '/tmp/project',
        contextIntent: testContextIntent,
        validationStatus: 'passed',
        graphStatus: 'forbidden',
        graphWaivers: 2,
        graphWaiverIds: ['graph-waiver.bmad-plugins-marketplace', 'graph-waiver.bmad-sample-data'],
        waivers: [],
        approvalRequired: true,
        readiness: 'needs_approval',
        ledgerSchemaVersion: 'aco.ledger-bundle.v1',
        evidenceBlockers: testEvidenceBlockers,
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
        evidenceResolution: testEvidenceResolution,
        nextDecision: testNextDecision,
      })
    );
    mockGetContextOrchestratorLedgers.mockClear();
    mockRouteBmad.mockClear();
    mockCompilePromptPackage.mockClear();
    mockReadArtifactPackageManifest.mockClear();
  });

  test('AC-P1-API returns raw ACO status for a registered cwd', async () => {
    const app = makeApp();
    const response = await app.request(
      '/api/aco/status?cwd=/tmp/project&objective=Implement+native+loop'
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ledgerSchemaVersion?: string;
      graphStatus?: string;
      graphWaiverIds?: string[];
      readiness?: string;
      contextIntent?: { intentHash?: string };
      evidenceResolution?: { required?: boolean };
      nextDecision?: { kind?: string; primaryAction?: { willRun?: boolean } };
    };
    expect(body.ledgerSchemaVersion).toBe('aco.ledger-bundle.v1');
    expect(body.contextIntent?.intentHash).toBe('intent-123');
    expect(body.graphStatus).toBe('forbidden');
    expect(body.readiness).toBe('needs_approval');
    expect(body.evidenceResolution?.required).toBe(true);
    expect(body.nextDecision?.kind).toBe('approval_required');
    expect(body.nextDecision?.primaryAction?.willRun).toBe(false);
    expect(body.graphWaiverIds).toContain('graph-waiver.bmad-plugins-marketplace');
    expect(mockGetContextOrchestratorStatus).toHaveBeenCalledWith('/tmp/project', {
      objective: 'Implement native loop',
    });
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
    expect(body.error).toBe('Context Orchestrator status read failed');
    expect(body.detail).toContain('status unavailable');
  });

  test('AC-P1-API returns ledger bundle for a registered cwd', async () => {
    const app = makeApp();
    const response = await app.request('/api/aco/ledgers?cwd=/tmp/project');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { schemaVersion?: string };
    expect(body.schemaVersion).toBe('aco.ledger-bundle.v1');
    expect(mockGetContextOrchestratorLedgers).toHaveBeenCalledWith('/tmp/project', {
      objective: undefined,
    });
  });

  test('AC-P1-API routes a request for a registered cwd', async () => {
    const app = makeApp();
    const response = await app.request('/api/aco/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd: '/tmp/project', prompt: 'Implement a feature' }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { id?: string; steps?: string[] };
    expect(body.id).toBe('brownfield-architecture');
    expect(body.steps).toContain('bmad-investigate');
    expect(mockRouteBmad).toHaveBeenCalledWith({ prompt: 'Implement a feature' });
  });

  test('AC-P1-API compiles a package for a registered cwd', async () => {
    const app = makeApp();
    const response = await app.request('/api/aco/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd: '/tmp/project', prompt: 'Compile context', runId: 'run-1' }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      runId?: string;
      archivePath?: string;
      readiness?: string;
      evidenceResolution?: { required?: boolean };
      nextDecision?: { kind?: string };
    };
    expect(body.runId).toBe('run-1');
    expect(body.readiness).toBe('needs_approval');
    expect(body.evidenceResolution?.required).toBe(true);
    expect(body.nextDecision?.kind).toBe('approval_required');
    expect(body.archivePath).toContain('context-orchestrator');
    expect(mockCompilePromptPackage).toHaveBeenCalledWith({
      cwd: '/tmp/project',
      prompt: 'Compile context',
      runId: 'run-1',
      timestamp: undefined,
      cavemanMode: undefined,
    });
  });

  test('AC-P1-API rejects compile for unregistered cwd', async () => {
    const app = makeApp();
    const response = await app.request('/api/aco/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd: '/tmp/other', prompt: 'Compile context' }),
    });

    expect(response.status).toBe(404);
    expect(mockCompilePromptPackage).not.toHaveBeenCalled();
  });

  test('AC-P1-API resolves subdirectories to the registered codebase cwd', async () => {
    const app = makeApp();
    const response = await app.request('/api/aco/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd: '/tmp/project/packages/server', prompt: 'Compile context' }),
    });

    expect(response.status).toBe(200);
    expect(mockCompilePromptPackage).toHaveBeenCalledWith({
      cwd: '/tmp/project',
      prompt: 'Compile context',
      runId: undefined,
      timestamp: undefined,
      cavemanMode: undefined,
    });
  });

  test('AC-P1-API looks up manifest-backed artifact packages', async () => {
    const app = makeApp();
    const response = await app.request('/api/aco/artifact-packages/run-1?cwd=/tmp/project');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { manifest?: { runId?: string } };
    expect(body.manifest?.runId).toBe('run-1');
    expect(mockReadArtifactPackageManifest).toHaveBeenCalledWith('/tmp/project', 'run-1');
  });

  test('AC-P1-API rejects artifact package traversal run IDs', async () => {
    mockReadArtifactPackageManifest.mockImplementationOnce(async () => {
      throw new Error('Invalid ACO archive runId: ../escape');
    });
    const app = makeApp();
    const response = await app.request('/api/aco/artifact-packages/..%2Fescape?cwd=/tmp/project');

    expect(response.status).toBe(400);
  });
});
