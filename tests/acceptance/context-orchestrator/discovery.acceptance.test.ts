import { describe, expect, test } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('ACO discovery acceptance', () => {
  test('Spec: 017-implementation-discovery-protocol.md Acceptance: ACO-DISCOVERY-001 baseline exists before implementation', async () => {
    const baseline = await readFile(
      join(process.cwd(), 'docs/context-orchestrator/baseline.md'),
      'utf8'
    );
    expect(baseline).toContain('bun run test');
    expect(baseline).toContain('bun run cli validate workflows --cwd .');
    expect(baseline).toContain('archon-smart-pr-review');
  });
});
