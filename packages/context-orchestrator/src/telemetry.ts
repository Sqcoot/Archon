import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { Attributes, Span } from '@opentelemetry/api';
import { containsSecretLikeValue } from './security';

const tracerName = '@archon/context-orchestrator';

const attributeSpecs = {
  'archon.aco.operation': { type: 'string', values: ['compile', 'policy.archive'] },
  'archon.aco.result': { type: 'string', values: ['success', 'error'] },
  'archon.aco.error.kind': {
    type: 'string',
    values: [
      'policy_decision_error',
      'archive_security_error',
      'opa_unavailable',
      'validation_error',
      'unknown',
    ],
  },
  'archon.aco.bmad.route': {
    type: 'string',
    values: [
      'brownfield-architecture',
      'quick-contained',
      'correct-course',
      'unknown-help',
      'unknown',
    ],
  },
  'archon.aco.graph.repositories.count': { type: 'number' },
  'archon.aco.graph.waivers.count': { type: 'number' },
  'archon.aco.graph.nodes.count': { type: 'number' },
  'archon.aco.graph.edges.count': { type: 'number' },
  'archon.aco.docs.targets.count': { type: 'number' },
  'archon.aco.docs.unresolved.count': { type: 'number' },
  'archon.aco.capabilities.selected.count': { type: 'number' },
  'archon.aco.acceptance.scenarios.count': { type: 'number' },
  'archon.aco.validation.passed': { type: 'boolean' },
  'archon.aco.validation.failed.count': { type: 'number' },
  'archon.aco.policy.passed': { type: 'boolean' },
  'archon.aco.traceability.passed': { type: 'boolean' },
  'archon.aco.archive.files.count': { type: 'number' },
  'archon.aco.capability_snapshot.claims.count': { type: 'number' },
  'archon.aco.bootstrap.max_bytes': { type: 'number' },
  'archon.aco.bootstrap.truncated': { type: 'boolean' },
  'archon.aco.bootstrap.event': {
    type: 'string',
    values: [
      'SessionStart',
      'UserPromptSubmit',
      'PreToolUse',
      'PermissionRequest',
      'PostToolUse',
      'PreCompact',
      'PostCompact',
      'SubagentStart',
      'SubagentStop',
      'Stop',
    ],
  },
  'archon.aco.policy.gate': { type: 'string', values: ['prompt-package'] },
  'archon.aco.policy.allowed': { type: 'boolean' },
  'archon.aco.policy.deny.count': { type: 'number' },
  'archon.aco.policy.warn.count': { type: 'number' },
  'archon.aco.policy.duplicates_suppressed.count': { type: 'number' },
  'archon.aco.policy.version': { type: 'string', maxLength: 64 },
  'archon.aco.opa.available': { type: 'boolean' },
  'archon.aco.opa.version': { type: 'string', maxLength: 32 },
} as const satisfies Record<string, AttributeSpec>;

type AttributeSpec =
  | { type: 'boolean' }
  | { type: 'number' }
  | { type: 'string'; values?: readonly string[]; maxLength?: number };

export type AcoSpanName = 'archon.aco.compile' | 'archon.aco.policy.archive';
export type AcoAttributeKey = keyof typeof attributeSpecs;
export type AcoAttributeValue = boolean | number | string | null | undefined;
export type AcoSpanAttributes = Partial<Record<AcoAttributeKey, AcoAttributeValue>>;

export interface AcoSpanHandle {
  setAttributes(attributes: AcoSpanAttributes): void;
}

export function withAcoSpan<T>(spanName: AcoSpanName, operation: (span: AcoSpanHandle) => T): T;
export function withAcoSpan<T>(
  spanName: AcoSpanName,
  attributes: AcoSpanAttributes,
  operation: (span: AcoSpanHandle) => T
): T;
export function withAcoSpan<T>(
  spanName: AcoSpanName,
  attributesOrOperation: AcoSpanAttributes | ((span: AcoSpanHandle) => T),
  maybeOperation?: (span: AcoSpanHandle) => T
): T {
  const attributes = typeof attributesOrOperation === 'function' ? {} : attributesOrOperation;
  const operation =
    typeof attributesOrOperation === 'function' ? attributesOrOperation : maybeOperation;

  if (operation === undefined) {
    throw new Error('ACO telemetry span operation is required.');
  }

  return trace
    .getTracer(tracerName)
    .startActiveSpan(spanName, { attributes: sanitizeAcoSpanAttributes(attributes) }, span => {
      const handle: AcoSpanHandle = {
        setAttributes(nextAttributes) {
          span.setAttributes(sanitizeAcoSpanAttributes(nextAttributes));
        },
      };

      try {
        const result = operation(handle);
        if (isPromiseLike(result)) {
          return finishAsyncSpan(result, span);
        }
        markSpanSuccess(span);
        span.end();
        return result;
      } catch (error) {
        markSpanError(span, error);
        span.end();
        throw error;
      }
    }) as T;
}

export function sanitizeAcoSpanAttributes(attributes: AcoSpanAttributes): Attributes {
  const sanitized: Attributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (!isAcoAttributeKey(key)) continue;
    const sanitizedValue = sanitizeAcoAttributeValue(key, value);
    if (sanitizedValue !== undefined) {
      sanitized[key] = sanitizedValue;
    }
  }
  return sanitized;
}

function markSpanSuccess(span: Span): void {
  span.setAttributes(
    sanitizeAcoSpanAttributes({
      'archon.aco.result': 'success',
    })
  );
  span.setStatus({ code: SpanStatusCode.OK });
}

function markSpanError(span: Span, error: unknown): void {
  const errorKind = classifyAcoError(error);
  span.setAttributes(
    sanitizeAcoSpanAttributes({
      'archon.aco.result': 'error',
      'archon.aco.error.kind': errorKind,
      'archon.aco.opa.available': errorKind === 'opa_unavailable' ? false : undefined,
    })
  );
  span.setStatus({ code: SpanStatusCode.ERROR, message: 'archon.aco.error' });
}

async function finishAsyncSpan<T>(result: PromiseLike<T>, span: Span): Promise<T> {
  try {
    const value = await result;
    markSpanSuccess(span);
    return value;
  } catch (error) {
    markSpanError(span, error);
    throw error;
  } finally {
    span.end();
  }
}

function classifyAcoError(error: unknown): AcoAttributeValue {
  if (!(error instanceof Error)) return 'unknown';
  if (error.name === 'PolicyDecisionError') {
    return error.message.includes('Open Policy Agent CLI')
      ? 'opa_unavailable'
      : 'policy_decision_error';
  }
  if (
    error.message.includes('Archive ') ||
    error.message.includes('Invalid ACO archive runId') ||
    error.message.includes('Refusing to write unredacted secret-like value')
  ) {
    return 'archive_security_error';
  }
  if (error.message.toLowerCase().includes('validation')) {
    return 'validation_error';
  }
  return 'unknown';
}

function sanitizeAcoAttributeValue(
  key: AcoAttributeKey,
  value: AcoAttributeValue
): boolean | number | string | undefined {
  if (value === null || value === undefined) return undefined;
  const spec: AttributeSpec = attributeSpecs[key];
  if (spec.type === 'boolean') {
    return typeof value === 'boolean' ? value : undefined;
  }
  if (spec.type === 'number') {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value !== 'string') return undefined;
  if (containsSecretLikeValue(value)) return undefined;
  const maxLength = spec.maxLength ?? 64;
  if (value.length > maxLength) return undefined;
  if (spec.values !== undefined && !spec.values.includes(value)) {
    return key === 'archon.aco.bmad.route' ? 'unknown' : undefined;
  }
  return value;
}

function isAcoAttributeKey(key: string): key is AcoAttributeKey {
  return Object.hasOwn(attributeSpecs, key);
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return false;
  }
  return typeof (value as { then?: unknown }).then === 'function';
}
