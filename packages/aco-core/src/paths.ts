import type { AcoPathFor, AcoPathKind, ArtifactPath, BrandedPath, ParseResult } from './contracts';

const windowsAbsolutePathPattern = /^[A-Za-z]:[\\/]/;

export function parseAcoPath<TKind extends AcoPathKind>(
  kind: TKind,
  input: unknown
): ParseResult<BrandedPath<TKind>> {
  const pathResult = parseAbsolutePath(input);
  if (!pathResult.ok) return pathResult;

  return {
    ok: true,
    value: {
      kind,
      value: pathResult.value as AcoPathFor<TKind>,
    },
  };
}

export function parseArtifactPath(input: unknown): ParseResult<ArtifactPath> {
  const pathResult = parseAbsolutePath(input);
  if (!pathResult.ok) return pathResult;
  return { ok: true, value: pathResult.value as ArtifactPath };
}

function parseAbsolutePath(input: unknown): ParseResult<string> {
  if (typeof input !== 'string') {
    return { ok: false, issues: ['path must be a string'] };
  }

  const trimmed = input.trim();
  const issues: string[] = [];

  if (trimmed.length === 0) {
    issues.push('path must not be empty');
  }
  if (trimmed.includes('\0')) {
    issues.push('path must not contain null bytes');
  }
  if (!trimmed.startsWith('/') && !windowsAbsolutePathPattern.test(trimmed)) {
    issues.push('path must be absolute');
  }
  if (trimmed.split(/[\\/]+/).includes('..')) {
    issues.push('path must not contain parent traversal segments');
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, value: trimmed };
}
