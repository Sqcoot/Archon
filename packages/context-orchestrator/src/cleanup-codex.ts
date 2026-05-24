import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { lstat, readFile, readlink, rm, rmdir } from 'fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { isPathInside, redactSecrets, validateSafeRunId } from './security';

export const ACO_CLEANUP_CODEX_COMMAND_SCHEMA_VERSION = 'aco.cleanup-codex-command.v1' as const;
export const ACO_CLEANUP_CODEX_MANIFEST_SCHEMA_VERSION = 'aco.cleanup-codex-manifest.v1' as const;
export const ACO_CLEANUP_CODEX_COMMAND = '/aco:cleanup-codex' as const;

export interface AcoCleanupManifestEntry {
  path: string;
  ownedBy: string;
  runId: string;
  kind: string;
  sha256?: string;
}

export interface AcoCleanupManifest {
  schemaVersion: typeof ACO_CLEANUP_CODEX_MANIFEST_SCHEMA_VERSION;
  runId: string;
  createdAt: string;
  root: string;
  entries: AcoCleanupManifestEntry[];
}

export interface RunAcoCleanupCodexCommandOptions {
  cwd: string;
  runId?: string;
  manifest?: string;
  artifactsDir?: string;
  dryRun?: boolean;
  apply?: boolean;
  json?: boolean;
  timestamp?: string;
}

export interface AcoCleanupPathRefusal {
  path: string;
  reason: string;
}

export interface AcoCleanupSkippedPath {
  path: string;
  reason: string;
}

export interface AcoCleanupLedgerRow {
  schemaVersion: 'aco.cleanup-codex-ledger-row.v1';
  runId: string;
  generatedAt: string;
  dryRun: boolean;
  deletedCount: number;
  refusedCount: number;
  skippedCount: number;
  beforeAfterDigest: AcoCleanupBeforeAfterDigest;
}

export interface AcoCleanupBeforeAfterDigest {
  before: string;
  after: string;
}

export interface AcoCleanupCodexCommandResult {
  schemaVersion: typeof ACO_CLEANUP_CODEX_COMMAND_SCHEMA_VERSION;
  command: typeof ACO_CLEANUP_CODEX_COMMAND;
  generatedAt: string;
  cwd: string;
  runId: string;
  manifest: string;
  status: 'passed' | 'blocked';
  dryRun: boolean;
  plannedPaths: string[];
  deletedPaths: string[];
  skippedPaths: AcoCleanupSkippedPath[];
  refusedPaths: AcoCleanupPathRefusal[];
  beforeAfterDigest: AcoCleanupBeforeAfterDigest;
  cleanupLedgerRow: AcoCleanupLedgerRow;
  idempotentNoopWhenRepeated: boolean;
  mutationReport: {
    userConfigMutated: false;
    authMutated: false;
    mcpOauthMutated: false;
    providerCredentialsMutated: false;
    graphMutated: false;
  };
  output: {
    format: 'json' | 'text';
    text: string;
  };
}

interface NormalizedCleanupOptions {
  cwd: string;
  runId: string;
  manifest: string;
  artifactsDir: string;
  dryRun: boolean;
  timestamp: string;
}

interface CandidatePath {
  entry: AcoCleanupManifestEntry;
  absolutePath: string;
  relativePath: string;
}

export async function runAcoCleanupCodexCommand(
  options: RunAcoCleanupCodexCommandOptions
): Promise<AcoCleanupCodexCommandResult> {
  const normalized = await normalizeCleanupOptions(options);
  const manifest = await readManifest(normalized.manifest);
  if (manifest === null) {
    return noManifestResult(normalized, options.json === true);
  }
  if (manifest.runId !== normalized.runId) {
    throw new Error(
      `ACO cleanup manifest runId mismatch: expected ${normalized.runId}, got ${manifest.runId}`
    );
  }

  const candidates = manifest.entries
    .filter(entry => entry.ownedBy === 'aco' && entry.runId === normalized.runId)
    .map(entry => toCandidate(normalized.cwd, entry));
  const beforeDigest = await digestCandidates(candidates);
  const plannedPaths: string[] = [];
  const deletedPaths: string[] = [];
  const skippedPaths: AcoCleanupSkippedPath[] = [];
  const refusedPaths: AcoCleanupPathRefusal[] = [];

  for (const candidate of candidates) {
    const refusal = await refusalReason(candidate, normalized);
    if (refusal !== null) {
      refusedPaths.push({ path: candidate.relativePath, reason: refusal });
      continue;
    }
    if (!existsSync(candidate.absolutePath)) {
      skippedPaths.push({ path: candidate.relativePath, reason: 'missing' });
      continue;
    }
    plannedPaths.push(candidate.relativePath);
    if (normalized.dryRun) continue;
    await rm(candidate.absolutePath, { force: true, recursive: false });
    deletedPaths.push(candidate.relativePath);
  }

  if (!normalized.dryRun) {
    await removeEmptyRunDirectories(candidates, normalized.cwd);
  }

  const afterDigest = await digestCandidates(candidates);
  return buildResult({
    normalized,
    json: options.json === true,
    plannedPaths,
    deletedPaths,
    skippedPaths,
    refusedPaths,
    beforeAfterDigest: { before: beforeDigest, after: afterDigest },
    idempotentNoopWhenRepeated:
      !normalized.dryRun && deletedPaths.length === 0 && refusedPaths.length === 0,
  });
}

async function normalizeCleanupOptions(
  options: RunAcoCleanupCodexCommandOptions
): Promise<NormalizedCleanupOptions> {
  const cwd = resolve(options.cwd);
  const timestamp = options.timestamp ?? new Date().toISOString();
  const artifactsDir = resolve(
    options.artifactsDir ?? join(cwd, '.archon/artifacts/context-orchestrator')
  );
  const manifestPathFromOption =
    options.manifest === undefined ? undefined : resolve(cwd, options.manifest);
  const manifestRunId = manifestPathFromOption
    ? ((await readManifest(manifestPathFromOption))?.runId ?? options.runId)
    : options.runId;
  if (manifestRunId === undefined) {
    throw new Error('--run-id is required unless --manifest contains one runId.');
  }
  const runId = validateSafeRunId(manifestRunId);
  const manifest =
    manifestPathFromOption ??
    firstExistingPath([
      join(cwd, '.aco/runs', runId, 'manifest.json'),
      join(artifactsDir, runId, 'cleanup-manifest.json'),
    ]) ??
    join(artifactsDir, runId, 'cleanup-manifest.json');
  const dryRun = options.apply === true ? false : (options.dryRun ?? true);
  return {
    cwd,
    runId,
    manifest,
    artifactsDir,
    dryRun,
    timestamp,
  };
}

async function readManifest(path: string): Promise<AcoCleanupManifest | null> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
    if (!isManifest(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function noManifestResult(
  normalized: NormalizedCleanupOptions,
  json: boolean
): AcoCleanupCodexCommandResult {
  return buildResult({
    normalized,
    json,
    plannedPaths: [],
    deletedPaths: [],
    skippedPaths: [
      { path: toDisplayPath(normalized.cwd, normalized.manifest), reason: 'manifest missing' },
    ],
    refusedPaths: [],
    beforeAfterDigest: { before: sha256('missing'), after: sha256('missing') },
    idempotentNoopWhenRepeated: true,
  });
}

function buildResult(input: {
  normalized: NormalizedCleanupOptions;
  json: boolean;
  plannedPaths: string[];
  deletedPaths: string[];
  skippedPaths: AcoCleanupSkippedPath[];
  refusedPaths: AcoCleanupPathRefusal[];
  beforeAfterDigest: AcoCleanupBeforeAfterDigest;
  idempotentNoopWhenRepeated: boolean;
}): AcoCleanupCodexCommandResult {
  const cleanupLedgerRow: AcoCleanupLedgerRow = {
    schemaVersion: 'aco.cleanup-codex-ledger-row.v1',
    runId: input.normalized.runId,
    generatedAt: input.normalized.timestamp,
    dryRun: input.normalized.dryRun,
    deletedCount: input.deletedPaths.length,
    refusedCount: input.refusedPaths.length,
    skippedCount: input.skippedPaths.length,
    beforeAfterDigest: input.beforeAfterDigest,
  };
  const resultBase: Omit<AcoCleanupCodexCommandResult, 'output'> = {
    schemaVersion: ACO_CLEANUP_CODEX_COMMAND_SCHEMA_VERSION,
    command: ACO_CLEANUP_CODEX_COMMAND,
    generatedAt: input.normalized.timestamp,
    cwd: redactSecrets(input.normalized.cwd),
    runId: input.normalized.runId,
    manifest: toDisplayPath(input.normalized.cwd, input.normalized.manifest),
    status: 'passed' as const,
    dryRun: input.normalized.dryRun,
    plannedPaths: input.plannedPaths.map(redactSecrets),
    deletedPaths: input.deletedPaths.map(redactSecrets),
    skippedPaths: input.skippedPaths.map(item => ({
      path: redactSecrets(item.path),
      reason: item.reason,
    })),
    refusedPaths: input.refusedPaths.map(item => ({
      path: redactSecrets(item.path),
      reason: item.reason,
    })),
    beforeAfterDigest: input.beforeAfterDigest,
    cleanupLedgerRow,
    idempotentNoopWhenRepeated: input.idempotentNoopWhenRepeated,
    mutationReport: {
      userConfigMutated: false,
      authMutated: false,
      mcpOauthMutated: false,
      providerCredentialsMutated: false,
      graphMutated: false,
    },
  };
  const output = input.json
    ? `${JSON.stringify(resultBase, null, 2)}\n`
    : renderCleanupText(resultBase);
  return {
    ...resultBase,
    output: {
      format: input.json ? 'json' : 'text',
      text: output,
    },
  };
}

function renderCleanupText(result: Omit<AcoCleanupCodexCommandResult, 'output'>): string {
  return [
    'ACO Codex Cleanup',
    `runId: ${result.runId}`,
    `dryRun: ${String(result.dryRun)}`,
    `manifest: ${result.manifest}`,
    `planned: ${String(result.plannedPaths.length)}`,
    `deleted: ${String(result.deletedPaths.length)}`,
    `refused: ${String(result.refusedPaths.length)}`,
    `skipped: ${String(result.skippedPaths.length)}`,
    `idempotentNoopWhenRepeated: ${String(result.idempotentNoopWhenRepeated)}`,
    '',
  ].join('\n');
}

function toCandidate(cwd: string, entry: AcoCleanupManifestEntry): CandidatePath {
  const absolutePath = isAbsolute(entry.path) ? resolve(entry.path) : resolve(cwd, entry.path);
  return {
    entry,
    absolutePath,
    relativePath: toDisplayPath(cwd, absolutePath),
  };
}

async function refusalReason(
  candidate: CandidatePath,
  options: NormalizedCleanupOptions
): Promise<string | null> {
  if (!isPathInside(options.cwd, candidate.absolutePath)) {
    return 'path escapes cwd';
  }
  if (candidate.entry.ownedBy !== 'aco') return 'not ACO-owned';
  if (candidate.entry.runId !== options.runId) return 'runId mismatch';
  if (isProtectedPath(candidate.relativePath, candidate.entry)) return 'protected path';

  try {
    const stats = await lstat(candidate.absolutePath);
    if (stats.isSymbolicLink()) {
      const target = await readlink(candidate.absolutePath);
      const resolvedTarget = isAbsolute(target)
        ? resolve(target)
        : resolve(dirname(candidate.absolutePath), target);
      if (!isPathInside(options.cwd, resolvedTarget)) return 'symlink escapes cwd';
    }
    if (stats.isDirectory()) return 'directory deletion requires empty-dir cleanup';
    if (!stats.isFile() && !stats.isSymbolicLink()) return 'not a regular file';
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    return `path unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }

  return null;
}

function isProtectedPath(relativePath: string, entry: AcoCleanupManifestEntry): boolean {
  const path = normalizePath(relativePath);
  if (path.startsWith('../')) return true;
  if (path.startsWith('.codex/')) {
    return !(
      path === '.codex/hooks.json' ||
      path.startsWith('.codex/hooks/') ||
      entry.kind === 'hookProbe'
    );
  }
  if (
    path.includes('/auth') ||
    path.includes('oauth') ||
    path.includes('credential') ||
    path.includes('provider-credential') ||
    path.endsWith('.env') ||
    path.includes('/.env')
  ) {
    return true;
  }
  if (
    path === 'docs/context-orchestrator/research/upstream-manifest.json' ||
    path.includes('waiver') ||
    path.startsWith('graphify-out/') ||
    path.startsWith('research/graphs/')
  ) {
    return true;
  }
  if (entry.kind === 'ledger' && !path.includes(entry.runId)) return true;
  return false;
}

async function digestCandidates(candidates: CandidatePath[]): Promise<string> {
  const rows: string[] = [];
  for (const candidate of candidates) {
    try {
      const stats = await lstat(candidate.absolutePath);
      rows.push(
        `${candidate.relativePath}:${stats.size}:${stats.mtimeMs}:${stats.isSymbolicLink()}`
      );
    } catch {
      rows.push(`${candidate.relativePath}:missing`);
    }
  }
  return sha256(rows.sort().join('\n'));
}

async function removeEmptyRunDirectories(candidates: CandidatePath[], cwd: string): Promise<void> {
  const directories = unique(
    candidates
      .map(candidate => dirname(candidate.absolutePath))
      .filter(directory => isPathInside(cwd, directory))
      .sort((a, b) => b.length - a.length)
  );
  for (const directory of directories) {
    if (!relative(cwd, directory).includes('.archon/artifacts/context-orchestrator')) continue;
    try {
      await rmdir(directory);
    } catch {
      // Non-empty directories are expected when protected/unmanaged files remain.
    }
  }
}

function isManifest(value: unknown): value is AcoCleanupManifest {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== ACO_CLEANUP_CODEX_MANIFEST_SCHEMA_VERSION) return false;
  return (
    typeof value.runId === 'string' &&
    typeof value.root === 'string' &&
    Array.isArray(value.entries)
  );
}

function firstExistingPath(paths: string[]): string | undefined {
  return paths.find(path => existsSync(path));
}

function toDisplayPath(cwd: string, path: string): string {
  const display = isPathInside(cwd, path) ? relative(cwd, path) : path;
  return normalizePath(display || '.');
}

function normalizePath(path: string): string {
  return path.split('\\').join('/');
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
