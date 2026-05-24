#!/usr/bin/env bun
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import {
  type GraphStatus,
  copyIfExists,
  graphifyArgs,
  graphsRoot,
  isSuccessfulCloneStatus,
  localAbsolutePath,
  pathExists,
  readManifest,
  relativeFromRoot,
  resolveGraphifyInvocation,
  runFile,
  writeManifest,
} from './common';

type GraphMode = 'auto' | 'required' | 'off' | 'fixture';

interface GraphOptions {
  mode: GraphMode;
  force: boolean;
  json: boolean;
  repositories: Set<string> | null;
}

interface GraphSummary {
  complete: string[];
  failed: string[];
  waived: string[];
  skipped: string[];
}

interface GraphCounts {
  nodes: number;
  edges: number;
}

interface StructuredNode {
  id: string;
  label: string;
  type: 'repository' | 'directory' | 'file';
  path: string;
  extension?: string;
}

interface StructuredEdge {
  source: string;
  target: string;
  type: 'contains';
}

function parseOptions(): GraphOptions {
  const args = process.argv.slice(2);
  let mode: GraphMode = 'auto';
  const repositories = new Set<string>();
  const unsupported: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--force' || arg === '--json') continue;
    if (arg === '--mode') {
      const value = args[index + 1];
      if (value === 'auto' || value === 'required' || value === 'off' || value === 'fixture') {
        mode = value;
        index += 1;
        continue;
      }
      throw new Error(`Unsupported --mode value: ${value ?? '<missing>'}`);
    }
    if (arg === '--repository' || arg === '--repositories') {
      const value = args[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a comma-separated repository name list.`);
      }
      for (const name of value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)) {
        repositories.add(name);
      }
      index += 1;
      continue;
    }
    unsupported.push(arg);
  }
  if (unsupported.length > 0) {
    throw new Error(`Unsupported option(s): ${unsupported.join(', ')}`);
  }
  return {
    mode,
    force: args.includes('--force'),
    json: args.includes('--json'),
    repositories: repositories.size > 0 ? repositories : null,
  };
}

async function main(): Promise<void> {
  const options = parseOptions();
  const manifest = await readManifest();
  const graphify =
    options.mode === 'off' || options.mode === 'fixture' ? null : await resolveGraphifyInvocation();
  const summary: GraphSummary = { complete: [], failed: [], waived: [], skipped: [] };
  validateRepositoryFilter(manifest, options.repositories);

  if (!graphify && options.mode === 'required') {
    for (const entry of manifest.repositories) {
      if (options.repositories && !options.repositories.has(entry.name)) {
        summary.skipped.push(entry.name);
        continue;
      }
      entry.graphStatus = 'failed';
      entry.error = 'Graphify is required but unavailable.';
      entry.waiverRequired = true;
      await writeWaiverGraph(entry.name, 'Graphify is required but unavailable.', options.mode);
      summary.failed.push(entry.name);
    }
    await writeManifest({ ...manifest, generatedAt: new Date().toISOString() });
    printSummary(summary, options.json);
    process.exit(1);
  }

  for (const entry of manifest.repositories) {
    if (options.repositories && !options.repositories.has(entry.name)) {
      summary.skipped.push(entry.name);
      continue;
    }
    const outputDir = join(graphsRoot, entry.name);

    if (!isSuccessfulCloneStatus(entry.cloneStatus) && !options.force) {
      entry.graphStatus = 'waived';
      entry.waiverRequired = true;
      entry.error = entry.error ?? `Skipping ${entry.cloneStatus} repository.`;
      await writeWaiverGraph(entry.name, entry.error, options.mode);
      summary.waived.push(entry.name);
      continue;
    }

    if (!graphify || options.mode === 'off' || options.mode === 'fixture') {
      const reason =
        options.mode === 'off'
          ? 'Graphify mode is off.'
          : options.mode === 'fixture'
            ? 'Graphify fixture mode selected.'
            : 'Graphify unavailable; fixture/no-op graph created.';
      entry.graphStatus = 'waived';
      entry.waiverRequired = true;
      entry.error = reason;
      await writeWaiverGraph(entry.name, reason, options.mode);
      summary.waived.push(entry.name);
      continue;
    }

    const sourceDir = join(localAbsolutePath(entry), 'graphify-out');
    const sourceDirExisted = await pathExists(sourceDir);
    const result = await runFile(
      graphify.command,
      graphifyArgs(graphify, ['update', localAbsolutePath(entry)]),
      {
        timeout: 600_000,
        maxBuffer: 1024 * 1024 * 50,
      }
    );

    if (!result.ok) {
      if (isNoCodeGraphifyFailure(result.stderr || result.stdout)) {
        const counts = await writeStructuredRepositoryGraph(
          entry.name,
          localAbsolutePath(entry),
          outputDir,
          options.mode,
          compactError(result.stderr || result.stdout)
        );
        entry.graphStatus = 'complete';
        entry.error = null;
        entry.waiverRequired = false;
        summary.complete.push(entry.name);
        if (counts.nodes === 0) {
          entry.graphStatus = 'failed';
          entry.waiverRequired = true;
          entry.error = 'Structured graph fallback produced no nodes.';
          await writeWaiverGraph(entry.name, entry.error, options.mode);
          summary.complete.pop();
          summary.failed.push(entry.name);
        }
        continue;
      }
      entry.graphStatus = 'failed';
      entry.waiverRequired = true;
      entry.error = compactError(result.stderr || result.stdout);
      await writeWaiverGraph(entry.name, entry.error, options.mode);
      summary.failed.push(entry.name);
      continue;
    }

    await mkdir(outputDir, { recursive: true });
    const copiedGraph = await copyIfExists(
      join(sourceDir, 'graph.json'),
      join(outputDir, 'graph.json')
    );
    await copyIfExists(join(sourceDir, 'GRAPH_REPORT.md'), join(outputDir, 'GRAPH_REPORT.md'));

    if (!copiedGraph) {
      entry.graphStatus = 'failed';
      entry.waiverRequired = true;
      entry.error = 'Graphify completed but graphify-out/graph.json was not found.';
      await writeWaiverGraph(entry.name, entry.error, options.mode);
      summary.failed.push(entry.name);
      continue;
    }

    if (!(await pathExists(join(outputDir, 'GRAPH_REPORT.md')))) {
      await writeFile(
        join(outputDir, 'GRAPH_REPORT.md'),
        `# ${entry.name} Graph Report\n\nGraphify generated graph.json, but no GRAPH_REPORT.md was produced.\n`,
        'utf-8'
      );
    }

    const counts = await readGraphCounts(join(outputDir, 'graph.json'));
    await writeGraphMetadata(entry.name, 'complete', null, options.mode, counts);
    if (!sourceDirExisted) {
      await rm(sourceDir, { recursive: true, force: true });
    }
    entry.graphStatus = 'complete';
    entry.error = null;
    entry.waiverRequired = false;
    summary.complete.push(entry.name);
  }

  await writeManifest({ ...manifest, generatedAt: new Date().toISOString() });
  printSummary(summary, options.json);

  if (summary.failed.length > 0 && options.mode === 'required') {
    process.exit(1);
  }
}

function isNoCodeGraphifyFailure(output: string): boolean {
  return (
    /No code files found/i.test(output) ||
    /nothing to rebuild/i.test(output) ||
    /Nothing to update/i.test(output)
  );
}

async function writeStructuredRepositoryGraph(
  name: string,
  root: string,
  outputDir: string,
  mode: GraphMode,
  graphifyFailure: string
): Promise<GraphCounts> {
  const nodes: StructuredNode[] = [
    {
      id: `repo:${name}`,
      label: name,
      type: 'repository',
      path: relativeFromRoot(root),
    },
  ];
  const edges: StructuredEdge[] = [];
  await collectStructuredGraphEntries(root, `repo:${name}`, nodes, edges);
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    join(outputDir, 'graph.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        graphStatus: 'complete',
        graphMode: 'structured-file-fallback',
        repository: name,
        generatedAt: new Date().toISOString(),
        source: relativeFromRoot(root),
        graphifyFailure,
        nodes,
        edges,
      },
      null,
      2
    )}\n`,
    'utf-8'
  );
  await writeFile(
    join(outputDir, 'GRAPH_REPORT.md'),
    [
      `# ${name} Graph Report`,
      '',
      'GraphStatus: complete',
      '',
      'Mode: structured-file-fallback',
      '',
      'Reason: Graphify could not extract code graph evidence, so this report records deterministic repository structure evidence for a documentation/data upstream.',
      '',
      `Graphify failure: ${graphifyFailure}`,
      '',
      `Nodes: ${nodes.length}`,
      '',
      `Edges: ${edges.length}`,
      '',
    ].join('\n'),
    'utf-8'
  );
  const counts = { nodes: nodes.length, edges: edges.length };
  await writeGraphMetadata(name, 'complete', null, mode, counts);
  return counts;
}

async function collectStructuredGraphEntries(
  currentPath: string,
  parentId: string,
  nodes: StructuredNode[],
  edges: StructuredEdge[]
): Promise<void> {
  const entries = await readdir(currentPath, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (shouldSkipStructuredEntry(entry.name)) continue;
    const absolutePath = join(currentPath, entry.name);
    const relativePath = relativeFromRoot(absolutePath);
    const id = `${entry.isDirectory() ? 'dir' : 'file'}:${relativePath}`;
    if (entry.isDirectory()) {
      nodes.push({ id, label: entry.name, type: 'directory', path: relativePath });
      edges.push({ source: parentId, target: id, type: 'contains' });
      await collectStructuredGraphEntries(absolutePath, id, nodes, edges);
      continue;
    }
    if (!entry.isFile()) continue;
    const fileStat = await stat(absolutePath);
    if (fileStat.size > 2_000_000) continue;
    nodes.push({
      id,
      label: entry.name,
      type: 'file',
      path: relativePath,
      extension: extensionFor(entry.name),
    });
    edges.push({ source: parentId, target: id, type: 'contains' });
  }
}

function shouldSkipStructuredEntry(name: string): boolean {
  return (
    name === '.git' ||
    name === 'node_modules' ||
    name === 'dist' ||
    name === 'build' ||
    name === 'graphify-out'
  );
}

function extensionFor(name: string): string | undefined {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return undefined;
  return name.slice(dot + 1).toLowerCase();
}

async function readGraphCounts(graphPath: string): Promise<GraphCounts> {
  const raw = await readFile(graphPath, 'utf-8');
  const parsed = JSON.parse(raw) as { nodes?: unknown; edges?: unknown; links?: unknown };
  return {
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes.length : 0,
    edges: Array.isArray(parsed.edges)
      ? parsed.edges.length
      : Array.isArray(parsed.links)
        ? parsed.links.length
        : 0,
  };
}

function validateRepositoryFilter(
  manifest: { repositories: { name: string }[] },
  repositories: Set<string> | null
): void {
  if (!repositories) return;
  const known = new Set(manifest.repositories.map(entry => entry.name));
  const unknown = [...repositories].filter(name => !known.has(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown repository filter(s): ${unknown.join(', ')}`);
  }
}

async function writeWaiverGraph(name: string, reason: string, mode: GraphMode): Promise<void> {
  const outputDir = join(graphsRoot, name);
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    join(outputDir, 'graph.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        graphStatus: 'waived',
        repository: name,
        nodes: [],
        edges: [],
        reason,
      },
      null,
      2
    )}\n`,
    'utf-8'
  );
  await writeFile(
    join(outputDir, 'GRAPH_REPORT.md'),
    `# ${name} Graph Report\n\nGraphStatus: waived\n\nReason: ${reason}\n`,
    'utf-8'
  );
  await writeGraphMetadata(name, 'waived', reason, mode);
}

async function writeGraphMetadata(
  name: string,
  status: GraphStatus,
  error: string | null,
  mode: GraphMode,
  counts: GraphCounts = { nodes: 0, edges: 0 }
): Promise<void> {
  const outputPath = join(graphsRoot, name, 'graph-metadata.json');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        repository: name,
        graphStatus: status,
        graphMode: mode,
        generatedAt: new Date().toISOString(),
        graphPath: relativeFromRoot(join(graphsRoot, name, 'graph.json')),
        reportPath: relativeFromRoot(join(graphsRoot, name, 'GRAPH_REPORT.md')),
        nodes: counts.nodes,
        edges: counts.edges,
        error,
      },
      null,
      2
    )}\n`,
    'utf-8'
  );
}

function printSummary(summary: GraphSummary, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  console.log('Research graphing');
  console.log(`complete: ${formatList(summary.complete)}`);
  console.log(`failed: ${formatList(summary.failed)}`);
  console.log(`waived: ${formatList(summary.waived)}`);
  console.log(`skipped: ${formatList(summary.skipped)}`);
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'none';
}

function compactError(error: string): string {
  return error.trim().split('\n').slice(0, 6).join('\n') || 'Unknown error.';
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
