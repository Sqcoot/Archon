#!/usr/bin/env bun
import { join } from 'path';
import {
  REQUIRED_UPSTREAMS,
  graphsRoot,
  isSuccessfulCloneStatus,
  manifestPath,
  pathExists,
  readManifest,
  relativeFromRoot,
  repoRoot,
  runFile,
} from './common';

interface ValidationResult {
  errors: string[];
  warnings: string[];
}

async function main(): Promise<void> {
  const json = process.argv.includes('--json');
  const result = await validateResearchCorpus();

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('Research corpus validation');
    console.log(`manifest: ${relativeFromRoot(manifestPath)}`);
    printMessages('warnings', result.warnings);
    printMessages('errors', result.errors);
    console.log(`status: ${result.errors.length === 0 ? 'passed' : 'failed'}`);
  }

  if (result.errors.length > 0) {
    process.exit(1);
  }
}

async function validateResearchCorpus(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(await pathExists(manifestPath))) {
    return { errors: [`Missing upstream manifest: ${manifestPath}`], warnings };
  }

  const manifest = await readManifest();
  const entries = new Map(manifest.repositories.map(entry => [entry.name, entry]));

  for (const definition of REQUIRED_UPSTREAMS) {
    const entry = entries.get(definition.name);
    if (!entry) {
      errors.push(`Missing manifest entry for ${definition.name}.`);
      continue;
    }
    if (entry.url !== definition.url) {
      errors.push(`${definition.name} url mismatch.`);
    }
    if (!entry.role) {
      errors.push(`${definition.name} role is missing.`);
    }
    if (isSuccessfulCloneStatus(entry.cloneStatus) && !entry.commitSha) {
      errors.push(`${definition.name} has cloneStatus=${entry.cloneStatus} but no commitSha.`);
    }
    if (
      (entry.cloneStatus === 'failed' || entry.cloneStatus === 'blocked') &&
      !entry.waiverRequired
    ) {
      errors.push(`${definition.name} is ${entry.cloneStatus} but waiverRequired=false.`);
    }

    const graphDir = join(graphsRoot, entry.name);
    const graphExists =
      (await pathExists(join(graphDir, 'graph.json'))) &&
      (await pathExists(join(graphDir, 'GRAPH_REPORT.md'))) &&
      (await pathExists(join(graphDir, 'graph-metadata.json')));
    if (entry.graphStatus === 'complete' && !graphExists) {
      errors.push(`${definition.name} graphStatus=complete but graph outputs are missing.`);
    }
    if (entry.graphStatus === 'failed' && !entry.waiverRequired) {
      errors.push(`${definition.name} graphStatus=failed but waiverRequired=false.`);
    }
    if (entry.graphStatus === 'not-started' && !graphExists) {
      warnings.push(
        `${definition.name} graphStatus=not-started; Graphify discovery has not run yet.`
      );
    }
  }

  const ignoredPaths = [
    'research/upstreams/probe',
    'research/graphs/probe',
    'research/merged/probe',
    'graphify-out/probe',
  ];
  for (const ignoredPath of ignoredPaths) {
    const check = await runFile('git', ['check-ignore', '-q', ignoredPath], { cwd: repoRoot });
    if (!check.ok) {
      errors.push(`${ignoredPath} is not ignored by git.`);
    }
  }

  const staged = await runFile('git', [
    'diff',
    '--cached',
    '--name-only',
    '--',
    'research/upstreams',
    'research/graphs',
    'research/merged',
    'graphify-out',
  ]);
  if (!staged.ok) {
    errors.push('Could not inspect staged research workspace files.');
  } else if (staged.stdout.trim().length > 0) {
    errors.push(`Research workspace content is staged:\n${staged.stdout.trim()}`);
  }

  const status = await runFile('git', [
    'status',
    '--short',
    '--',
    'research/upstreams',
    'research/graphs',
    'research/merged',
    'graphify-out',
  ]);
  if (!status.ok) {
    errors.push('Could not inspect research workspace git status.');
  } else if (status.stdout.trim().length > 0) {
    errors.push(`Research workspace content is visible to git:\n${status.stdout.trim()}`);
  }

  return { errors, warnings };
}

function printMessages(label: string, values: string[]): void {
  if (values.length === 0) {
    console.log(`${label}: none`);
    return;
  }
  console.log(`${label}:`);
  for (const value of values) {
    console.log(`- ${value}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
