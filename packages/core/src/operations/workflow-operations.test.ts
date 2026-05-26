import { describe, test, expect, mock, beforeEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock DB modules before importing the module under test
// ---------------------------------------------------------------------------

const mockGetWorkflowRun = mock(() => Promise.resolve(null));
const mockListWorkflowRuns = mock(() => Promise.resolve([]));
const mockUpdateWorkflowRun = mock(() => Promise.resolve());
const mockCancelWorkflowRun = mock(() => Promise.resolve());

mock.module('../db/workflows', () => ({
  getWorkflowRun: mockGetWorkflowRun,
  listWorkflowRuns: mockListWorkflowRuns,
  updateWorkflowRun: mockUpdateWorkflowRun,
  cancelWorkflowRun: mockCancelWorkflowRun,
}));

const mockCreateWorkflowEvent = mock(() => Promise.resolve(true));

mock.module('../db/workflow-events', () => ({
  createWorkflowEvent: mockCreateWorkflowEvent,
}));

const mockEmitWorkflowEvent = mock(() => undefined);
mock.module('@archon/workflows/event-emitter', () => ({
  getWorkflowEventEmitter: () => ({
    emit: mockEmitWorkflowEvent,
  }),
}));

const mockLogger = {
  fatal: mock(() => undefined),
  error: mock(() => undefined),
  warn: mock(() => undefined),
  info: mock(() => undefined),
  debug: mock(() => undefined),
  trace: mock(() => undefined),
};
mock.module('@archon/paths', () => ({
  createLogger: mock(() => mockLogger),
}));

// Import AFTER mocks
const { approveWorkflow, rejectWorkflow, getWorkflowStatus, resumeWorkflow, abandonWorkflow } =
  await import('./workflow-operations');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePausedRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    workflow_name: 'test-workflow',
    conversation_id: 'conv-1',
    parent_conversation_id: null,
    codebase_id: 'cb-1',
    status: 'paused',
    user_message: 'test',
    metadata: {
      approval: {
        nodeId: 'review',
        message: 'Please review',
        type: 'approval',
      },
    },
    started_at: new Date(),
    completed_at: null,
    last_activity_at: null,
    working_path: '/workspace/worktree',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('approveWorkflow', () => {
  beforeEach(() => {
    mockGetWorkflowRun.mockClear();
    mockCreateWorkflowEvent.mockClear();
    mockUpdateWorkflowRun.mockClear();
    mockEmitWorkflowEvent.mockClear();
  });

  test('approves standard approval gate — writes node_completed + approval_received', async () => {
    mockGetWorkflowRun.mockResolvedValueOnce(makePausedRun());

    const result = await approveWorkflow('run-1', 'Looks good');

    expect(result.type).toBe('approval_gate');
    expect(result.workflowName).toBe('test-workflow');
    expect(result.workingPath).toBe('/workspace/worktree');

    // node_completed + approval_received = 2 events
    expect(mockCreateWorkflowEvent).toHaveBeenCalledTimes(2);
    const firstCall = mockCreateWorkflowEvent.mock.calls[0][0] as Record<string, unknown>;
    expect(firstCall.event_type).toBe('node_completed');
    const secondCall = mockCreateWorkflowEvent.mock.calls[1][0] as Record<string, unknown>;
    expect(secondCall.event_type).toBe('approval_received');

    // Transitions to failed + clears rejection state
    expect(mockUpdateWorkflowRun).toHaveBeenCalledWith('run-1', {
      status: 'failed',
      metadata: expect.objectContaining({
        approval_response: 'approved',
        rejection_reason: '',
        rejection_count: 0,
        approval_audit: expect.objectContaining({
          decision: 'approved',
          node_id: 'review',
          approval_scope: 'once',
          approval_channel: 'system',
          high_impact: false,
          high_impact_confirmed: false,
        }),
      }),
    });
  });

  test('emits diagnostic when approval event persistence degrades to best-effort failure', async () => {
    mockGetWorkflowRun.mockResolvedValueOnce(makePausedRun());
    mockCreateWorkflowEvent.mockResolvedValueOnce(false);
    mockCreateWorkflowEvent.mockResolvedValueOnce(true);

    await approveWorkflow('run-1', 'Looks good');

    expect(mockEmitWorkflowEvent).toHaveBeenCalledWith({
      type: 'workflow_event_persist_failed',
      runId: 'run-1',
      eventType: 'node_completed',
      stepName: 'review',
      reason: 'database createWorkflowEvent returned best-effort failure',
      persistence: 'best_effort_failed',
    });
  });

  test('blocks every high-impact approval class from normal chat', async () => {
    for (const mutationClass of ['destructive', 'credential', 'remote', 'production'] as const) {
      mockGetWorkflowRun.mockResolvedValueOnce(
        makePausedRun({
          metadata: {
            approval: {
              nodeId: `${mutationClass}-gate`,
              message: `Approve ${mutationClass} operation?`,
              type: 'approval',
              mutationClass,
            },
          },
        })
      );

      await expect(
        approveWorkflow('run-1', 'Approved', { approvalChannel: 'chat' })
      ).rejects.toThrow(
        `High-impact approval '${mutationClass}' cannot be approved from normal chat`
      );
    }
    expect(mockCreateWorkflowEvent).not.toHaveBeenCalled();
    expect(mockUpdateWorkflowRun).not.toHaveBeenCalled();
  });

  test('blocks explicit highImpact custom approval class from normal chat', async () => {
    mockGetWorkflowRun.mockResolvedValueOnce(
      makePausedRun({
        metadata: {
          approval: {
            nodeId: 'network-gate',
            message: 'Change network boundary?',
            type: 'approval',
            mutationClass: 'network_boundary',
            highImpact: true,
          },
        },
      })
    );

    await expect(approveWorkflow('run-1', 'Approved', { approvalChannel: 'chat' })).rejects.toThrow(
      "High-impact approval 'network_boundary' cannot be approved from normal chat"
    );
    expect(mockCreateWorkflowEvent).not.toHaveBeenCalled();
    expect(mockUpdateWorkflowRun).not.toHaveBeenCalled();
  });

  test('allows high-impact approval from explicit CLI channel', async () => {
    mockGetWorkflowRun.mockResolvedValueOnce(
      makePausedRun({
        metadata: {
          approval: {
            nodeId: 'destructive-gate',
            message: 'Delete remote resources?',
            type: 'approval',
            mutationClass: 'destructive',
          },
        },
      })
    );

    const result = await approveWorkflow('run-1', 'Approved', {
      approvalChannel: 'cli',
      highImpactConfirmed: true,
    });

    expect(result.type).toBe('approval_gate');
    expect(mockCreateWorkflowEvent).toHaveBeenCalledTimes(2);
  });

  test('approves interactive_loop — writes only approval_received, stores loop_user_input', async () => {
    const run = makePausedRun({
      metadata: {
        approval: {
          nodeId: 'iterate',
          message: 'Provide feedback',
          type: 'interactive_loop',
          iteration: 2,
        },
      },
    });
    mockGetWorkflowRun.mockResolvedValueOnce(run);

    const result = await approveWorkflow('run-1', 'fix the tests');

    expect(result.type).toBe('interactive_loop');

    // Only approval_received — NOT node_completed
    expect(mockCreateWorkflowEvent).toHaveBeenCalledTimes(1);
    const call = mockCreateWorkflowEvent.mock.calls[0][0] as Record<string, unknown>;
    expect(call.event_type).toBe('approval_received');

    // Stores loop_user_input in metadata
    expect(mockUpdateWorkflowRun).toHaveBeenCalledWith('run-1', {
      status: 'failed',
      metadata: expect.objectContaining({
        loop_user_input: 'fix the tests',
        approval_audit: expect.objectContaining({
          decision: 'approved',
          node_id: 'iterate',
          approval_scope: 'once',
          approval_channel: 'system',
          high_impact: false,
          high_impact_confirmed: false,
        }),
      }),
    });
  });

  test('approves with captureResponse — stores comment as node output', async () => {
    const run = makePausedRun({
      metadata: {
        approval: {
          nodeId: 'review',
          message: 'Review',
          type: 'approval',
          captureResponse: true,
        },
      },
    });
    mockGetWorkflowRun.mockResolvedValueOnce(run);

    await approveWorkflow('run-1', 'My review notes');

    const nodeCompletedCall = mockCreateWorkflowEvent.mock.calls[0][0] as Record<string, unknown>;
    expect((nodeCompletedCall.data as Record<string, unknown>).node_output).toBe('My review notes');
  });

  test('throws on non-paused run', async () => {
    mockGetWorkflowRun.mockResolvedValueOnce(makePausedRun({ status: 'running' }));

    await expect(approveWorkflow('run-1')).rejects.toThrow(
      "Cannot approve run with status 'running'"
    );
  });

  test('throws on missing approval context', async () => {
    mockGetWorkflowRun.mockResolvedValueOnce(makePausedRun({ metadata: {} }));

    await expect(approveWorkflow('run-1')).rejects.toThrow('missing approval context');
  });

  test('throws on run not found', async () => {
    mockGetWorkflowRun.mockResolvedValueOnce(null);

    await expect(approveWorkflow('run-1')).rejects.toThrow('Workflow run not found: run-1');
  });
});

describe('rejectWorkflow', () => {
  beforeEach(() => {
    mockGetWorkflowRun.mockClear();
    mockCreateWorkflowEvent.mockClear();
    mockUpdateWorkflowRun.mockClear();
    mockCancelWorkflowRun.mockClear();
  });

  test('rejects with onRejectPrompt under max attempts — transitions to failed', async () => {
    const run = makePausedRun({
      metadata: {
        approval: {
          nodeId: 'review',
          message: 'Review',
          onRejectPrompt: 'Fix: $REJECTION_REASON',
          onRejectMaxAttempts: 3,
        },
        rejection_count: 0,
      },
    });
    mockGetWorkflowRun.mockResolvedValueOnce(run);

    const result = await rejectWorkflow('run-1', 'needs more tests', {
      approvalChannel: 'cli',
    });

    expect(result.cancelled).toBe(false);
    expect(result.workflowName).toBe('test-workflow');
    expect(mockCancelWorkflowRun).not.toHaveBeenCalled();
    const rejectionEvent = mockCreateWorkflowEvent.mock.calls[0][0] as {
      data?: Record<string, unknown>;
    };
    expect(rejectionEvent.data).toEqual(
      expect.objectContaining({
        decision: 'rejected',
        approval_channel: 'cli',
      })
    );
    expect(mockUpdateWorkflowRun).toHaveBeenCalledWith('run-1', {
      status: 'failed',
      metadata: expect.objectContaining({
        rejection_reason: 'needs more tests',
        rejection_count: 1,
        approval_audit: expect.objectContaining({
          decision: 'rejected',
          node_id: 'review',
          rejection_reason: 'needs more tests',
          approval_channel: 'cli',
          high_impact: false,
          high_impact_confirmed: false,
        }),
      }),
    });
  });

  test('rejects at max attempts — cancels run', async () => {
    const run = makePausedRun({
      metadata: {
        approval: {
          nodeId: 'review',
          message: 'Review',
          onRejectPrompt: 'Fix: $REJECTION_REASON',
          onRejectMaxAttempts: 2,
        },
        rejection_count: 1,
      },
    });
    mockGetWorkflowRun.mockResolvedValueOnce(run);

    const result = await rejectWorkflow('run-1', 'still broken');

    expect(result.cancelled).toBe(true);
    expect(mockCancelWorkflowRun).not.toHaveBeenCalled();
    expect(mockUpdateWorkflowRun).toHaveBeenCalledWith('run-1', {
      status: 'cancelled',
      metadata: expect.objectContaining({
        rejection_reason: 'still broken',
        rejection_count: 2,
        approval_audit: expect.objectContaining({
          decision: 'rejected',
          node_id: 'review',
          rejection_reason: 'still broken',
          approval_channel: 'system',
        }),
      }),
    });
  });

  test('rejects without onRejectPrompt — cancels immediately', async () => {
    mockGetWorkflowRun.mockResolvedValueOnce(makePausedRun());

    const result = await rejectWorkflow('run-1', 'no good');

    expect(result.cancelled).toBe(true);
    expect(mockCancelWorkflowRun).not.toHaveBeenCalled();
    expect(mockUpdateWorkflowRun).toHaveBeenCalledWith('run-1', {
      status: 'cancelled',
      metadata: expect.objectContaining({
        rejection_reason: 'no good',
        approval_audit: expect.objectContaining({
          decision: 'rejected',
          node_id: 'review',
          rejection_reason: 'no good',
          approval_channel: 'system',
        }),
      }),
    });
  });

  test('throws on non-paused run', async () => {
    mockGetWorkflowRun.mockResolvedValueOnce(makePausedRun({ status: 'completed' }));

    await expect(rejectWorkflow('run-1')).rejects.toThrow(
      "Cannot reject run with status 'completed'"
    );
  });
});

describe('getWorkflowStatus', () => {
  beforeEach(() => {
    mockListWorkflowRuns.mockClear();
  });

  test('returns running and paused runs', async () => {
    const runs = [
      makePausedRun({ status: 'running' }),
      makePausedRun({ id: 'run-2', status: 'paused' }),
    ];
    mockListWorkflowRuns.mockResolvedValueOnce(runs);

    const result = await getWorkflowStatus();

    expect(result.runs).toHaveLength(2);
    expect(mockListWorkflowRuns).toHaveBeenCalledWith({
      status: ['running', 'paused'],
      limit: 50,
    });
  });
});

describe('resumeWorkflow', () => {
  beforeEach(() => {
    mockGetWorkflowRun.mockClear();
  });

  test('returns run when status is resumable', async () => {
    mockGetWorkflowRun.mockResolvedValueOnce(makePausedRun({ status: 'failed' }));

    const run = await resumeWorkflow('run-1');
    expect(run.id).toBe('run-1');
  });

  test('throws on non-resumable status', async () => {
    mockGetWorkflowRun.mockResolvedValueOnce(makePausedRun({ status: 'completed' }));

    await expect(resumeWorkflow('run-1')).rejects.toThrow(
      "Cannot resume run with status 'completed'"
    );
  });

  test('throws wrapped message and logs when DB throws', async () => {
    mockGetWorkflowRun.mockRejectedValueOnce(new Error('connection reset'));

    await expect(resumeWorkflow('run-1')).rejects.toThrow(
      'Failed to look up workflow run run-1: connection reset'
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run-1' }),
      'operations.workflow_resume_lookup_failed'
    );
  });
});

describe('abandonWorkflow', () => {
  beforeEach(() => {
    mockGetWorkflowRun.mockClear();
    mockCancelWorkflowRun.mockClear();
  });

  test('cancels a non-terminal run', async () => {
    mockGetWorkflowRun.mockResolvedValueOnce(makePausedRun({ status: 'running' }));

    const run = await abandonWorkflow('run-1');
    expect(run.id).toBe('run-1');
    expect(mockCancelWorkflowRun).toHaveBeenCalledWith('run-1');
  });

  test('throws on terminal run', async () => {
    mockGetWorkflowRun.mockResolvedValueOnce(makePausedRun({ status: 'completed' }));

    await expect(abandonWorkflow('run-1')).rejects.toThrow(
      "Cannot abandon run with status 'completed'"
    );
  });
});
