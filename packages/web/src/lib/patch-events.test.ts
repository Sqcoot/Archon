import { describe, expect, test } from 'bun:test';
import { applyPatchEvent } from './patch-events';
import type { ChatMessage, PatchEvent } from './types';

const basePatchEvent: PatchEvent = {
  type: 'patch_event',
  provider: 'codex',
  phase: 'final',
  status: 'applied',
  itemId: 'patch-1',
  changes: [{ kind: 'update', path: 'src/app.ts' }],
  path: 'src/app.ts',
  kind: 'update',
  timestamp: 1000,
};

describe('applyPatchEvent', () => {
  test('attaches patch event to existing assistant message', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Done',
        timestamp: 900,
      },
    ];

    const result = applyPatchEvent(messages, basePatchEvent, () => 'msg-new', 1000);

    expect(result).toHaveLength(1);
    expect(result[0].patchEvents).toEqual([
      {
        id: 'patch-1',
        provider: 'codex',
        phase: 'final',
        status: 'applied',
        changes: [{ kind: 'update', path: 'src/app.ts' }],
        timestamp: 1000,
        itemId: 'patch-1',
        path: 'src/app.ts',
        kind: 'update',
      },
    ]);
  });

  test('creates assistant patch message when last message is not assistant', () => {
    const messages: ChatMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        content: 'Please edit',
        timestamp: 900,
      },
    ];

    const result = applyPatchEvent(messages, basePatchEvent, () => 'msg-new', 1000);

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      id: 'msg-new',
      role: 'assistant',
      content: '',
      isStreaming: false,
    });
    expect(result[1].patchEvents?.[0]?.status).toBe('applied');
  });

  test('deduplicates repeated patch event ids', () => {
    const first = applyPatchEvent([], basePatchEvent, () => 'msg-new', 1000);
    const second = applyPatchEvent(first, basePatchEvent, () => 'msg-other', 1001);

    expect(second).toBe(first);
  });

  test('preserves failed patch error for rendering', () => {
    const failed: PatchEvent = {
      ...basePatchEvent,
      status: 'failed',
      error: 'Permission denied',
      timestamp: 1001,
    };

    const result = applyPatchEvent([], failed, () => 'msg-new', 1001);

    expect(result[0].patchEvents?.[0]?.error).toBe('Permission denied');
    expect(result[0].patchEvents?.[0]?.status).toBe('failed');
  });
});
