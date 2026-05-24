#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  graphsRoot,
  manifestPath,
  pathExists,
  readManifest,
  relativeFromRoot,
  repoRoot,
} from './common';

interface GraphSummary {
  repository: string;
  graphStatus: string;
  cloneStatus: string;
  commitSha: string | null;
  branch: string | null;
  waiverRequired: boolean;
  error: string | null;
  graphPath: string;
  reportPath: string;
  metadataPath: string;
  nodeCount: number | null;
  edgeCount: number | null;
}

const researchDocsDir = join(repoRoot, 'docs', 'context-orchestrator', 'research');

async function main(): Promise<void> {
  const json = process.argv.includes('--json');
  const summaries = await readGraphSummaries();
  await mkdir(researchDocsDir, { recursive: true });

  await Promise.all([
    writeEvidenceIndex(summaries),
    writeSingleRepoReport('archon', summaries),
    writeSingleRepoReport('codex', summaries),
    writeSingleRepoReport('context7', summaries),
    writeSingleRepoReport('caveman', summaries),
    writeBmadReport(summaries),
    writeOpenQuestions(summaries),
    writeWaivers(summaries),
  ]);

  if (json) {
    console.log(
      JSON.stringify(
        {
          generated: [
            'docs/context-orchestrator/research/graph-evidence-index.md',
            'docs/context-orchestrator/research/archon-graph-report.md',
            'docs/context-orchestrator/research/codex-graph-report.md',
            'docs/context-orchestrator/research/context7-graph-report.md',
            'docs/context-orchestrator/research/bmad-graph-report.md',
            'docs/context-orchestrator/research/caveman-graph-report.md',
            'docs/context-orchestrator/research/graph-open-questions.md',
            'docs/context-orchestrator/research/waivers.md',
          ],
        },
        null,
        2
      )
    );
    return;
  }

  console.log('Graph evidence docs generated');
  console.log('docs/context-orchestrator/research/graph-evidence-index.md');
}

async function readGraphSummaries(): Promise<GraphSummary[]> {
  const manifest = await readManifest();
  const existingIndexRows = await readExistingIndexRows();
  const summaries = [];

  for (const entry of manifest.repositories) {
    const graphPath = join(graphsRoot, entry.name, 'graph.json');
    const reportPath = join(graphsRoot, entry.name, 'GRAPH_REPORT.md');
    const metadataPath = join(graphsRoot, entry.name, 'graph-metadata.json');
    const existingCounts = existingIndexRows.get(entry.name);
    const counts = (await pathExists(graphPath))
      ? await readGraphCounts(graphPath)
      : {
          nodeCount: existingCounts?.nodeCount ?? null,
          edgeCount: existingCounts?.edgeCount ?? null,
        };

    summaries.push({
      repository: entry.name,
      graphStatus: entry.graphStatus,
      cloneStatus: entry.cloneStatus,
      commitSha: entry.commitSha,
      branch: entry.branch,
      waiverRequired: entry.waiverRequired,
      error: entry.error,
      graphPath,
      reportPath,
      metadataPath,
      nodeCount: counts.nodeCount,
      edgeCount: counts.edgeCount,
    });
  }

  return summaries;
}

async function readExistingIndexRows(): Promise<
  Map<string, { nodeCount: number | null; edgeCount: number | null }>
> {
  const indexPath = join(researchDocsDir, 'graph-evidence-index.md');
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

async function readGraphCounts(
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

async function writeEvidenceIndex(summaries: GraphSummary[]): Promise<void> {
  const rows = summaries
    .map(
      summary =>
        `| ${summary.repository} | ${summary.graphStatus} | ${summary.cloneStatus} | ${
          summary.branch ?? 'unknown'
        } | ${shortSha(summary.commitSha)} | ${formatCount(summary.nodeCount)} | ${formatCount(
          summary.edgeCount
        )} | ${summary.waiverRequired ? 'yes' : 'no'} | ${relativeFromRoot(summary.graphPath)} |`
    )
    .join('\n');

  await writeDoc(
    'graph-evidence-index.md',
    [
      '# Graph Evidence Index',
      '',
      'This index records graph evidence generated from the upstream research corpus for ACO discovery.',
      '',
      `Manifest: ${relativeFromRoot(manifestPath)}`,
      '',
      '| Repository | Graph status | Clone status | Branch | Commit | Nodes | Edges | Waiver required | Graph |',
      '| --- | --- | --- | --- | --- | ---: | ---: | --- | --- |',
      rows,
      '',
      'Merged report: docs/context-orchestrator/research/merged-ecosystem-report.md',
      'Merged graph: research/merged/ecosystem.graph.json',
      '',
    ].join('\n')
  );
}

async function writeSingleRepoReport(name: string, summaries: GraphSummary[]): Promise<void> {
  const summary = requireSummary(name, summaries);
  await writeDoc(
    `${name}-graph-report.md`,
    [
      `# ${name} Graph Evidence`,
      '',
      renderSummaryBlock(summary),
      '',
      '## Evidence Use',
      '',
      `Use ${name} graph evidence for ACO discovery where this repository is the relevant source. Do not treat this graph as architecture approval by itself; route findings through specs, ADRs, and acceptance tests.`,
      '',
    ].join('\n')
  );
}

async function writeBmadReport(summaries: GraphSummary[]): Promise<void> {
  const bmadSummaries = summaries.filter(summary => summary.repository.startsWith('bmad-'));
  const rows = bmadSummaries
    .map(
      summary =>
        `| ${summary.repository} | ${summary.graphStatus} | ${shortSha(summary.commitSha)} | ${formatCount(
          summary.nodeCount
        )} | ${formatCount(summary.edgeCount)} | ${summary.waiverRequired ? 'yes' : 'no'} |`
    )
    .join('\n');

  await writeDoc(
    'bmad-graph-report.md',
    [
      '# BMAD Graph Evidence',
      '',
      'BMAD evidence is aggregated across the BMAD method, module, testing, automation, UI, and sample-data upstreams.',
      '',
      '| Repository | Graph status | Commit | Nodes | Edges | Waiver required |',
      '| --- | --- | --- | ---: | ---: | --- |',
      rows,
      '',
      '## Evidence Use',
      '',
      'Use this evidence to choose BMAD routing, assumption gates, ATDD traceability expectations, and correct-course triggers. Failed or waived graph entries remain evidence gaps, not blockers unless an architecture decision depends on them.',
      '',
    ].join('\n')
  );
}

async function writeOpenQuestions(summaries: GraphSummary[]): Promise<void> {
  const failed = summaries.filter(summary => summary.graphStatus !== 'complete');
  const questions = [
    '- Does Graphify structured-summary merge provide enough cross-repository evidence, or does the architecture phase need a deeper Graphify merge run?',
    '- Which ACO MVP surface should be chosen after SDD specs and ADR evidence: CLI, slash command, workflow, API, or a staged combination?',
    '- Which third-party dependencies discovered in graph evidence need Context7 library ID resolution before implementation?',
  ];

  for (const summary of failed) {
    questions.push(
      `- ${summary.repository} graph is ${summary.graphStatus}; determine whether waiver is acceptable before any architecture decision depends on this repository.`
    );
  }

  await writeDoc(
    'graph-open-questions.md',
    ['# Graph Open Questions', '', ...questions, ''].join('\n')
  );
}

async function writeWaivers(summaries: GraphSummary[]): Promise<void> {
  const waivers = summaries.filter(
    summary => summary.waiverRequired || summary.graphStatus !== 'complete'
  );
  const lines =
    waivers.length > 0
      ? waivers.flatMap(summary => [
          `## ${summary.repository}`,
          '',
          `Status: ${summary.graphStatus}`,
          '',
          `Reason: ${summary.error ?? 'No error recorded.'}`,
          '',
          `Graph path: ${relativeFromRoot(summary.graphPath)}`,
          '',
        ])
      : ['No graph waivers required.', ''];

  await writeDoc('waivers.md', ['# Research Waivers', '', ...lines].join('\n'));
}

function renderSummaryBlock(summary: GraphSummary): string {
  return [
    `Repository: ${summary.repository}`,
    '',
    `Graph status: ${summary.graphStatus}`,
    '',
    `Clone status: ${summary.cloneStatus}`,
    '',
    `Branch: ${summary.branch ?? 'unknown'}`,
    '',
    `Commit: ${summary.commitSha ?? 'unknown'}`,
    '',
    `Nodes: ${formatCount(summary.nodeCount)}`,
    '',
    `Edges: ${formatCount(summary.edgeCount)}`,
    '',
    `Waiver required: ${summary.waiverRequired ? 'yes' : 'no'}`,
    '',
    `Graph: ${relativeFromRoot(summary.graphPath)}`,
    '',
    `Report: ${relativeFromRoot(summary.reportPath)}`,
    '',
    `Metadata: ${relativeFromRoot(summary.metadataPath)}`,
    '',
    `Error: ${summary.error ?? 'none'}`,
  ].join('\n');
}

function requireSummary(name: string, summaries: GraphSummary[]): GraphSummary {
  const summary = summaries.find(candidate => candidate.repository === name);
  if (!summary) {
    throw new Error(`Missing graph summary for ${name}.`);
  }
  return summary;
}

function formatCount(value: number | null): string {
  return value === null ? 'unknown' : value.toString();
}

function shortSha(value: string | null): string {
  return value ? value.slice(0, 12) : 'unknown';
}

async function writeDoc(name: string, content: string): Promise<void> {
  await writeFile(join(researchDocsDir, name), `${content.replace(/\s+$/u, '')}\n`, 'utf-8');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
