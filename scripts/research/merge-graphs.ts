#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  graphifyArgs,
  graphsRoot,
  listSubdirectories,
  mergedRoot,
  pathExists,
  readManifest,
  relativeFromRoot,
  repoRoot,
  resolveGraphifyInvocation,
  runFile,
} from './common';

interface GraphFileSummary {
  repository: string;
  graphPath: string;
  reportPath: string;
  nodeCount: number | null;
  edgeCount: number | null;
}

interface MergeSummary {
  graphFiles: GraphFileSummary[];
  mergedGraphPath: string | null;
  usedGraphifyMerge: boolean;
}

async function main(): Promise<void> {
  const json = process.argv.includes('--json');
  const graphFiles = await collectGraphFiles();
  await mkdir(mergedRoot, { recursive: true });

  let mergedGraphPath: string | null = null;
  let usedGraphifyMerge = false;

  if (graphFiles.length >= 2) {
    const graphify = await resolveGraphifyInvocation();
    if (graphify) {
      const outPath = join(mergedRoot, 'ecosystem.graph.json');
      const merge = await runFile(
        graphify.command,
        graphifyArgs(graphify, [
          'merge-graphs',
          ...graphFiles.map(file => file.graphPath),
          '--out',
          outPath,
        ]),
        { timeout: 600_000, maxBuffer: 1024 * 1024 * 50 }
      );
      if (merge.ok && (await pathExists(outPath))) {
        mergedGraphPath = outPath;
        usedGraphifyMerge = true;
      }
    }
  }

  if (!mergedGraphPath) {
    const outPath = join(mergedRoot, 'ecosystem.graph.json');
    await writeFile(
      outPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          generatedAt: new Date().toISOString(),
          mergeMode: 'structured-summary',
          repositories: graphFiles.map(file => ({
            repository: file.repository,
            graphPath: relativeFromRoot(file.graphPath),
            nodeCount: file.nodeCount,
            edgeCount: file.edgeCount,
          })),
        },
        null,
        2
      )}\n`,
      'utf-8'
    );
    mergedGraphPath = outPath;
  }

  const summary: MergeSummary = { graphFiles, mergedGraphPath, usedGraphifyMerge };
  await writeReports(summary);

  if (json) {
    console.log(JSON.stringify(renderJsonSummary(summary), null, 2));
    return;
  }

  console.log('Research graph merge');
  console.log(`graphs: ${graphFiles.length}`);
  console.log(`merge-mode: ${usedGraphifyMerge ? 'graphify' : 'structured-summary'}`);
  console.log(`merged-graph: ${mergedGraphPath ? relativeFromRoot(mergedGraphPath) : 'none'}`);
  console.log('report: docs/context-orchestrator/research/merged-ecosystem-report.md');
}

async function collectGraphFiles(): Promise<GraphFileSummary[]> {
  await readManifest();
  const directories = await listSubdirectories(graphsRoot);
  const summaries: GraphFileSummary[] = [];
  for (const directory of directories) {
    const graphPath = join(graphsRoot, directory, 'graph.json');
    if (!(await pathExists(graphPath))) {
      continue;
    }
    const graph = await readGraphSummary(graphPath);
    summaries.push({
      repository: directory,
      graphPath,
      reportPath: join(graphsRoot, directory, 'GRAPH_REPORT.md'),
      nodeCount: graph.nodeCount,
      edgeCount: graph.edgeCount,
    });
  }
  return summaries.sort((a, b) => a.repository.localeCompare(b.repository));
}

async function readGraphSummary(
  graphPath: string
): Promise<{ nodeCount: number | null; edgeCount: number | null }> {
  const raw = await readFile(graphPath, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { nodeCount: null, edgeCount: null };
  }
  const record = parsed as Record<string, unknown>;
  return {
    nodeCount: Array.isArray(record.nodes) ? record.nodes.length : null,
    edgeCount: Array.isArray(record.edges)
      ? record.edges.length
      : Array.isArray(record.links)
        ? record.links.length
        : null,
  };
}

async function writeReports(summary: MergeSummary): Promise<void> {
  const generatedAt = new Date().toISOString();
  const markdown = [
    '# Merged Ecosystem Graph Report',
    '',
    `Generated: ${generatedAt}`,
    '',
    `Merge mode: ${summary.usedGraphifyMerge ? 'Graphify merge-graphs' : 'structured summary fallback'}`,
    '',
    `Merged graph: ${summary.mergedGraphPath ? relativeFromRoot(summary.mergedGraphPath) : 'not produced'}`,
    '',
    '## Graph Inputs',
    '',
    ...summary.graphFiles.map(
      file =>
        `- ${file.repository}: ${relativeFromRoot(file.graphPath)} (nodes: ${file.nodeCount ?? 'unknown'}, edges: ${
          file.edgeCount ?? 'unknown'
        })`
    ),
    '',
  ].join('\n');

  await writeFile(join(mergedRoot, 'ecosystem.GRAPH_REPORT.md'), markdown, 'utf-8');
  await mkdir(join(repoRoot, 'docs/context-orchestrator/research'), { recursive: true });
  await writeFile(
    join(repoRoot, 'docs/context-orchestrator/research/merged-ecosystem-report.md'),
    markdown,
    'utf-8'
  );
}

function renderJsonSummary(summary: MergeSummary): Record<string, unknown> {
  return {
    graphFiles: summary.graphFiles.map(file => ({
      repository: file.repository,
      graphPath: relativeFromRoot(file.graphPath),
      reportPath: relativeFromRoot(file.reportPath),
      nodeCount: file.nodeCount,
      edgeCount: file.edgeCount,
    })),
    mergedGraphPath: summary.mergedGraphPath ? relativeFromRoot(summary.mergedGraphPath) : null,
    usedGraphifyMerge: summary.usedGraphifyMerge,
  };
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
