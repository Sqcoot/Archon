import { $ } from 'bun';
import { describe, expect, test } from 'bun:test';
import {
  acoArtifactPackageParamsSchema,
  acoCompileBodySchema,
  acoStatusQuerySchema,
} from '../../../packages/server/src/routes/schemas/aco.schemas';

const behaviorCoveredEndpoints = ['/api/aco/status', '/api/aco/compile'] as const;

describe('ACO API acceptance', () => {
  test('Spec: 013-api-contract.openapi.yaml Acceptance: AC-P1-API native loop API surface is executable', async () => {
    const result = await $`bun test ./packages/server/src/routes/api.aco.test.ts`
      .cwd(process.cwd())
      .quiet()
      .nothrow();

    if (result.exitCode !== 0) {
      throw new Error(
        [
          'ACO API route behavior suite failed.',
          result.stdout.toString(),
          result.stderr.toString(),
        ].join('\n')
      );
    }

    expect(result.exitCode).toBe(0);
    expect(behaviorCoveredEndpoints).toEqual(['/api/aco/status', '/api/aco/compile']);
  });

  test('Spec: 013-api-contract.openapi.yaml Acceptance: AC-P1-API schemas reject unsafe or incomplete requests', () => {
    expect(acoStatusQuerySchema.safeParse({ cwd: '/tmp/project' }).success).toBe(true);
    expect(acoStatusQuerySchema.safeParse({ cwd: '' }).success).toBe(false);
    expect(acoCompileBodySchema.safeParse({ cwd: '/tmp/project', prompt: 'Compile' }).success).toBe(
      true
    );
    expect(acoCompileBodySchema.safeParse({ cwd: '/tmp/project', prompt: '' }).success).toBe(false);
    expect(acoArtifactPackageParamsSchema.safeParse({ runId: 'run-1' }).success).toBe(true);
    expect(acoArtifactPackageParamsSchema.safeParse({ runId: '' }).success).toBe(false);
  });
});
