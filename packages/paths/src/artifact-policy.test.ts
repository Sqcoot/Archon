import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  ensureScopedWritableFilePath,
  resolveScopedArtifactRoot,
  scopedArtifactPath,
} from './artifact-policy';

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('resolveScopedArtifactRoot', () => {
  test('anchors relative artifact roots to the supplied cwd', () => {
    const processRoot = makeTempRoot();
    const workflowCwd = makeTempRoot();
    const originalCwd = process.cwd();

    try {
      process.chdir(processRoot);
      const policy = resolveScopedArtifactRoot({
        cwd: workflowCwd,
        artifactsDir: '.archon/artifacts/run-1',
        source: 'workflow:run-artifacts',
      });

      expect(policy.requestedRoot).toBe(join(workflowCwd, '.archon', 'artifacts', 'run-1'));
      expect(policy.artifactRoot).toBe(
        realpathSync(join(workflowCwd, '.archon', 'artifacts', 'run-1'))
      );
      expect(policy.scopedRunArtifact).toBe(true);
      expect(policy.checkoutMutation).toBe(false);
      expect(policy.safeWriteBoundary).toBe('workflow-run-artifacts');
      expect(policy.symlinkPolicy.relativeRootComponentsMustNotBeSymlinks).toBe(true);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('keeps scoped paths inside the resolved artifact root', () => {
    const workflowCwd = makeTempRoot();
    const policy = resolveScopedArtifactRoot({
      cwd: workflowCwd,
      artifactsDir: '.archon/artifacts/run-1',
    });

    expect(scopedArtifactPath(policy.artifactRoot, 'manifest.json')).toBe(
      join(policy.artifactRoot, 'manifest.json')
    );
    expect(() => scopedArtifactPath(policy.artifactRoot, '../escape.txt')).toThrow(
      /escapes artifact root/
    );
  });

  test('rejects default artifact roots that traverse repo-local symlink components', () => {
    const workflowCwd = makeTempRoot();
    const escapedTarget = makeTempRoot();
    symlinkSync(escapedTarget, join(workflowCwd, '.archon'), 'dir');

    expect(() =>
      resolveScopedArtifactRoot({
        cwd: workflowCwd,
      })
    ).toThrow(/artifact path contains symlink/);
  });

  test('rejects writable artifact paths that traverse symlink components', () => {
    const workflowCwd = makeTempRoot();
    const escapedTarget = makeTempRoot();
    const policy = resolveScopedArtifactRoot({
      cwd: workflowCwd,
      artifactsDir: '.archon/artifacts/run-1',
    });
    mkdirSync(join(policy.artifactRoot, 'safe'), { recursive: true });
    symlinkSync(escapedTarget, join(policy.artifactRoot, 'safe', 'escape'), 'dir');

    expect(() =>
      ensureScopedWritableFilePath(
        policy.artifactRoot,
        join(policy.artifactRoot, 'safe', 'escape', 'manifest.json')
      )
    ).toThrow(/artifact path contains symlink/);
  });
});

function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'archon-paths-artifacts-'));
  tempRoots.push(root);
  return root;
}
