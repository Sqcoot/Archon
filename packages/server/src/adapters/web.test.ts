import { describe, test, expect, mock } from 'bun:test';
import type { SSEWriter } from './web/transport';

const mockLogger = {
  fatal: mock(() => undefined),
  error: mock(() => undefined),
  warn: mock(() => undefined),
  info: mock(() => undefined),
  debug: mock(() => undefined),
  trace: mock(() => undefined),
  child: mock(function (this: unknown) {
    return this;
  }),
};

mock.module('@archon/paths', () => ({
  createLogger: mock(() => mockLogger),
}));

import { WebAdapter } from './web';
import { SSETransport } from './web/transport';
import { MessagePersistence } from './web/persistence';
import { WorkflowEventBridge, mapWorkflowEvent } from './web/workflow-bridge';

function createMockStream(): SSEWriter {
  return {
    writeSSE: mock(() => Promise.resolve()),
    close: mock(() => Promise.resolve()),
    closed: false,
  };
}

function createAdapter(): { adapter: WebAdapter; stream: SSEWriter; transport: SSETransport } {
  const transport = new SSETransport();
  const persistence = new MessagePersistence(mock(() => Promise.resolve()));
  const bridge = new WorkflowEventBridge(transport);
  const adapter = new WebAdapter(transport, persistence, bridge);
  const stream = createMockStream();
  adapter.registerStream('conv-1', stream);
  return { adapter, stream, transport };
}

describe('WebAdapter patch events', () => {
  test('maps provider-neutral patch_event chunks to SSE JSON', async () => {
    const { adapter, stream, transport } = createAdapter();

    await adapter.sendStructuredEvent('conv-1', {
      type: 'patch_event',
      provider: 'codex',
      phase: 'final',
      itemId: 'patch-1',
      changes: [
        { kind: 'add', path: 'src/new.ts' },
        { kind: 'delete', path: 'src/old.ts' },
      ],
      path: 'src/new.ts',
      kind: 'add',
      status: 'applied',
    });

    expect(stream.writeSSE).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(
      (stream.writeSSE as ReturnType<typeof mock>).mock.calls[0][0].data
    ) as Record<string, unknown>;
    expect(payload).toMatchObject({
      type: 'patch_event',
      provider: 'codex',
      phase: 'final',
      itemId: 'patch-1',
      path: 'src/new.ts',
      kind: 'add',
      status: 'applied',
    });
    expect(payload.changes).toEqual([
      { kind: 'add', path: 'src/new.ts' },
      { kind: 'delete', path: 'src/old.ts' },
    ]);
    expect(typeof payload.timestamp).toBe('number');

    transport.stop();
  });

  test('maps workflow patch_event milestones to SSE JSON', () => {
    const mapped = mapWorkflowEvent({
      type: 'patch_event',
      runId: 'run-1',
      stepName: 'edit',
      patch: {
        type: 'patch_event',
        provider: 'codex',
        phase: 'final',
        itemId: 'patch-1',
        changes: [{ kind: 'update', path: 'src/app.ts' }],
        path: 'src/app.ts',
        kind: 'update',
        status: 'applied',
      },
    });

    expect(mapped).not.toBeNull();
    const payload = JSON.parse(mapped as string) as Record<string, unknown>;
    expect(payload).toMatchObject({
      type: 'patch_event',
      runId: 'run-1',
      stepName: 'edit',
      provider: 'codex',
      phase: 'final',
      status: 'applied',
    });
    expect(payload.changes).toEqual([{ kind: 'update', path: 'src/app.ts' }]);
  });
});
