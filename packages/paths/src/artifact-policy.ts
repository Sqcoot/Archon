import { existsSync, lstatSync, mkdirSync, realpathSync } from 'fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'path';

export type ArtifactRootSource =
  | 'env:ARTIFACTS_DIR'
  | 'cwd:.archon/artifacts'
  | 'workflow:run-artifacts'
  | 'default:codex-hooks-preflight'
  | 'explicit:artifact-root';

export interface ScopedArtifactRootPolicy {
  readonly kind: 'scoped-artifact-root-policy';
  readonly schemaVersion: 'archon.artifact-root-policy.v1';
  readonly source: ArtifactRootSource;
  readonly requestedRoot: string;
  readonly artifactRoot: string;
  readonly scopedRunArtifact: true;
  readonly checkoutMutation: false;
  readonly safeWriteBoundary:
    | '$ARTIFACTS_DIR'
    | '.archon/artifacts'
    | 'workflow-run-artifacts'
    | 'codex-hooks-preflight'
    | 'explicit-artifact-root';
  readonly symlinkPolicy: {
    readonly rootMustNotBeSymlink: true;
    readonly relativeRootComponentsMustNotBeSymlinks: true;
    readonly artifactPathComponentsMustNotBeSymlinks: true;
    readonly realpathMustRemainInsideArtifactRoot: true;
  };
  readonly restrictions: readonly string[];
}

export function resolveScopedArtifactRoot(input: {
  readonly cwd: string;
  readonly artifactsDir?: string;
  readonly source?: ArtifactRootSource;
}): ScopedArtifactRootPolicy {
  const baseCwd = existsSync(input.cwd) ? input.cwd : process.cwd();
  const requestedRoot =
    input.artifactsDir && input.artifactsDir.trim().length > 0
      ? isAbsolute(input.artifactsDir)
        ? resolve(input.artifactsDir)
        : resolve(baseCwd, input.artifactsDir)
      : resolve(baseCwd, '.archon', 'artifacts');

  const source =
    input.source ??
    (input.artifactsDir && input.artifactsDir.trim().length > 0
      ? 'env:ARTIFACTS_DIR'
      : 'cwd:.archon/artifacts');
  const resolvedBaseCwd = resolve(baseCwd);

  if (isPathInsideOrEqual(resolvedBaseCwd, requestedRoot)) {
    assertNoSymlinkComponents(resolvedBaseCwd, requestedRoot);
  }

  mkdirSync(requestedRoot, { recursive: true });

  if (isPathInsideOrEqual(resolvedBaseCwd, requestedRoot)) {
    assertNoSymlinkComponents(resolvedBaseCwd, requestedRoot);
  }
  if (lstatSync(requestedRoot).isSymbolicLink()) {
    throw new Error(`artifact root is a symlink: ${requestedRoot}`);
  }

  return {
    kind: 'scoped-artifact-root-policy',
    schemaVersion: 'archon.artifact-root-policy.v1',
    source,
    requestedRoot,
    artifactRoot: realpathSync(requestedRoot),
    scopedRunArtifact: true,
    checkoutMutation: false,
    safeWriteBoundary: safeWriteBoundaryForSource(source),
    symlinkPolicy: {
      rootMustNotBeSymlink: true,
      relativeRootComponentsMustNotBeSymlinks: true,
      artifactPathComponentsMustNotBeSymlinks: true,
      realpathMustRemainInsideArtifactRoot: true,
    },
    restrictions: [
      'artifact paths must resolve inside artifactRoot',
      'relative/default artifact roots under cwd must not traverse symlink components',
      'parent directories and target files must not be symlinks',
      'artifact file names may not be empty, absolute, or contain empty, ., or .. path segments',
      'artifact writes are scoped run artifacts, not checkout mutations',
    ],
  };
}

export function scopedArtifactPath(root: string, child: string): string {
  const resolved = resolve(root, child);
  assertPathInsideRoot(root, resolved);
  return resolved;
}

export function ensureScopedArtifactDirectory(root: string, directory: string): void {
  assertPathInsideRoot(root, directory);
  assertNoSymlinkComponents(root, directory);
  mkdirSync(directory, { recursive: true });
  assertNoSymlinkComponents(root, directory);
  assertRealPathInsideRoot(root, directory);
}

export function ensureScopedWritableFilePath(root: string, path: string): void {
  assertPathInsideRoot(root, path);
  const parent = dirname(path);
  assertNoSymlinkComponents(root, parent);
  mkdirSync(parent, { recursive: true });
  assertNoSymlinkComponents(root, parent);
  assertRealPathInsideRoot(root, parent);
  if (existsSync(path)) {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      throw new Error(`artifact path contains symlink: ${path}`);
    }
    if (stat.isDirectory()) {
      throw new Error(`artifact path is a directory: ${path}`);
    }
  }
}

export function sanitizeArtifactName(name: string): string {
  const normalized = name.replace(/\\/g, '/');
  if (
    normalized.length === 0 ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split('/').some(part => part === '..' || part === '.' || part === '')
  ) {
    throw new Error(`invalid artifact name: ${name}`);
  }
  return normalized;
}

export function assertPathInsideRoot(root: string, child: string): void {
  const resolved = resolve(child);
  const relativePath = relative(root, resolved);
  if (relativePath.startsWith('..') || relativePath === '..' || relativePath.startsWith(sep)) {
    throw new Error(`artifact path escapes artifact root: ${resolved}`);
  }
}

export function assertRealPathInsideRoot(root: string, child: string): void {
  const rootReal = realpathSync(root);
  const childReal = realpathSync(child);
  const relativePath = relative(rootReal, childReal);
  if (relativePath.startsWith('..') || relativePath === '..' || relativePath.startsWith(sep)) {
    throw new Error(`artifact path resolves outside artifact root: ${child}`);
  }
}

export function assertNoSymlinkComponents(root: string, child: string): void {
  const resolvedRoot = resolve(root);
  const resolvedChild = resolve(child);
  const relativePath = relative(resolvedRoot, resolvedChild);
  if (relativePath.startsWith('..') || relativePath === '..' || relativePath.startsWith(sep)) {
    throw new Error(`artifact path escapes artifact root: ${resolvedChild}`);
  }
  if (relativePath === '') return;

  let current = resolvedRoot;
  for (const part of relativePath.split(sep)) {
    if (part.length === 0) continue;
    current = join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new Error(`artifact path contains symlink: ${current}`);
    }
  }
}

function safeWriteBoundaryForSource(
  source: ArtifactRootSource
): ScopedArtifactRootPolicy['safeWriteBoundary'] {
  switch (source) {
    case 'env:ARTIFACTS_DIR':
      return '$ARTIFACTS_DIR';
    case 'workflow:run-artifacts':
      return 'workflow-run-artifacts';
    case 'default:codex-hooks-preflight':
      return 'codex-hooks-preflight';
    case 'explicit:artifact-root':
      return 'explicit-artifact-root';
    case 'cwd:.archon/artifacts':
      return '.archon/artifacts';
  }
}

function isPathInsideOrEqual(root: string, child: string): boolean {
  const relativePath = relative(resolve(root), resolve(child));
  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') && relativePath !== '..' && !relativePath.startsWith(sep))
  );
}
