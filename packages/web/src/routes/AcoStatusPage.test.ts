import { describe, expect, test } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('AcoStatusPage', () => {
  test('AC-NEXT-005 renders API nextDecision without local priority recompute', async () => {
    const source = await readFile(join(import.meta.dir, 'AcoStatusPage.tsx'), 'utf8');

    expect(source).toContain('NextDecisionPanel');
    expect(source).toContain('status.nextDecision');
    expect(source).toContain('decision.primaryAction');
    expect(source).toContain('supportedNextDecisionSchemaVersion');
    expect(source).toContain('manual fallback');
    expect(source).toContain('willRun=false');
    expect(source).not.toContain('buildNextDecision');
  });
});
