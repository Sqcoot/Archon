import { describe, expect, test } from 'bun:test';
import { planDocumentation } from '@archon/context-orchestrator';

describe('ACO documentation acceptance', () => {
  test('Spec: 005-documentation-resolution-spec.md Acceptance: ACO-DOCS-001 Codex MCP setup selects OpenAI Docs MCP', () => {
    const plan = planDocumentation({ prompt: 'How should Codex MCP configuration be set up?' });
    expect(plan.targets[0]?.source).toBe('openai-docs-mcp');
    expect(plan.targets[0]?.topic).toContain('Codex');
  });

  test('Spec: 005-documentation-resolution-spec.md Acceptance: ACO-DOCS-002 unknown third-party library keeps Context7 ID unresolved', () => {
    const plan = planDocumentation({ prompt: 'Use SomeUnknownLibrary for the implementation.' });
    const target = plan.targets.find(item => item.source === 'context7');
    expect(target?.libraryId).toBeUndefined();
    expect(target?.status).toBe('unresolved');
  });

  test('Spec: 005-documentation-resolution-spec.md Acceptance: AC-CONFIDENCE-003 task verbs do not create unresolved Context7 targets', () => {
    const plan = planDocumentation({
      prompt: 'Implement safely with tests and no external library dependency.',
    });

    expect(plan.unresolved).toEqual([]);
    expect(plan.targets.every(target => target.topic !== 'Implement')).toBe(true);
  });
});
