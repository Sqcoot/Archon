import { execFile } from 'child_process';
import { access, copyFile, mkdir, readFile, readdir, stat, writeFile } from 'fs/promises';
import { dirname, join, relative, resolve } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const repoRoot = resolve(import.meta.dir, '../..');
export const researchRoot = join(repoRoot, 'research');
export const upstreamRoot = join(researchRoot, 'upstreams');
export const graphsRoot = join(researchRoot, 'graphs');
export const mergedRoot = join(researchRoot, 'merged');
export const reportsRoot = join(researchRoot, 'reports');
export const manifestPath = join(
  repoRoot,
  'docs',
  'context-orchestrator',
  'research',
  'upstream-manifest.json'
);

export type CloneStatus =
  | 'cloned'
  | 'already-present'
  | 'fetched'
  | 'fast-forwarded'
  | 'blocked'
  | 'failed';

export type GraphStatus = 'not-started' | 'complete' | 'failed' | 'waived';

export interface UpstreamRepositoryDefinition {
  name: string;
  url: string;
  localPath: string;
  role: string;
}

export interface UpstreamRepositoryEntry extends UpstreamRepositoryDefinition {
  branch: string | null;
  commitSha: string | null;
  remoteDefaultBranch: string | null;
  exists: boolean;
  isGitRepository: boolean;
  dirty: boolean;
  ahead: number | null;
  behind: number | null;
  lastFetchedAt: string | null;
  cloneStatus: CloneStatus;
  graphStatus: GraphStatus;
  error: string | null;
  waiverRequired: boolean;
}

export interface UpstreamManifest {
  schemaVersion: 1;
  generatedAt: string;
  repositories: UpstreamRepositoryEntry[];
}

export interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface GraphifyInvocation {
  command: string;
  argsPrefix: string[];
  label: string;
}

interface ExecFileFailure extends Error {
  code?: number | string;
  stdout?: string | Buffer;
  stderr?: string | Buffer;
}

export const REQUIRED_UPSTREAMS: UpstreamRepositoryDefinition[] = [
  {
    name: 'archon',
    url: 'https://github.com/coleam00/Archon',
    localPath: 'research/upstreams/archon',
    role: 'first implementation host and Archon compatibility source',
  },
  {
    name: 'codex',
    url: 'https://github.com/openai/codex',
    localPath: 'research/upstreams/codex',
    role: 'Codex target-agent behavior and MCP/config reference',
  },
  {
    name: 'context7',
    url: 'https://github.com/upstash/context7',
    localPath: 'research/upstreams/context7',
    role: 'documentation and MCP-resolution capability source',
  },
  {
    name: 'bmad-method',
    url: 'https://github.com/bmad-code-org/BMAD-METHOD',
    localPath: 'research/upstreams/bmad-method',
    role: 'core BMAD method and workflow catalog source',
  },
  {
    name: 'bmad-cis',
    url: 'https://github.com/bmad-code-org/bmad-module-creative-intelligence-suite',
    localPath: 'research/upstreams/bmad-cis',
    role: 'creative intelligence and problem-solving module source',
  },
  {
    name: 'bmad-wds',
    url: 'https://github.com/bmad-code-org/bmad-method-wds-expansion.git',
    localPath: 'research/upstreams/bmad-wds',
    role: 'design and UX workflow source',
  },
  {
    name: 'bmad-builder',
    url: 'https://github.com/bmad-code-org/bmad-builder',
    localPath: 'research/upstreams/bmad-builder',
    role: 'BMAD module-building and distribution pattern source',
  },
  {
    name: 'bmad-plugins-marketplace',
    url: 'https://github.com/bmad-code-org/bmad-plugins-marketplace',
    localPath: 'research/upstreams/bmad-plugins-marketplace',
    role: 'BMAD plugin/module registry and trust/distribution source',
  },
  {
    name: 'bmad-tea',
    url: 'https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise',
    localPath: 'research/upstreams/bmad-tea',
    role: 'test architecture, ATDD, traceability, and quality gate source',
  },
  {
    name: 'bmad-sample-data',
    url: 'https://github.com/bmad-code-org/bmad-method-sample-data',
    localPath: 'research/upstreams/bmad-sample-data',
    role: 'route and acceptance-test fixture corpus source',
  },
  {
    name: 'bmad-automator',
    url: 'https://github.com/bmad-code-org/bmad-automator',
    localPath: 'research/upstreams/bmad-automator',
    role: 'automation and story/skill workflow pattern source',
  },
  {
    name: 'bmad-ui',
    url: 'https://github.com/bmad-code-org/bmad-method-ui',
    localPath: 'research/upstreams/bmad-ui',
    role: 'next-action, workflow state, and BMAD UI pattern source',
  },
  {
    name: 'caveman',
    url: 'https://github.com/JuliusBrussee/caveman',
    localPath: 'research/upstreams/caveman',
    role: 'terse-output and safe compression policy source',
  },
];

export function defaultEntry(definition: UpstreamRepositoryDefinition): UpstreamRepositoryEntry {
  return {
    ...definition,
    branch: null,
    commitSha: null,
    remoteDefaultBranch: null,
    exists: false,
    isGitRepository: false,
    dirty: false,
    ahead: null,
    behind: null,
    lastFetchedAt: null,
    cloneStatus: 'failed',
    graphStatus: 'not-started',
    error: null,
    waiverRequired: false,
  };
}

export function buildManifest(
  repositories: UpstreamRepositoryEntry[],
  generatedAt: string = new Date().toISOString()
): UpstreamManifest {
  return {
    schemaVersion: 1,
    generatedAt,
    repositories,
  };
}

export async function ensureArchonRepoRoot(): Promise<void> {
  const cwd = resolve(process.cwd());
  if (cwd !== repoRoot) {
    throw new Error(
      `Expected to run from Archon repository root ${repoRoot}; actual directory is ${cwd}.`
    );
  }

  const packageJsonPath = join(repoRoot, 'package.json');
  const packageJson = await readJsonFile(packageJsonPath);
  if (packageJson.name !== 'archon') {
    throw new Error(`${packageJsonPath} does not look like Archon root: name is not "archon".`);
  }

  const requiredPaths = ['packages/core', 'packages/workflows', 'packages/cli'];
  const missing: string[] = [];
  for (const requiredPath of requiredPaths) {
    if (!(await pathExists(join(repoRoot, requiredPath)))) {
      missing.push(requiredPath);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Directory does not look like Archon root. Missing: ${missing.join(', ')}`);
  }
}

export async function ensureResearchWorkspace(): Promise<void> {
  await Promise.all([
    mkdir(upstreamRoot, { recursive: true }),
    mkdir(graphsRoot, { recursive: true }),
    mkdir(mergedRoot, { recursive: true }),
    mkdir(reportsRoot, { recursive: true }),
    mkdir(dirname(manifestPath), { recursive: true }),
  ]);
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export async function readJsonFile(path: string): Promise<Record<string, unknown>> {
  const raw = await readFile(path, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Expected JSON object in ${path}`);
  }
  return parsed as Record<string, unknown>;
}

export async function readManifestIfExists(): Promise<UpstreamManifest | null> {
  if (!(await pathExists(manifestPath))) {
    return null;
  }
  const parsed = await readJsonFile(manifestPath);
  return normalizeManifest(parsed);
}

export async function readManifest(): Promise<UpstreamManifest> {
  const manifest = await readManifestIfExists();
  if (!manifest) {
    throw new Error(`Missing upstream manifest: ${manifestPath}`);
  }
  return manifest;
}

export async function writeManifest(manifest: UpstreamManifest): Promise<void> {
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
}

export function manifestEntryMap(
  manifest: UpstreamManifest | null
): Map<string, UpstreamRepositoryEntry> {
  const entries = new Map<string, UpstreamRepositoryEntry>();
  for (const entry of manifest?.repositories ?? []) {
    entries.set(entry.name, entry);
  }
  return entries;
}

export function createEntryFromExisting(
  definition: UpstreamRepositoryDefinition,
  existing: UpstreamRepositoryEntry | undefined
): UpstreamRepositoryEntry {
  return {
    ...defaultEntry(definition),
    graphStatus: existing?.graphStatus ?? 'not-started',
    error: existing?.error ?? null,
  };
}

export function localAbsolutePath(entry: Pick<UpstreamRepositoryEntry, 'localPath'>): string {
  return join(repoRoot, entry.localPath);
}

export function relativeFromRoot(path: string): string {
  return relative(repoRoot, path).replace(/\\/g, '/');
}

export function isSuccessfulCloneStatus(status: CloneStatus): boolean {
  return (
    status === 'cloned' ||
    status === 'already-present' ||
    status === 'fetched' ||
    status === 'fast-forwarded'
  );
}

export async function runFile(
  command: string,
  args: string[],
  options: { cwd?: string; timeout?: number; maxBuffer?: number } = {}
): Promise<CommandResult> {
  try {
    const result = await execFileAsync(command, args, {
      cwd: options.cwd,
      timeout: options.timeout,
      maxBuffer: options.maxBuffer ?? 1024 * 1024 * 20,
    });
    return {
      ok: true,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      exitCode: 0,
    };
  } catch (error) {
    const failure = error as ExecFileFailure;
    return {
      ok: false,
      stdout: bufferToString(failure.stdout),
      stderr: bufferToString(failure.stderr || failure.message),
      exitCode: typeof failure.code === 'number' ? failure.code : null,
    };
  }
}

export async function copyIfExists(from: string, to: string): Promise<boolean> {
  if (!(await pathExists(from))) {
    return false;
  }
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
  return true;
}

export async function listSubdirectories(path: string): Promise<string[]> {
  if (!(await pathExists(path))) {
    return [];
  }
  const entries = await readdir(path, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

export async function resolveGraphifyInvocation(): Promise<GraphifyInvocation | null> {
  const direct = await runFile('graphify', ['--help'], { timeout: 30_000 });
  if (direct.ok) {
    return { command: 'graphify', argsPrefix: [], label: 'graphify' };
  }

  const uv = await runFile('uv', ['tool', 'run', '--from', 'graphifyy', 'graphify', '--help'], {
    timeout: 120_000,
  });
  if (uv.ok) {
    return {
      command: 'uv',
      argsPrefix: ['tool', 'run', '--from', 'graphifyy', 'graphify'],
      label: 'uv tool run --from graphifyy graphify',
    };
  }

  return null;
}

export function graphifyArgs(invocation: GraphifyInvocation, args: string[]): string[] {
  return [...invocation.argsPrefix, ...args];
}

function normalizeManifest(parsed: Record<string, unknown>): UpstreamManifest {
  const repositoriesRaw = parsed.repositories;
  if (!Array.isArray(repositoriesRaw)) {
    throw new Error(`Invalid manifest ${manifestPath}: repositories must be an array.`);
  }
  const repositories = repositoriesRaw.map(normalizeEntry);
  return {
    schemaVersion: 1,
    generatedAt:
      typeof parsed.generatedAt === 'string' ? parsed.generatedAt : new Date().toISOString(),
    repositories,
  };
}

function normalizeEntry(value: unknown): UpstreamRepositoryEntry {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid manifest entry: expected object.');
  }
  const record = value as Record<string, unknown>;
  return {
    name: readString(record, 'name'),
    url: readString(record, 'url'),
    localPath: readString(record, 'localPath'),
    role: readString(record, 'role'),
    branch: readNullableString(record, 'branch'),
    commitSha: readNullableString(record, 'commitSha'),
    remoteDefaultBranch: readNullableString(record, 'remoteDefaultBranch'),
    exists: readBoolean(record, 'exists'),
    isGitRepository: readBoolean(record, 'isGitRepository'),
    dirty: readBoolean(record, 'dirty'),
    ahead: readNullableNumber(record, 'ahead'),
    behind: readNullableNumber(record, 'behind'),
    lastFetchedAt: readNullableString(record, 'lastFetchedAt'),
    cloneStatus: readCloneStatus(record, 'cloneStatus'),
    graphStatus: readGraphStatus(record, 'graphStatus'),
    error: readNullableString(record, 'error'),
    waiverRequired: readBoolean(record, 'waiverRequired'),
  };
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error(`Invalid manifest entry: ${key} must be a string.`);
  }
  return value;
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`Invalid manifest entry: ${key} must be a string or null.`);
  }
  return value;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid manifest entry: ${key} must be a boolean.`);
  }
  return value;
}

function readNullableNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'number') {
    throw new Error(`Invalid manifest entry: ${key} must be a number or null.`);
  }
  return value;
}

function readCloneStatus(record: Record<string, unknown>, key: string): CloneStatus {
  const value = readString(record, key);
  if (
    value === 'cloned' ||
    value === 'already-present' ||
    value === 'fetched' ||
    value === 'fast-forwarded' ||
    value === 'blocked' ||
    value === 'failed'
  ) {
    return value;
  }
  throw new Error(`Invalid manifest entry: ${key} has unsupported value ${value}.`);
}

function readGraphStatus(record: Record<string, unknown>, key: string): GraphStatus {
  const value = readString(record, key);
  if (value === 'not-started' || value === 'complete' || value === 'failed' || value === 'waived') {
    return value;
  }
  throw new Error(`Invalid manifest entry: ${key} has unsupported value ${value}.`);
}

function bufferToString(value: string | Buffer | undefined): string {
  if (value === undefined) {
    return '';
  }
  return Buffer.isBuffer(value) ? value.toString('utf-8') : value;
}
