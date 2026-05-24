#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  graphifyArgs,
  graphsRoot,
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
  graphExists: boolean;
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

  if (graphFiles.length >= 2 && graphFiles.every(file => file.graphExists)) {
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
  const manifest = await readManifest();
  const existingIndexRows = await readExistingIndexRows();
  const summaries: GraphFileSummary[] = [];
  for (const entry of manifest.repositories) {
    const graphPath = join(graphsRoot, entry.name, 'graph.json');
    const graphExists = await pathExists(graphPath);
    const existingCounts = existingIndexRows.get(entry.name);
    if (!graphExists && existingCounts === undefined) {
      continue;
    }
    const graph = graphExists
      ? await readGraphSummary(graphPath)
      : {
          nodeCount: existingCounts?.nodeCount ?? null,
          edgeCount: existingCounts?.edgeCount ?? null,
        };
    summaries.push({
      repository: entry.name,
      graphPath,
      reportPath: join(graphsRoot, entry.name, 'GRAPH_REPORT.md'),
      nodeCount: graph.nodeCount,
      edgeCount: graph.edgeCount,
      graphExists,
    });
  }
  return summaries.sort((a, b) => a.repository.localeCompare(b.repository));
}

async function readExistingIndexRows(): Promise<
  Map<string, { nodeCount: number | null; edgeCount: number | null }>
> {
  const indexPath = join(repoRoot, 'docs/context-orchestrator/research/graph-evidence-index.md');
  if (!(await pathExists(indexPath))) {
    return new Map();
  }
  const raw = await readFile(indexPath, 'utf-8');
  const rows = new Map<string, { nodeCount: number | null; edgeCount: number | null }>();
  for (const line of raw.split('\n')) {
    if (!line.startsWith('| ') || line.includes('---')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map(cell => cell.trim());
    if (cells.length < 7 || cells[0] === 'Repository') continue;
    rows.set(cells[0], {
      nodeCount: parseCount(cells[5]),
      edgeCount: parseCount(cells[6]),
    });
  }
  return rows;
}

function parseCount(value: string): number | null {
  if (value === 'unknown') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
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
  const markdown = withLifecycleMetadata(
    [
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
          }, source: ${file.graphExists ? 'graph cache' : 'tracked index'})`
      ),
      '',
    ].join('\n')
  );

  await writeFile(join(mergedRoot, 'ecosystem.GRAPH_REPORT.md'), markdown, 'utf-8');
  await mkdir(join(repoRoot, 'docs/context-orchestrator/research'), { recursive: true });
  await writeFile(
    join(repoRoot, 'docs/context-orchestrator/research/merged-ecosystem-report.md'),
    markdown,
    'utf-8'
  );
}

function withLifecycleMetadata(content: string): string {
  if (content.includes('## Artifact Lifecycle')) return content;
  return [
    content.replace(/\s+$/u, ''),
    '',
    '## Artifact Lifecycle',
    '',
    '- Consumer: Context Orchestrator ACO research evidence and graph waiver closure checks.',
    '- Source input: ignored `research/graphs/` graph cache and tracked graph evidence reports under `docs/context-orchestrator/research/`.',
    '- Regeneration command: `bun scripts/research/merge-graphs.ts --json` after approved graph evidence refresh.',
    '- Drift/removal policy: update when upstream graph evidence changes; remove only if Context Orchestrator no longer consumes merged ecosystem graph evidence.',
    '- Owner surface: `docs/context-orchestrator/research/README.md` and `context-orchestrator` package research gates.',
    '',
  ].join('\n');
}

function renderJsonSummary(summary: MergeSummary): Record<string, unknown> {
  return {
    graphFiles: summary.graphFiles.map(file => ({
      repository: file.repository,
      graphPath: relativeFromRoot(file.graphPath),
      reportPath: relativeFromRoot(file.reportPath),
      nodeCount: file.nodeCount,
      edgeCount: file.edgeCount,
      graphExists: file.graphExists,
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
