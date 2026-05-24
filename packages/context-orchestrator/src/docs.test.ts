import { describe, expect, test } from 'bun:test';
import { planDocumentation } from './docs';

describe('ACO documentation target planning', () => {
  test('selects Context7 from prompt-only third-party library signal', () => {
    const plan = planDocumentation({ prompt: 'Use Hono for request routing.' });

    expect(plan.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'context7', topic: 'Hono', status: 'unresolved' }),
      ])
    );
  });

  test('selects Context7 from generated temp codebase signals', () => {
    const plan = planDocumentation({
      prompt: 'Plan docs for generated temp codebase.',
      codebaseSignals: ['src/hono-zod-fixture.ts imports Hono and Zod'],
    });

    expect(plan.targets.map(target => `${target.source}:${target.topic}`).sort()).toEqual([
      'context7:Hono',
      'context7:Zod',
    ]);
    expect(plan.targets.map(target => target.reason).join('\n')).toContain(
      'generated temp codebase evidence'
    );
  });

  test('selects Context7 from Graphify summary evidence', () => {
    const plan = planDocumentation({
      prompt: 'Use graph summary for docs.',
      graphSummary: 'Graphify summary: Hono route uses Zod validation.',
    });

    expect(plan.targets.map(target => `${target.source}:${target.topic}`).sort()).toEqual([
      'context7:Hono',
      'context7:Zod',
    ]);
    expect(plan.targets.map(target => target.reason).join('\n')).toContain(
      'Graphify/codebase summary evidence'
    );
  });

  test('routes explicit Codex/OpenAI/MCP request to OpenAI Docs MCP over repo signals', () => {
    const plan = planDocumentation({
      prompt: 'Codex OpenAI MCP configuration for hooks.',
      codebaseSignals: ['Hono', 'Zod'],
      graphSummary: 'Hono Zod',
    });

    expect(plan.targets).toEqual([
      expect.objectContaining({
        source: 'openai-docs-mcp',
        topic: 'Codex MCP configuration',
        status: 'resolved',
      }),
    ]);
  });
});
