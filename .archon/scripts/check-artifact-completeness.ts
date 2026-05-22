#!/usr/bin/env bun
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

interface RequiredSection {
  label: string;
  aliases: string[];
}

const REQUIRED_SECTIONS: RequiredSection[] = [
  { label: 'Source Request', aliases: ['source request'] },
  { label: 'Workflow Run', aliases: ['workflow run'] },
  { label: 'Scope', aliases: ['scope'] },
  { label: 'Out of Scope', aliases: ['out of scope'] },
  { label: 'Relevant Files', aliases: ['relevant files'] },
  {
    label: 'Decision or Root Cause',
    aliases: ['decision or root cause', 'decision', 'root cause', 'decision / root cause'],
  },
  { label: 'Implementation Plan', aliases: ['implementation plan'] },
  { label: 'Validation Commands', aliases: ['validation commands'] },
  { label: 'Validation Result', aliases: ['validation result', 'validation results'] },
  { label: 'Risks', aliases: ['risks'] },
  { label: 'Next-Node Instructions', aliases: ['next-node instructions', 'next node instructions'] },
  { label: 'Failure Mode', aliases: ['failure mode', 'failure mode, if any'] },
];

const WORKFLOW_ARTIFACT_MARKERS = [
  'archon-workflow-artifact',
  'workflow-artifact: true',
  'workflow artifact: true',
];

function usage(): void {
  console.error('Usage: bun .archon/scripts/check-artifact-completeness.ts <file-or-directory> [...]');
  console.error('');
  console.error('Checks Markdown workflow artifacts for required handoff headings.');
  console.error('Directories are scanned recursively; files outside .archon/artifacts need an artifact marker or clear artifact headings.');
}

function walk(inputPath: string): string[] {
  const resolved = resolve(inputPath);
  const stat = statSync(resolved);
  if (stat.isFile()) {
    return [resolved];
  }
  if (!stat.isDirectory()) {
    return [];
  }

  const results: string[] = [];
  for (const entry of readdirSync(resolved, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }
    const child = join(resolved, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(child));
    } else if (entry.isFile()) {
      results.push(child);
    }
  }
  return results;
}

function normalizeHeading(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^\w\s/-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHeadings(content: string): Set<string> {
  const headings = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match) {
      headings.add(normalizeHeading(match[2]));
    }
  }
  return headings;
}

function isInArtifactsDir(filePath: string): boolean {
  const normalized = filePath.split('/').join('/');
  return normalized.includes('/.archon/artifacts/');
}

function isExplicitlySkipped(content: string): boolean {
  return /archon-workflow-artifact:\s*false/i.test(content) || /workflow-artifact:\s*false/i.test(content);
}

function isWorkflowArtifact(filePath: string, content: string, directFile: boolean): boolean {
  if (isExplicitlySkipped(content)) {
    return false;
  }
  if (isInArtifactsDir(filePath) || directFile) {
    return true;
  }
  const lowered = content.toLowerCase();
  return WORKFLOW_ARTIFACT_MARKERS.some(marker => lowered.includes(marker));
}

function missingSections(content: string): string[] {
  const headings = extractHeadings(content);
  return REQUIRED_SECTIONS.filter(
    section => !section.aliases.some(alias => headings.has(alias))
  ).map(section => section.label);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  usage();
  process.exit(2);
}

const cwd = process.cwd();
const allFiles = args.flatMap(arg => {
  try {
    return walk(arg).map(filePath => ({ filePath, directFile: statSync(resolve(arg)).isFile() }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL ${arg}: ${message}`);
    process.exitCode = 1;
    return [];
  }
});

const markdownFiles = allFiles.filter(({ filePath }) => extname(filePath).toLowerCase() === '.md');
const candidates = markdownFiles.filter(({ filePath, directFile }) => {
  const content = readFileSync(filePath, 'utf8');
  return isWorkflowArtifact(filePath, content, directFile);
});

let failed = false;
for (const { filePath } of candidates) {
  const content = readFileSync(filePath, 'utf8');
  const missing = missingSections(content);
  const displayPath = relative(cwd, filePath) || filePath;
  if (missing.length === 0) {
    console.log(`PASS ${displayPath}`);
    continue;
  }
  failed = true;
  console.error(`FAIL ${displayPath}`);
  for (const section of missing) {
    console.error(`  missing heading: ${section}`);
  }
}

if (candidates.length === 0) {
  console.log('PASS no workflow artifact Markdown files found in provided paths.');
}

const skipped = markdownFiles.length - candidates.length;
console.log(`Checked ${candidates.length} artifact(s); skipped ${skipped} non-artifact Markdown file(s).`);

if (failed || process.exitCode === 1) {
  process.exit(1);
}
