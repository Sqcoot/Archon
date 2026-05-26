import { afterEach, describe, expect, mock, test } from 'bun:test';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const tempRoots: string[] = [];
let artifactRoot = '';

const mockLogger = {
  fatal: mock(() => undefined),
  error: mock(() => undefined),
  warn: mock(() => undefined),
  info: mock(() => undefined),
  debug: mock(() => undefined),
  trace: mock(() => undefined),
  child: mock(() => mockLogger),
};

const mockWorkflowRunCommand = mock(() => Promise.resolve());
const mockFindActiveByBranchName = mock(() =>
  Promise.resolve({
    working_path: '/tmp/archon-continue-worktree',
    codebase_id: 'codebase-1',
  })
);
const mockFindLatestRunByWorkingPath = mock(() =>
  Promise.resolve({
    id: 'run-1',
    workflow_name: 'previous-workflow',
    status: 'completed',
  })
);
const mockGetCodebase = mock(() => Promise.resolve({ name: 'owner/repo' }));
const mockExecFileAsync = mock(() => Promise.resolve({ stdout: '', stderr: '' }));

mock.module('./workflow', () => ({
  workflowRunCommand: mockWorkflowRunCommand,
}));

mock.module('@archon/core/db/isolation-environments', () => ({
  findActiveByBranchName: mockFindActiveByBranchName,
}));

mock.module('@archon/core/db/codebases', () => ({
  getCodebase: mockGetCodebase,
}));

mock.module('@archon/core/db/workflows', () => ({
  findLatestRunByWorkingPath: mockFindLatestRunByWorkingPath,
}));

mock.module('@archon/git', () => ({
  execFileAsync: mockExecFileAsync,
}));

mock.module('@archon/paths', () => ({
  createLogger: mock(() => mockLogger),
  getRunArtifactsPath: mock(() => artifactRoot),
  parseOwnerRepo: mock(() => ({ owner: 'owner', repo: 'repo' })),
}));

const { continueCommand } = await import('./continue');

afterEach(async () => {
  mockWorkflowRunCommand.mockClear();
  mockFindActiveByBranchName.mockClear();
  mockFindLatestRunByWorkingPath.mockClear();
  mockGetCodebase.mockClear();
  mockExecFileAsync.mockClear();
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
  artifactRoot = '';
});

describe('continueCommand', () => {
  test('does not inject symlinked prior-run artifacts into continuation context', async () => {
    const root = await mkdtemp(join(tmpdir(), 'archon-continue-'));
    tempRoots.push(root);
    const worktree = join(root, 'worktree');
    artifactRoot = join(root, 'artifacts');
    const outside = join(root, 'outside.md');
    await mkdir(worktree, { recursive: true });
    await mkdir(artifactRoot, { recursive: true });
    await writeFile(outside, 'SECRET OUTSIDE ARTIFACT', 'utf-8');
    await symlink(outside, join(artifactRoot, 'leak.md'));
    mockFindActiveByBranchName.mockImplementationOnce(() =>
      Promise.resolve({
        working_path: worktree,
        codebase_id: 'codebase-1',
      })
    );

    await continueCommand('feature/safe-artifacts', 'continue safely');

    const enrichedMessage = mockWorkflowRunCommand.mock.calls[0]?.[2];
    expect(enrichedMessage).toContain('continue safely');
    expect(enrichedMessage).toContain('## Prior Context');
    expect(enrichedMessage).not.toContain('SECRET OUTSIDE ARTIFACT');
    expect(enrichedMessage).not.toContain('leak.md');
  });
});
