import { describe, expect, test } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('ACO OpenAPI schemas', () => {
  test('ACO-APPROVAL-011 mirrors approval contract shape for API display', async () => {
    const source = await readFile(join(import.meta.dir, 'aco.schemas.ts'), 'utf8');

    expect(source).toContain("openapi('AcoApprovalContractV1')");
    expect(source).toContain("schemaVersion: z.literal('aco.approval-contract.v1')");
    expect(source).toContain('contractHash');
    expect(source).toContain('ledgerFingerprint');
    expect(source).toContain('willRun: z.literal(false)');
  });
});
