import type { ChatMessage, PatchEvent, PatchEventDisplay } from './types';

export function patchEventToDisplay(event: PatchEvent, fallbackId: string): PatchEventDisplay {
  return {
    id: event.itemId ?? event.callId ?? fallbackId,
    provider: event.provider,
    phase: event.phase,
    status: event.status,
    changes: Array.isArray(event.changes) ? event.changes : [],
    timestamp: event.timestamp,
    ...(event.itemId ? { itemId: event.itemId } : {}),
    ...(event.callId ? { callId: event.callId } : {}),
    ...(event.runId ? { runId: event.runId } : {}),
    ...(event.stepName ? { stepName: event.stepName } : {}),
    ...(event.path ? { path: event.path } : {}),
    ...(event.kind ? { kind: event.kind } : {}),
    ...(event.diff !== undefined ? { diff: event.diff } : {}),
    ...(event.message ? { message: event.message } : {}),
    ...(event.error ? { error: event.error } : {}),
  };
}

export function applyPatchEvent(
  messages: ChatMessage[],
  event: PatchEvent,
  makeId: () => string,
  now: number = Date.now()
): ChatMessage[] {
  const display = patchEventToDisplay(event, `patch-${String(now)}`);
  const last = messages[messages.length - 1];

  if (last?.role === 'assistant') {
    const existing = last.patchEvents ?? [];
    if (existing.some(p => p.id === display.id)) return messages;
    return [
      ...messages.slice(0, -1),
      {
        ...last,
        patchEvents: [...existing, display],
      },
    ];
  }

  return [
    ...messages,
    {
      id: makeId(),
      role: 'assistant',
      content: '',
      timestamp: now,
      isStreaming: false,
      patchEvents: [display],
    },
  ];
}
