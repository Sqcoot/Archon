import { describe, expect, test } from 'bun:test';

const FORBIDDEN_PRODUCTION_IMPORTS = [
  'fs',
  'fs/promises',
  'path',
  'os',
  'child_process',
  'process',
  'hono',
  '@hono/zod-openapi',
  'react',
  'react-dom',
  '@archon/server',
  '@archon/web',
  '@archon/providers',
  '@archon/adapters',
  '@archon/workflows/runner',
  '@archon/workflows/loader',
] as const;

const PRODUCTION_MODULES = [
  './builders',
  './checks',
  './constants',
  './gates',
  './index',
  './renderers',
  './schemas',
] as const;

describe('ACO API/UI import boundary', () => {
  test('production source stays pure and contract-only', async () => {
    for (const modulePath of PRODUCTION_MODULES) {
      const module = await import(modulePath);
      expect(module).toBeDefined();
    }

    const sourceFiles = await Promise.all(
      PRODUCTION_MODULES.map(async modulePath => ({
        modulePath,
        text: await Bun.file(new URL(`${modulePath.slice(2)}.ts`, import.meta.url)).text(),
      }))
    );

    for (const { modulePath, text } of sourceFiles) {
      for (const forbidden of FORBIDDEN_PRODUCTION_IMPORTS) {
        expect(text.includes(`from '${forbidden}'`), `${modulePath} imports ${forbidden}`).toBe(
          false
        );
        expect(text.includes(`from "${forbidden}"`), `${modulePath} imports ${forbidden}`).toBe(
          false
        );
      }
    }
  });
});
