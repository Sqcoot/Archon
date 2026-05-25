import { describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const allowedImports = new Set(['@archon/aco-core', 'zod']);
const forbiddenImportFragments = [
  '@anthropic-ai/',
  '@openai/',
  '@mariozechner/',
  '@hono/',
  '@archon/aco-ledgers',
  '@archon/adapters',
  '@archon/cli',
  '@archon/server',
  '@archon/web',
  '@archon/workflows',
  '@archon/providers',
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
  '.archon',
];

describe('aco-codex import boundary', () => {
  test('production source is pure and imports only aco-core, zod, and local modules', async () => {
    const violations: string[] = [];
    const sourceFiles = await collectSourceFiles(new URL('.', import.meta.url));

    for (const file of sourceFiles) {
      if (file.endsWith('.test.ts')) continue;
      const source = await readFile(file, 'utf8');
      for (const specifier of extractImportSpecifiers(source)) {
        if (specifier.startsWith('.')) continue;
        if (!allowedImports.has(specifier)) {
          violations.push(`${file}: ${specifier}`);
        }
        if (forbiddenImportFragments.some(fragment => specifier.includes(fragment))) {
          violations.push(`${file}: ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
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
      if (specifier !== undefined) {
        specifiers.push(specifier);
      }
      match = pattern.exec(source);
    }
  }
  return specifiers;
}
