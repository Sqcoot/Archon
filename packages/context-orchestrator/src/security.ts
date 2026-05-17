import { isAbsolute, relative, resolve } from 'path';

const secretAssignmentPattern =
  /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY|PRIVATE_KEY|KEY)[A-Z0-9_]*)=([^\s'"`]+)/g;
const bearerPattern = /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}/g;

export function redactSecrets(input: string): string {
  return input
    .replace(secretAssignmentPattern, '$1=[REDACTED]')
    .replace(bearerPattern, '$1[REDACTED]');
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
