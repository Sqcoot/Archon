import { describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const forbiddenImports = [
  '@archon/',
  '@anthropic-ai/',
  '@openai/',
  '@mariozechner/',
  '@hono/',
  'fs',
  'fs/promises',
  'node:fs',
  'node:fs/promises',
  'path',
  'node:path',
  'process',
  'node:process',
  'child_process',
  'node:child_process',
];

describe('aco-core import boundary', () => {
  test('source modules avoid runtime adapters, filesystem, process globals, and provider SDKs', async () => {
    const violations: string[] = [];
    const sourceFiles = await collectSourceFiles(new URL('.', import.meta.url));

    for (const file of sourceFiles) {
      if (file.endsWith('.test.ts')) continue;
      const source = await readFile(file, 'utf8');
      for (const specifier of extractImportSpecifiers(source)) {
        if (
          forbiddenImports.some(
            forbidden => specifier === forbidden || specifier.startsWith(forbidden)
          )
        ) {
          violations.push(`${file}: ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test('extracts static imports, re-exports, and dynamic imports', () => {
    expect(
      extractImportSpecifiers(`
        import { readFile } from 'fs/promises';
        import type { Thing } from '@archon/core';
        export { createThing } from '@archon/server';
        export type { Other } from '@archon/providers';
        const lazy = import('@openai/codex-sdk');
      `)
    ).toEqual([
      'fs/promises',
      '@archon/core',
      '@archon/server',
      '@archon/providers',
      '@openai/codex-sdk',
    ]);
  });
});

async function collectSourceFiles(directoryUrl: URL): Promise<string[]> {
  const directory = directoryUrl.pathname;
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectSourceFiles(new URL(`${entry.name}/`, directoryUrl));
      }
      if (entry.isFile() && entry.name.endsWith('.ts')) {
        return [absolutePath];
      }
      return [];
    })
  );
  return files.flat();
}

function extractImportSpecifiers(source: string): readonly string[] {
  const specifiers: string[] = [];
  const fromPattern = /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
  const dynamicPattern = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const pattern of [fromPattern, dynamicPattern]) {
    let match = pattern.exec(source);
    while (match !== null) {
      const specifier = match[1];
      if (specifier !== undefined && !specifier.startsWith('.')) {
        specifiers.push(specifier);
      }
      match = pattern.exec(source);
    }
  }
  return specifiers;
}
