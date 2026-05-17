import { describe, expect, test } from 'bun:test';
import { applyCavemanPolicy } from '@archon/context-orchestrator';

describe('ACO Caveman acceptance', () => {
  test('Spec: 007-caveman-policy-spec.md Acceptance: ACO-CAVEMAN-001 structured artifacts are byte-identical', () => {
    const input = [
      'Summary can be compact.',
      '',
      '```json',
      '{"command":"bun run test","path":"docs/context-orchestrator/specs/007-caveman-policy-spec.md"}',
      '```',
    ].join('\n');
    const output = applyCavemanPolicy(input, 'ultra');
    expect(output).toContain(
      [
        '```json',
        '{"command":"bun run test","path":"docs/context-orchestrator/specs/007-caveman-policy-spec.md"}',
        '```',
      ].join('\n')
    );
  });
});
