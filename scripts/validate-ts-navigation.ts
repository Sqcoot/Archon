import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const workflowsSrc = join(repoRoot, 'packages/workflows/src');
const loaderFile = join(workflowsSrc, 'loader.ts');
const discoveryFile = join(workflowsSrc, 'workflow-discovery.ts');

function collectTypeScriptFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      collectTypeScriptFiles(path, files);
      continue;
    }
    if (path.endsWith('.ts') && !path.endsWith('.d.ts')) {
      files.push(path);
    }
  }
  return files;
}

function positionOf(file: string, text: string): number {
  const content = readFileSync(file, 'utf8');
  const position = content.indexOf(text);
  if (position < 0) {
    throw new Error(`Could not find "${text}" in ${relative(repoRoot, file)}`);
  }
  return position;
}

const files = collectTypeScriptFiles(workflowsSrc);
const versions = new Map(files.map(file => [file, '0']));
const options: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  types: ['bun-types'],
};

const host: ts.LanguageServiceHost = {
  getScriptFileNames: () => files,
  getScriptVersion: fileName => versions.get(fileName) ?? '0',
  getScriptSnapshot: fileName => {
    if (!existsSync(fileName)) return undefined;
    return ts.ScriptSnapshot.fromString(readFileSync(fileName, 'utf8'));
  },
  getCurrentDirectory: () => repoRoot,
  getCompilationSettings: () => options,
  getDefaultLibFileName: compilerOptions => ts.getDefaultLibFilePath(compilerOptions),
  fileExists: fileName => ts.sys.fileExists(fileName),
  readFile: fileName => ts.sys.readFile(fileName),
  readDirectory: (path, extensions, exclude, include, depth) =>
    ts.sys.readDirectory(path, extensions, exclude, include, depth),
  directoryExists: directoryName => ts.sys.directoryExists?.(directoryName) ?? false,
  getDirectories: path => ts.sys.getDirectories?.(path) ?? [],
};

const service = ts.createLanguageService(host, ts.createDocumentRegistry());
const usagePosition = positionOf(discoveryFile, 'parseWorkflow(content');
const definition = service
  .getDefinitionAtPosition(discoveryFile, usagePosition)
  ?.find(definitionInfo => definitionInfo.fileName === loaderFile);

if (!definition) {
  throw new Error('TypeScript language service did not resolve parseWorkflow to loader.ts');
}

const definitionPosition = positionOf(loaderFile, 'parseWorkflow(content');
const references = service.findReferences(loaderFile, definitionPosition) ?? [];
const referenceFiles = new Set(
  references.flatMap(reference =>
    reference.references.map(referenceEntry => relative(repoRoot, referenceEntry.fileName))
  )
);

for (const expected of [
  'packages/workflows/src/loader.ts',
  'packages/workflows/src/workflow-discovery.ts',
]) {
  if (!referenceFiles.has(expected)) {
    throw new Error(`TypeScript language service did not report expected reference in ${expected}`);
  }
}

console.log(
  JSON.stringify(
    {
      status: 'passed',
      symbol: 'parseWorkflow',
      definition: relative(repoRoot, definition.fileName),
      referenceFiles: [...referenceFiles].sort(),
      strategy: 'typescript-language-service',
      pyrightCopied: false,
    },
    null,
    2
  )
);
