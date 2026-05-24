import { constants } from 'fs';
import { lstat, mkdir, open, realpath } from 'fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'path';

const sensitiveKey =
  '[A-Za-z0-9_.-]*(?:token|secret|password|passwd|pwd|api[-_]?key|apikey|access[-_]?key|accesskey|private[-_]?key|privatekey|client[-_]?secret|clientsecret|auth[-_]?token|authtoken)[A-Za-z0-9_.-]*';
const secretAssignmentPattern = new RegExp(
  '\\b(' + sensitiveKey + ')=(?!\\[REDACTED\\])([^\\s\'"`]+)',
  'gi'
);
const secretColonPattern = new RegExp(
  `(["']?)(${sensitiveKey})\\1\\s*:\\s*(["'])(?!\\[REDACTED\\])([^"'\\n\\r]+)\\3`,
  'gi'
);
const unquotedSecretColonPattern = new RegExp(
  `\\b(${sensitiveKey})\\s*:\\s*(?!\\[REDACTED\\])([^\\s,.;]+)`,
  'gi'
);
const yamlSecretPattern = new RegExp(
  `(^|\\n)(\\s*)(${sensitiveKey})\\s*:\\s*(?!\\[REDACTED\\])([^#\\n\\r]+)`,
  'gi'
);
const bearerPattern = /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}/g;
const openAiKeyPattern = /\bsk-[A-Za-z0-9_-]{10,}/g;
const githubTokenPattern = /\bghp_[A-Za-z0-9_]{10,}/g;
const npmTokenPattern = /\bnpm_[A-Za-z0-9_]{10,}/g;
const awsAccessKeyPattern = /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g;
const urlCredentialPattern = /\b([a-z][a-z0-9+.-]*:\/\/)([^/\s:@]+):([^@\s/]+)@/gi;
const privateKeyPattern =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
const safeRunIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function redactSecrets(input: string): string {
  return input
    .replace(secretAssignmentPattern, '$1=[REDACTED]')
    .replace(secretColonPattern, '$1$2$1: $3[REDACTED]$3')
    .replace(unquotedSecretColonPattern, '$1: [REDACTED]')
    .replace(yamlSecretPattern, '$1$2$3: [REDACTED]')
    .replace(bearerPattern, '$1[REDACTED]')
    .replace(openAiKeyPattern, '[REDACTED]')
    .replace(githubTokenPattern, '[REDACTED]')
    .replace(npmTokenPattern, '[REDACTED]')
    .replace(awsAccessKeyPattern, '[REDACTED]')
    .replace(urlCredentialPattern, '$1[REDACTED]@')
    .replace(privateKeyPattern, '[REDACTED PRIVATE KEY]');
}

export function containsSecretLikeValue(input: string): boolean {
  return redactSecrets(input) !== input;
}

export function assertNoSecretLikeValue(input: string, label: string): void {
  if (containsSecretLikeValue(input)) {
    throw new Error(`Refusing to write unredacted secret-like value in ${label}`);
  }
}

export function validateSafeRunId(runId: string): string {
  if (
    runId === '.' ||
    runId === '..' ||
    isAbsolute(runId) ||
    runId.includes('/') ||
    runId.includes('\\') ||
    !safeRunIdPattern.test(runId)
  ) {
    throw new Error(`Invalid ACO archive runId: ${runId}`);
  }
  return runId;
}

export function isPathInside(root: string, candidate: string): boolean {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  const pathFromRoot = relative(resolvedRoot, resolvedCandidate);
  return pathFromRoot === '' || (!pathFromRoot.startsWith('..') && !isAbsolute(pathFromRoot));
}

export function assertPathInside(root: string, candidate: string): void {
  if (!isPathInside(root, candidate)) {
    throw new Error(`Archive path escapes root: ${candidate}`);
  }
}

export async function assertRealPathInside(root: string, candidate: string): Promise<void> {
  const realRoot = await realpath(root);
  const realCandidate = await realpath(candidate);
  if (!isPathInside(realRoot, realCandidate)) {
    throw new Error(`Archive real path escapes root: ${candidate}`);
  }
}

export async function prepareArchiveDirectory(archiveRoot: string, runId: string): Promise<string> {
  const safeRunId = validateSafeRunId(runId);
  const resolvedRoot = resolve(archiveRoot);
  await mkdir(resolvedRoot, { recursive: true });
  await assertDirectoryIsNotSymlink(resolvedRoot, 'Archive root');

  const archivePath = resolve(resolvedRoot, safeRunId);
  assertPathInside(resolvedRoot, archivePath);
  await mkdir(archivePath, { recursive: true });
  await assertDirectoryIsNotSymlink(archivePath, 'Archive path');
  await assertRealPathInside(resolvedRoot, archivePath);
  return archivePath;
}

export async function writeFileNoFollow(
  archivePath: string,
  filePath: string,
  contents: string
): Promise<void> {
  assertPathInside(archivePath, filePath);
  await assertRealParentPathInside(archivePath, filePath);
  assertNoSecretLikeValue(contents, filePath);
  await assertFileIsNotSymlink(filePath);

  const flags =
    constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | (constants.O_NOFOLLOW ?? 0);
  const handle = await open(filePath, flags, 0o600);
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) {
      throw new Error(`Archive path is not a regular file: ${filePath}`);
    }
    await handle.writeFile(contents);
  } finally {
    await handle.close();
  }
}

async function assertDirectoryIsNotSymlink(path: string, label: string): Promise<void> {
  const stats = await lstat(path);
  if (stats.isSymbolicLink()) {
    throw new Error(`${label} must not be a symbolic link: ${path}`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`${label} must be a directory: ${path}`);
  }
}

async function assertFileIsNotSymlink(filePath: string): Promise<void> {
  try {
    const stats = await lstat(filePath);
    if (stats.isSymbolicLink()) {
      throw new Error(`Archive file must not be a symbolic link: ${filePath}`);
    }
    if (!stats.isFile()) {
      throw new Error(`Archive path is not a regular file: ${filePath}`);
    }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
}

async function assertRealParentPathInside(root: string, candidate: string): Promise<void> {
  const parent = dirname(candidate);
  await assertRealPathInside(root, parent);
}
