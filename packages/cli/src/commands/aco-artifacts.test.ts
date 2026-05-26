import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeAcoDossier } from './aco-artifacts';

const originalArtifactsDir = process.env.ARTIFACTS_DIR;
const tempRoots: string[] = [];

afterEach(() => {
  if (originalArtifactsDir === undefined) {
    delete process.env.ARTIFACTS_DIR;
  } else {
    process.env.ARTIFACTS_DIR = originalArtifactsDir;
  }
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('ACO artifact root policy', () => {
  test('rejects lexical path escape attempts', () => {
    const root = makeTempRoot();
    process.env.ARTIFACTS_DIR = root;

    expect(() =>
      writeAcoDossier({
        cwd: root,
        runId: '../escape',
        commandId: 'archon.context.compile',
        artifacts: [{ name: 'context.md', content: 'safe content' }],
      })
    ).toThrow(/invalid artifact name/);
  });

  test('rejects ambiguous artifact path segments', () => {
    const root = makeTempRoot();
    process.env.ARTIFACTS_DIR = root;

    for (const name of ['artifacts//context.md', 'artifacts/./context.md']) {
      expect(() =>
        writeAcoDossier({
          cwd: root,
          runId: 'run-1',
          commandId: 'archon.context.compile',
          artifacts: [{ name, content: 'safe content' }],
        })
      ).toThrow(/invalid artifact name/);
    }
  });

  test('writes manifest, evidence, policy, handoff, party notes, and archive', () => {
    const root = makeTempRoot();
    process.env.ARTIFACTS_DIR = root;

    const result = writeAcoDossier({
      cwd: root,
      runId: 'run-1',
      commandId: 'archon.context.compile',
      evidence: [
        {
          id: 'evidence.test',
          source: 'test',
          summary: 'test evidence',
          confidence: 'high',
          freshness: 'fresh',
        },
      ],
      artifacts: [{ name: 'context.md', content: 'safe content' }],
    });

    expect(result.files.some(path => path.endsWith('/context.md'))).toBe(true);
    expect(result.files.some(path => path.endsWith('/artifact-policy.json'))).toBe(true);
    expect(result.files.some(path => path.endsWith('/evidence.json'))).toBe(true);
    expect(result.files.some(path => path.endsWith('/next_goal_4000chars.txt'))).toBe(true);
    expect(result.files.some(path => path.endsWith('/party-mode-notes.md'))).toBe(true);
    expect(result.files.some(path => path.endsWith('/bad-behaviour-lint.json'))).toBe(true);
    expect(result.files.some(path => path.endsWith('/run-1.zip'))).toBe(true);
    expect(result.files.some(path => path.endsWith('/archive-checksum.json'))).toBe(true);
    expect(result.manifestPath.endsWith('/manifest.json')).toBe(true);
    expect(result.zipPath.endsWith('/run-1.zip')).toBe(true);
    expect(result.archiveChecksumPath.endsWith('/archive-checksum.json')).toBe(true);

    const evidence = JSON.parse(readFileSync(join(result.directory, 'evidence.json'), 'utf8')) as {
      evidence?: unknown[];
    };
    expect(evidence.evidence?.length).toBe(1);

    const badBehaviourLint = JSON.parse(
      readFileSync(join(result.directory, 'bad-behaviour-lint.json'), 'utf8')
    ) as {
      kind?: string;
      summary?: { total?: number };
    };
    expect(badBehaviourLint.kind).toBe('aco-bad-behaviour-lint');
    expect(badBehaviourLint.summary?.total).toBe(0);

    const nextGoal = readFileSync(join(result.directory, 'next_goal_4000chars.txt'), 'utf8');
    expect(nextGoal).toContain('archive checksum sidecar');
    expect(nextGoal).toContain('dropped, stripped, bypassed');
    expect(nextGoal).toContain('unavailable, unobservable, not-streamed');
    expect(nextGoal).toContain('intentional fail-closed enforcement');

    const partyNotes = readFileSync(join(result.directory, 'party-mode-notes.md'), 'utf8');
    expect(partyNotes).toContain('manifest.badBehaviourLintSummary.byPattern');
    expect(partyNotes).toContain('manifest.archiveVerification');
    expect(partyNotes).toContain('fail-closed enforcement');

    const manifest = JSON.parse(readFileSync(result.manifestPath, 'utf8')) as {
      files?: { relativePath?: string; digestStatus?: string; includedInArchive?: boolean }[];
      requiredArtifacts?: {
        archive?: { digestStatus?: string };
        archiveChecksum?: {
          digestStatus?: string;
          relativePath?: string;
          includedInArchive?: boolean;
        };
        manifest?: { digestStatus?: string };
      };
    };
    const manifestFileEntry = manifest.files?.find(entry => entry.relativePath === 'manifest.json');
    const archiveFileEntry = manifest.files?.find(entry => entry.relativePath === 'run-1.zip');
    const checksumFileEntry = manifest.files?.find(
      entry => entry.relativePath === 'archive-checksum.json'
    );
    expect(manifestFileEntry?.digestStatus).toContain('self-referential');
    expect(archiveFileEntry?.digestStatus).toContain('generated after manifest.json');
    expect(checksumFileEntry?.digestStatus).toContain('generated after the archive');
    expect(checksumFileEntry?.includedInArchive).toBe(false);
    expect(manifest.requiredArtifacts?.manifest?.digestStatus).toContain('included in the archive');
    expect(manifest.requiredArtifacts?.archive?.digestStatus).toContain(
      'generated after manifest.json'
    );
    expect(manifest.requiredArtifacts?.archiveChecksum?.relativePath).toBe('archive-checksum.json');
    expect(manifest.requiredArtifacts?.archiveChecksum?.includedInArchive).toBe(false);

    const checksum = JSON.parse(readFileSync(result.archiveChecksumPath, 'utf8')) as {
      kind?: string;
      archiveRelativePath?: string;
      sha256?: string;
      bytes?: number;
    };
    expect(checksum.kind).toBe('aco-dossier-archive-checksum');
    expect(checksum.archiveRelativePath).toBe('run-1.zip');
    expect(checksum.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(checksum.bytes).toBeGreaterThan(0);

    const zipEntries = listZipEntryNames(result.zipPath);
    expect(zipEntries).toContain('context.md');
    expect(zipEntries).toContain('artifact-policy.json');
    expect(zipEntries).toContain('evidence.json');
    expect(zipEntries).toContain('next_goal_4000chars.txt');
    expect(zipEntries).toContain('party-mode-notes.md');
    expect(zipEntries).toContain('bad-behaviour-lint.json');
    expect(zipEntries).toContain('manifest.json');
  });

  test('writes standalone bad-behaviour lint with classifications', () => {
    const root = makeTempRoot();
    process.env.ARTIFACTS_DIR = root;

    const result = writeAcoDossier({
      cwd: root,
      runId: 'run-lint',
      commandId: 'archon.context.compile',
      artifacts: [{ name: 'context.md', content: 'safe content' }],
      extra: {
        badBehaviourLint: [
          {
            pattern: 'ignored_behavior',
            classification: 'bug',
            rationale: 'Ignored controls must fail closed.',
          },
          {
            pattern: 'writes_artifacts_scoped',
            classification: 'intentional',
            rationale: 'Artifact writes are scoped.',
          },
        ],
      },
    });

    const badBehaviourLint = JSON.parse(
      readFileSync(join(result.directory, 'bad-behaviour-lint.json'), 'utf8')
    ) as {
      summary?: {
        total?: number;
        byClassification?: Record<string, number>;
        byPattern?: Record<string, number>;
        findings?: { pattern?: string; classification?: string }[];
      };
    };
    expect(badBehaviourLint.summary?.total).toBe(3);
    expect(badBehaviourLint.summary?.byClassification?.bug).toBe(1);
    expect(badBehaviourLint.summary?.byClassification?.intentional).toBe(2);
    expect(badBehaviourLint.summary?.byPattern?.ignored_behavior).toBe(1);
    expect(badBehaviourLint.summary?.byPattern?.writes_artifacts_scoped).toBe(1);
    expect(badBehaviourLint.summary?.byPattern?.denied_before_write).toBe(1);
    expect(badBehaviourLint.summary?.findings?.map(finding => finding.pattern)).toContain(
      'ignored_behavior'
    );

    const manifest = JSON.parse(readFileSync(result.manifestPath, 'utf8')) as {
      requiredArtifacts?: { badBehaviourLint?: { relativePath?: string } };
      badBehaviourLintSummary?: { total?: number; byPattern?: Record<string, number> };
    };
    expect(manifest.requiredArtifacts?.badBehaviourLint?.relativePath).toBe(
      'bad-behaviour-lint.json'
    );
    expect(manifest.badBehaviourLintSummary?.total).toBe(3);
    expect(manifest.badBehaviourLintSummary?.byPattern?.ignored_behavior).toBe(1);
    expect(manifest.badBehaviourLintSummary?.byPattern?.denied_before_write).toBe(1);
  });

  test('rejects symlinked dossier directories', () => {
    const root = makeTempRoot();
    const outside = makeTempRoot();
    process.env.ARTIFACTS_DIR = root;
    symlinkSync(outside, join(root, 'run-1'));

    expect(() =>
      writeAcoDossier({
        cwd: root,
        runId: 'run-1',
        commandId: 'archon.context.compile',
        artifacts: [{ name: 'context.md', content: 'safe content' }],
      })
    ).toThrow(/symlink/);
  });

  test('rejects symlinked artifact file targets', () => {
    const root = makeTempRoot();
    const outside = makeTempRoot();
    process.env.ARTIFACTS_DIR = root;
    mkdirSync(join(root, 'run-1'), { recursive: true });
    writeFileSync(join(outside, 'target.md'), 'outside', 'utf8');
    symlinkSync(join(outside, 'target.md'), join(root, 'run-1', 'context.md'));

    expect(() =>
      writeAcoDossier({
        cwd: root,
        runId: 'run-1',
        commandId: 'archon.context.compile',
        artifacts: [{ name: 'context.md', content: 'safe content' }],
      })
    ).toThrow(/symlink/);
  });

  test('rejects symlinked intermediate artifact directories', () => {
    const root = makeTempRoot();
    const outside = makeTempRoot();
    process.env.ARTIFACTS_DIR = root;
    mkdirSync(join(root, 'run-1'), { recursive: true });
    symlinkSync(outside, join(root, 'run-1', 'nested'));

    expect(() =>
      writeAcoDossier({
        cwd: root,
        runId: 'run-1',
        commandId: 'archon.context.compile',
        artifacts: [{ name: 'nested/context.md', content: 'safe content' }],
      })
    ).toThrow(/symlink/);
  });
});

function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'archon-aco-artifacts-'));
  tempRoots.push(root);
  return root;
}

function listZipEntryNames(zipPath: string): string[] {
  const buffer = readFileSync(zipPath);
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65557); index -= 1) {
    if (buffer.readUInt32LE(index) === eocdSignature) {
      eocdOffset = index;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error(`ZIP end-of-central-directory not found: ${zipPath}`);

  const entries = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  const names: string[] = [];

  for (let index = 0; index < entries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`ZIP central-directory entry not found at offset ${offset}: ${zipPath}`);
    }
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    names.push(buffer.subarray(nameStart, nameStart + nameLength).toString('utf8'));
    offset = nameStart + nameLength + extraLength + commentLength;
  }

  return names;
}
