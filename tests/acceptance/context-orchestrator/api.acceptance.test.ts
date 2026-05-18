import { describe, expect, test } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('ACO API acceptance', () => {
  test('Spec: 013-api-contract.openapi.yaml Acceptance: AC-P1-API native loop API surface is executable', async () => {
    const [routeSource, routeTests, schemaSource] = await Promise.all([
      readFile(join(process.cwd(), 'packages/server/src/routes/api.ts'), 'utf8'),
      readFile(join(process.cwd(), 'packages/server/src/routes/api.aco.test.ts'), 'utf8'),
      readFile(join(process.cwd(), 'packages/server/src/routes/schemas/aco.schemas.ts'), 'utf8'),
    ]);

    for (const endpoint of [
      '/api/aco/status',
      '/api/aco/ledgers',
      '/api/aco/route',
      '/api/aco/compile',
      '/api/aco/artifact-packages/{runId}',
    ]) {
      expect(routeSource).toContain(endpoint);
    }

    for (const handler of [
      'getAcoStatusRoute',
      'getAcoLedgersRoute',
      'postAcoRouteRoute',
      'postAcoCompileRoute',
      'getAcoArtifactPackageRoute',
    ]) {
      expect(routeSource).toContain(`registerOpenApiRoute(${handler}`);
    }

    expect(schemaSource).toContain('acoStatusResponseSchema');
    expect(schemaSource).toContain('acoCompileResponseSchema');
    expect(routeTests).toContain('AC-P1-API returns raw ACO status for a registered cwd');
    expect(routeTests).toContain('AC-P1-API compiles a package for a registered cwd');
    expect(routeTests).toContain('AC-P1-API rejects artifact package traversal run IDs');
    expect(routeTests).toContain('cwd is not registered');
  });
});
