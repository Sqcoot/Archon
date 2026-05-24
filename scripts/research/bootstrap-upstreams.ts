#!/usr/bin/env bun
import {
  type CloneStatus,
  type UpstreamRepositoryEntry,
  REQUIRED_UPSTREAMS,
  buildManifest,
  createEntryFromExisting,
  ensureArchonRepoRoot,
  ensureResearchWorkspace,
  isDirectory,
  localAbsolutePath,
  manifestEntryMap,
  manifestPath,
  pathExists,
  readManifestIfExists,
  relativeFromRoot,
  repoRoot,
  runFile,
  upstreamRoot,
  writeManifest,
} from './common';

interface BootstrapOptions {
  fetchOnly: boolean;
  ffOnly: boolean;
  validateOnly: boolean;
  json: boolean;
  repositories: Set<string> | null;
}

interface BootstrapSummary {
  cloned: string[];
  alreadyPresent: string[];
  fetched: string[];
  fastForwarded: string[];
  dirty: string[];
  blocked: string[];
  failed: string[];
  waiverRequired: string[];
  validationErrors: string[];
}

interface GitState {
  branch: string | null;
  commitSha: string | null;
  remoteDefaultBranch: string | null;
  dirty: boolean;
  ahead: number | null;
  behind: number | null;
}

function parseOptions(): BootstrapOptions {
  const args = process.argv.slice(2);
  const repositories = new Set<string>();
  const unsupported: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (
      arg === '--fetch-only' ||
      arg === '--ff-only' ||
      arg === '--validate-only' ||
      arg === '--json'
    ) {
      continue;
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
  const fetchOnly = args.includes('--fetch-only');
  const ffOnly = args.includes('--ff-only');
  const validateOnly = args.includes('--validate-only');
  if (fetchOnly && ffOnly) {
    throw new Error('--fetch-only and --ff-only are mutually exclusive.');
  }
  return {
    fetchOnly,
    ffOnly,
    validateOnly,
    json: args.includes('--json'),
    repositories: repositories.size > 0 ? repositories : null,
  };
}

async function main(): Promise<void> {
  const options = parseOptions();
  await ensureArchonRepoRoot();

  if (options.validateOnly) {
    const manifest = await readManifestIfExists();
    const validationErrors = manifest
      ? await validateBootstrapManifest(manifest.repositories)
      : [`Missing upstream manifest: ${manifestPath}`];
    const summary = createSummary();
    summary.validationErrors = validationErrors;
    printSummary(summary, options.json);
    if (validationErrors.length > 0) {
      process.exit(1);
    }
    return;
  }

  await ensureResearchWorkspace();
  const existingManifest = await readManifestIfExists();
  const existingEntries = manifestEntryMap(existingManifest);
  const repositories: UpstreamRepositoryEntry[] = [];
  validateRepositoryFilter(options.repositories);

  for (const definition of REQUIRED_UPSTREAMS) {
    if (options.repositories && !options.repositories.has(definition.name)) {
      repositories.push(existingEntries.get(definition.name) ?? defaultSkippedEntry(definition));
      continue;
    }
    const entry = createEntryFromExisting(definition, existingEntries.get(definition.name));
    const processed = await processRepository(entry, options);
    repositories.push(processed);
  }

  const manifest = buildManifest(repositories);
  await writeManifest(manifest);
  const summary = summarize(repositories);
  summary.validationErrors = await validateBootstrapManifest(repositories);
  printSummary(summary, options.json);

  if (summary.validationErrors.length > 0) {
    process.exit(1);
  }
}

function validateRepositoryFilter(repositories: Set<string> | null): void {
  if (!repositories) return;
  const known = new Set(REQUIRED_UPSTREAMS.map(entry => entry.name));
  const unknown = [...repositories].filter(name => !known.has(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown repository filter(s): ${unknown.join(', ')}`);
  }
}

function defaultSkippedEntry(
  definition: (typeof REQUIRED_UPSTREAMS)[number]
): UpstreamRepositoryEntry {
  return {
    ...createEntryFromExisting(definition, undefined),
    cloneStatus: 'failed',
    error: 'Repository was not processed by this targeted bootstrap run.',
    waiverRequired: true,
  };
}

async function processRepository(
  entry: UpstreamRepositoryEntry,
  options: BootstrapOptions
): Promise<UpstreamRepositoryEntry> {
  const localPath = localAbsolutePath(entry);

  if (!(await pathExists(localPath))) {
    const clone = await runFile('git', ['clone', entry.url, localPath], {
      cwd: repoRoot,
      timeout: 300_000,
    });
    if (!clone.ok) {
      return {
        ...entry,
        exists: false,
        isGitRepository: false,
        cloneStatus: 'failed',
        error: compactError(clone.stderr || clone.stdout),
        waiverRequired: true,
      };
    }
    return markSuccessfulBootstrap({
      ...(await enrichGitEntry(entry, 'cloned')),
      lastFetchedAt: new Date().toISOString(),
    });
  }

  if (!(await isDirectory(localPath))) {
    return {
      ...entry,
      exists: true,
      isGitRepository: false,
      cloneStatus: 'blocked',
      error: `${relativeFromRoot(localPath)} exists but is not a directory.`,
      waiverRequired: true,
    };
  }

  const isGitRepository = await runFile('git', [
    '-C',
    localPath,
    'rev-parse',
    '--is-inside-work-tree',
  ]);
  if (!isGitRepository.ok) {
    return {
      ...entry,
      exists: true,
      isGitRepository: false,
      cloneStatus: 'blocked',
      error: `${relativeFromRoot(localPath)} exists but is not a git repository.`,
      waiverRequired: true,
    };
  }

  const fetchedAt = new Date().toISOString();
  const fetch = await runFile('git', ['-C', localPath, 'fetch', '--all', '--prune'], {
    timeout: 300_000,
  });
  if (!fetch.ok) {
    return {
      ...(await enrichGitEntry(entry, 'failed')),
      lastFetchedAt: null,
      error: compactError(fetch.stderr || fetch.stdout),
      waiverRequired: true,
    };
  }

  const current = await enrichGitEntry(entry, options.fetchOnly ? 'fetched' : 'fetched');
  current.lastFetchedAt = fetchedAt;

  if (!options.ffOnly) {
    return markSuccessfulBootstrap(current);
  }

  if (current.dirty) {
    current.cloneStatus = 'blocked';
    current.error = 'Repository is dirty; --ff-only will not modify it.';
    current.waiverRequired = true;
    return current;
  }

  const upstream = await runFile('git', [
    '-C',
    localPath,
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{u}',
  ]);
  if (!upstream.ok) {
    current.cloneStatus = 'blocked';
    current.error = 'Current branch has no upstream; cannot fast-forward safely.';
    current.waiverRequired = true;
    return current;
  }

  const upstreamRef = upstream.stdout.trim();
  const canFastForward = await runFile('git', [
    '-C',
    localPath,
    'merge-base',
    '--is-ancestor',
    'HEAD',
    upstreamRef,
  ]);
  if (!canFastForward.ok) {
    current.cloneStatus = 'blocked';
    current.error = `Current branch is not fast-forwardable to ${upstreamRef}.`;
    current.waiverRequired = true;
    return current;
  }

  if ((current.behind ?? 0) === 0) {
    current.cloneStatus = 'already-present';
    return markSuccessfulBootstrap(current);
  }

  const fastForward = await runFile('git', ['-C', localPath, 'merge', '--ff-only', upstreamRef], {
    timeout: 300_000,
  });
  if (!fastForward.ok) {
    current.cloneStatus = 'blocked';
    current.error = compactError(fastForward.stderr || fastForward.stdout);
    current.waiverRequired = true;
    return current;
  }

  const updated = await enrichGitEntry(entry, 'fast-forwarded');
  updated.lastFetchedAt = fetchedAt;
  return markSuccessfulBootstrap(updated);
}

async function enrichGitEntry(
  entry: UpstreamRepositoryEntry,
  cloneStatus: CloneStatus
): Promise<UpstreamRepositoryEntry> {
  const localPath = localAbsolutePath(entry);
  const state = await readGitState(localPath);
  return {
    ...entry,
    ...state,
    exists: true,
    isGitRepository: true,
    cloneStatus,
  };
}

async function readGitState(localPath: string): Promise<GitState> {
  const branch = await gitOutput(localPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const commitSha = await gitOutput(localPath, ['rev-parse', 'HEAD']);
  const dirtyOutput = await runFile('git', ['-C', localPath, 'status', '--porcelain']);
  const remoteDefaultBranch = await readRemoteDefaultBranch(localPath);
  const aheadBehind = await readAheadBehind(localPath);

  return {
    branch: branch === 'HEAD' ? null : branch,
    commitSha,
    remoteDefaultBranch,
    dirty: dirtyOutput.ok && dirtyOutput.stdout.trim().length > 0,
    ahead: aheadBehind.ahead,
    behind: aheadBehind.behind,
  };
}

async function readRemoteDefaultBranch(localPath: string): Promise<string | null> {
  const symbolic = await gitOutput(localPath, [
    'symbolic-ref',
    'refs/remotes/origin/HEAD',
    '--short',
  ]);
  if (symbolic) {
    return symbolic.replace(/^origin\//, '');
  }

  const remoteShow = await runFile('git', ['-C', localPath, 'remote', 'show', 'origin']);
  if (!remoteShow.ok) {
    return null;
  }
  const line = remoteShow.stdout
    .split('\n')
    .map(value => value.trim())
    .find(value => value.startsWith('HEAD branch:'));
  return line?.replace('HEAD branch:', '').trim() || null;
}

async function readAheadBehind(
  localPath: string
): Promise<{ ahead: number | null; behind: number | null }> {
  const result = await runFile('git', [
    '-C',
    localPath,
    'rev-list',
    '--left-right',
    '--count',
    'HEAD...@{u}',
  ]);
  if (!result.ok) {
    return { ahead: null, behind: null };
  }
  const [aheadRaw, behindRaw] = result.stdout.trim().split(/\s+/);
  const ahead = Number.parseInt(aheadRaw ?? '', 10);
  const behind = Number.parseInt(behindRaw ?? '', 10);
  return {
    ahead: Number.isFinite(ahead) ? ahead : null,
    behind: Number.isFinite(behind) ? behind : null,
  };
}

async function gitOutput(localPath: string, args: string[]): Promise<string | null> {
  const result = await runFile('git', ['-C', localPath, ...args]);
  if (!result.ok) {
    return null;
  }
  const output = result.stdout.trim();
  return output.length > 0 ? output : null;
}

async function validateBootstrapManifest(
  repositories: UpstreamRepositoryEntry[]
): Promise<string[]> {
  const errors: string[] = [];
  const entries = new Map(repositories.map(entry => [entry.name, entry]));
  for (const definition of REQUIRED_UPSTREAMS) {
    const entry = entries.get(definition.name);
    if (!entry) {
      errors.push(`Missing manifest entry for ${definition.name}.`);
      continue;
    }
    if (entry.url !== definition.url) {
      errors.push(`${definition.name} url mismatch.`);
    }
    if (entry.localPath !== definition.localPath) {
      errors.push(`${definition.name} localPath mismatch.`);
    }
    if (!entry.role) {
      errors.push(`${definition.name} role is empty.`);
    }
    if (
      (entry.cloneStatus === 'failed' || entry.cloneStatus === 'blocked') &&
      !entry.waiverRequired
    ) {
      errors.push(`${definition.name} is ${entry.cloneStatus} but waiverRequired is false.`);
    }
    if (isSuccessfulBootstrapStatus(entry.cloneStatus) && !entry.commitSha) {
      errors.push(`${definition.name} is ${entry.cloneStatus} but commitSha is missing.`);
    }
  }

  if (!(await pathExists(upstreamRoot))) {
    errors.push('Missing research/upstreams workspace directory.');
  }

  return errors;
}

function isSuccessfulBootstrapStatus(status: CloneStatus): boolean {
  return (
    status === 'cloned' ||
    status === 'already-present' ||
    status === 'fetched' ||
    status === 'fast-forwarded'
  );
}

function markSuccessfulBootstrap(entry: UpstreamRepositoryEntry): UpstreamRepositoryEntry {
  if (entry.graphStatus === 'failed' || entry.graphStatus === 'waived') {
    return {
      ...entry,
      waiverRequired: true,
    };
  }
  return {
    ...entry,
    error: null,
    waiverRequired: false,
  };
}

function summarize(repositories: UpstreamRepositoryEntry[]): BootstrapSummary {
  const summary = createSummary();
  for (const entry of repositories) {
    if (entry.cloneStatus === 'cloned') summary.cloned.push(entry.name);
    if (entry.cloneStatus === 'already-present') summary.alreadyPresent.push(entry.name);
    if (entry.cloneStatus === 'fetched') summary.fetched.push(entry.name);
    if (entry.cloneStatus === 'fast-forwarded') summary.fastForwarded.push(entry.name);
    if (entry.dirty) summary.dirty.push(entry.name);
    if (entry.cloneStatus === 'blocked') summary.blocked.push(entry.name);
    if (entry.cloneStatus === 'failed') summary.failed.push(entry.name);
    if (entry.waiverRequired) summary.waiverRequired.push(entry.name);
  }
  return summary;
}

function createSummary(): BootstrapSummary {
  return {
    cloned: [],
    alreadyPresent: [],
    fetched: [],
    fastForwarded: [],
    dirty: [],
    blocked: [],
    failed: [],
    waiverRequired: [],
    validationErrors: [],
  };
}

function printSummary(summary: BootstrapSummary, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ manifestPath: relativeFromRoot(manifestPath), summary }, null, 2));
    return;
  }

  console.log('Research upstream bootstrap');
  printList('cloned', summary.cloned);
  printList('already-present', summary.alreadyPresent);
  printList('fetched', summary.fetched);
  printList('fast-forwarded', summary.fastForwarded);
  printList('dirty', summary.dirty);
  printList('blocked', summary.blocked);
  printList('failed', summary.failed);
  printList('waiver-required', summary.waiverRequired);
  console.log(`manifest: ${relativeFromRoot(manifestPath)}`);
  if (summary.validationErrors.length > 0) {
    console.error('validation errors:');
    for (const error of summary.validationErrors) {
      console.error(`- ${error}`);
    }
  } else {
    console.log('validation: passed');
  }
}

function printList(label: string, values: string[]): void {
  console.log(`${label}: ${values.length > 0 ? values.join(', ') : 'none'}`);
}

function compactError(error: string): string {
  return error.trim().split('\n').slice(0, 6).join('\n') || 'Unknown error.';
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
