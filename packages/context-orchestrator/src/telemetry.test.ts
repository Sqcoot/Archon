import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { compilePromptPackage } from './compiler';
import { sanitizeAcoSpanAttributes, withAcoSpan, type AcoSpanAttributes } from './telemetry';

const repoRoot = resolve(import.meta.dir, '../../..');

let activeProvider: BasicTracerProvider | undefined;
let activeExporter: InMemorySpanExporter | undefined;

beforeEach(() => {
  trace.disable();
  activeProvider = undefined;
  activeExporter = undefined;
});

afterEach(async () => {
  activeExporter?.reset();
  await activeProvider?.shutdown();
  trace.disable();
  activeProvider = undefined;
  activeExporter = undefined;
});

describe('context orchestrator telemetry', () => {
  test('is no-op safe without a tracer provider', () => {
    const result = withAcoSpan(
      'archon.aco.compile',
      { 'archon.aco.operation': 'compile' },
      span => {
        span.setAttributes({ 'archon.aco.docs.targets.count': 1 });
        return 'compiled';
      }
    );

    expect(result).toBe('compiled');
  });

  test('preserves async return values and records allowlisted attributes', async () => {
    const exporter = installSpanExporter();

    const result = await withAcoSpan(
      'archon.aco.compile',
      { 'archon.aco.operation': 'compile' },
      async span => {
        span.setAttributes({
          'archon.aco.bmad.route': 'not-a-real-route',
          'archon.aco.docs.targets.count': 2,
          'archon.aco.docs.unresolved.count': 1,
        } as AcoSpanAttributes);
        return { archiveFiles: 17 };
      }
    );

    expect(result).toEqual({ archiveFiles: 17 });
    const [span] = exporter.getFinishedSpans();
    expect(span?.name).toBe('archon.aco.compile');
    expect(span?.status.code).toBe(SpanStatusCode.OK);
    expect(span?.attributes).toMatchObject({
      'archon.aco.operation': 'compile',
      'archon.aco.result': 'success',
      'archon.aco.bmad.route': 'unknown',
      'archon.aco.docs.targets.count': 2,
      'archon.aco.docs.unresolved.count': 1,
    });
  });

  test('drops non-allowlisted, high-cardinality, and secret-like attributes', () => {
    const sanitized = sanitizeAcoSpanAttributes({
      'archon.aco.operation': ['compile'],
      'archon.aco.policy.version': 'sk-abcdefghijklmnopqrstuvwxyz',
      'archon.aco.opa.version': '1'.repeat(33),
      'archon.aco.graph.nodes.count': -1,
      'archon.aco.acceptance.scenarios.count': { raw: 'context' },
      'archon.aco.bmad.route': 'user-provided-route-name',
      'archon.aco.private': 'raw prompt',
    } as unknown as AcoSpanAttributes);

    expect(sanitized).toEqual({
      'archon.aco.bmad.route': 'unknown',
    });
  });

  test('preserves thrown error identity without recording raw exception content', async () => {
    const exporter = installSpanExporter();
    const error = new Error(
      'raw prompt contained SECRET_TOKEN=hidden-value and sk-abcdefghijklmnopqrstuvwxyz'
    );

    let thrown: unknown;
    try {
      await withAcoSpan('archon.aco.compile', { 'archon.aco.operation': 'compile' }, async () => {
        throw error;
      });
    } catch (caught) {
      thrown = caught;
    }

    expect(thrown).toBe(error);
    const [span] = exporter.getFinishedSpans();
    expect(span?.status).toEqual({
      code: SpanStatusCode.ERROR,
      message: 'archon.aco.error',
    });
    expect(span?.attributes).toMatchObject({
      'archon.aco.operation': 'compile',
      'archon.aco.result': 'error',
      'archon.aco.error.kind': 'unknown',
    });
    const serializedSpan = JSON.stringify({
      attributes: span?.attributes,
      events: span?.events,
      status: span?.status,
    });
    expect(serializedSpan).not.toContain('hidden-value');
    expect(serializedSpan).not.toContain('sk-abcdefghijklmnopqrstuvwxyz');
    expect(span?.events).toEqual([]);
  });

  test('preserves synchronous thrown error identity', () => {
    const exporter = installSpanExporter();
    const error = new Error('sync archive failure with password=hidden-value');

    let thrown: unknown;
    try {
      withAcoSpan('archon.aco.policy.archive', { 'archon.aco.operation': 'policy.archive' }, () => {
        throw error;
      });
    } catch (caught) {
      thrown = caught;
    }

    expect(thrown).toBe(error);
    const [span] = exporter.getFinishedSpans();
    expect(span?.status).toEqual({
      code: SpanStatusCode.ERROR,
      message: 'archon.aco.error',
    });
    expect(span?.attributes).toMatchObject({
      'archon.aco.operation': 'policy.archive',
      'archon.aco.result': 'error',
      'archon.aco.error.kind': 'unknown',
    });
    const serializedSpan = JSON.stringify({
      attributes: span?.attributes,
      events: span?.events,
      status: span?.status,
    });
    expect(serializedSpan).not.toContain('hidden-value');
  });

  test('emits compile and policy archive spans without private prompt content', async () => {
    const exporter = installSpanExporter();
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-telemetry-'));

    const result = await compilePromptPackage({
      cwd: repoRoot,
      prompt: 'Implement safely with SECRET_TOKEN=hidden-value.',
      archiveRoot,
      runId: 'aco-telemetry-test',
      timestamp: '2026-05-18T12:00:00.000Z',
    });

    expect(result.package.originalPrompt).toContain('SECRET_TOKEN=[REDACTED]');
    const spans = exporter.getFinishedSpans();
    expect(new Set(spans.map(span => span.name))).toEqual(
      new Set(['archon.aco.compile', 'archon.aco.policy.archive'])
    );

    const compileSpan = spans.find(span => span.name === 'archon.aco.compile');
    const policySpan = spans.find(span => span.name === 'archon.aco.policy.archive');
    expect(compileSpan?.attributes).toMatchObject({
      'archon.aco.operation': 'compile',
      'archon.aco.result': 'success',
      'archon.aco.archive.files.count': 21,
      'archon.aco.docs.unresolved.count': 1,
    });
    expect(policySpan?.attributes).toMatchObject({
      'archon.aco.operation': 'policy.archive',
      'archon.aco.result': 'success',
      'archon.aco.policy.gate': 'prompt-package',
      'archon.aco.policy.allowed': true,
      'archon.aco.policy.version': 'aco-prompt-package-v1',
      'archon.aco.opa.available': true,
    });

    const serializedSpans = JSON.stringify(
      spans.map(span => ({
        name: span.name,
        attributes: span.attributes,
        events: span.events,
        status: span.status,
      }))
    );
    expect(serializedSpans).not.toContain('hidden-value');
    expect(serializedSpans).not.toContain(repoRoot);
  });
});

function installSpanExporter(): InMemorySpanExporter {
  trace.disable();
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  trace.setGlobalTracerProvider(provider);
  activeProvider = provider;
  activeExporter = exporter;
  return exporter;
}
