#!/usr/bin/env bun
import { mkdir, rm, writeFile } from 'fs/promises';
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
}

interface GraphSummary {
  complete: string[];
  failed: string[];
  waived: string[];
  skipped: string[];
}

function parseOptions(): GraphOptions {
  const args = process.argv.slice(2);
  let mode: GraphMode = 'auto';
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
    unsupported.push(arg);
  }
  if (unsupported.length > 0) {
    throw new Error(`Unsupported option(s): ${unsupported.join(', ')}`);
  }
  return {
    mode,
    force: args.includes('--force'),
    json: args.includes('--json'),
  };
}

async function main(): Promise<void> {
  const options = parseOptions();
  const manifest = await readManifest();
  const graphify =
    options.mode === 'off' || options.mode === 'fixture' ? null : await resolveGraphifyInvocation();
  const summary: GraphSummary = { complete: [], failed: [], waived: [], skipped: [] };

  if (!graphify && options.mode === 'required') {
    for (const entry of manifest.repositories) {
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

    await writeGraphMetadata(entry.name, 'complete', null, options.mode);
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
  mode: GraphMode
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
