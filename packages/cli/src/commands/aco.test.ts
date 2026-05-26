import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { readFileSync } from 'fs';
import {
  acoCommand,
  lintAcoArtifactContentForBadBehaviour,
  resolveAcoCommandInvocation,
} from './aco';

const CONTEXT_PROMPT_ARGS = ['Implement', 'S8', 'context', 'contracts'] as const;

describe('ACO CLI adapter', () => {
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('renders a stable JSON status envelope from the contract package', async () => {
    const exitCode = await acoCommand('/repo', ['aco', 'status'], {
      json: true,
      noWriteArtifact: true,
    });

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]?.[0]).toBe(
      (await loadGolden('cli-aco-status-json.expected.txt')).trimEnd()
    );
  });

  test('renders ledger command help as representative stdout golden', async () => {
    const exitCode = await acoCommand('/repo', ['context', 'ledgers']);

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls[0]?.[0]).toBe(
      (await loadGolden('cli-context-ledgers-stdout.expected.md')).trimEnd()
    );
  });

  test('classifies required bad-behaviour patterns', () => {
    const lint = lintAcoArtifactContentForBadBehaviour([
      {
        name: 'audit.md',
        content:
          'This no-op control is warning-only and fail-open. Unsupported safety controls are rejected fail-closed. Advisory model controls were accepted. It is best effort with degraded event persistence and not-implemented. Run-scoped approval is unimplemented. Hook trust is unobservable. Hook event streaming is not available and hook lifecycle events are not streamed. A hook will skip an ignored guard and a PermissionRequest guard can be bypassed after denied before write. Schema stripping dropped a safety control. Unsupported controls were silently accepted, including unsupported sandbox, output_format, allowed_tools, and approval-policy controls.',
      },
    ]);

    expect(Array.isArray(lint)).toBe(true);
    const patterns = (lint as { pattern?: string; classification?: string }[]).map(item => [
      item.pattern,
      item.classification,
    ]);
    expect(patterns).toContainEqual(['noop_behavior', 'bug']);
    expect(patterns).toContainEqual(['warning_only_control', 'bug']);
    expect(patterns).toContainEqual(['fail_open_behavior', 'bug']);
    expect(patterns).toContainEqual(['fail_closed_enforcement', 'intentional']);
    expect(patterns).toContainEqual(['best_effort_surface', 'warning-only']);
    expect(patterns).toContainEqual(['deferred_behavior', 'warning-only']);
    expect(patterns).toContainEqual(['ignored_control', 'bug']);
    expect(patterns).toContainEqual(['unsupported_control', 'bug']);
    expect(patterns).toContainEqual(['unsupported_ignored', 'warning-only']);
    expect(patterns).toContainEqual(['silent_behavior', 'warning-only']);
    expect(patterns).toContainEqual(['denied_before_write', 'intentional']);
  });

  test('renders S8 context status, package, capsule, and verification fixtures', async () => {
    const cases = [
      {
        argv: ['context', 'status', ...CONTEXT_PROMPT_ARGS],
        golden: 'status.expected.md',
      },
      {
        argv: ['context', 'compile', ...CONTEXT_PROMPT_ARGS],
        golden: 'context-package.expected.md',
      },
      {
        argv: ['context', 'approval-capsule', ...CONTEXT_PROMPT_ARGS],
        golden: 'approval-capsule.expected.md',
      },
      {
        argv: ['context', 'approval-capsule-verify'],
        golden: 'approval-capsule-verification-pass.expected.md',
      },
    ] as const;

    for (const item of cases) {
      const exitCode = await acoCommand('/repo', item.argv, { noWriteArtifact: true });
      expect(exitCode).toBe(0);
    }

    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(cases.length);
    for (const [index, item] of cases.entries()) {
      expect(logSpy.mock.calls[index]?.[0]).toBe((await loadContextGolden(item.golden)).trimEnd());
    }
  });

  test('writes context artifact dossiers by default as scoped artifact mutations', async () => {
    const exitCode = await acoCommand('/repo', ['context', 'compile', 'build', 'bundle'], {
      noWriteArtifact: false,
    });

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('ACO dossier written.');
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('Archive:');
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('Archive checksum:');
  });

  test('writes ACO status dossier artifacts by default', async () => {
    const exitCode = await acoCommand('/repo', ['aco', 'status']);

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('ACO dossier written.');
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('Archive:');
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('Archive checksum:');
  });

  test('writes scoped bootstrap dossier artifacts by default', async () => {
    const exitCode = await acoCommand('/repo', ['aco', 'bootstrap-codex'], {
      event: 'SessionStart',
      format: 'markdown',
    });

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('ACO dossier written.');
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('Archive:');
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('Archive checksum:');
  });

  test('includes archive checksum path in JSON dossier metadata', async () => {
    const exitCode = await acoCommand('/repo', ['aco', 'bootstrap-codex'], {
      event: 'SessionStart',
      json: true,
    });

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    const output = String(logSpy.mock.calls[0]?.[0]);
    expect(output).toContain('"archiveChecksumPath"');
    expect(output).toContain('"evidencePath"');
    expect(output).toContain('"nextGoal4000CharsPath"');
    expect(output).toContain('"partyModeNotesPath"');
    expect(output).toContain('"badBehaviourLintPath"');
    expect(output).toContain('"requiredArtifactPaths"');
    expect(output).not.toContain('ACO dossier written.');
  });

  test('marks archive self-reference as outside the archive in dossier manifest', async () => {
    const exitCode = await acoCommand('/repo', ['aco', 'bootstrap-codex'], {
      event: 'SessionStart',
      json: true,
    });

    expect(exitCode).toBe(0);
    const output = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      dossier: { manifestPath: string; archiveChecksumPath: string };
    };
    const manifest = JSON.parse(readFileSync(output.dossier.manifestPath, 'utf8')) as {
      archiveVerification?: {
        checksumRelativePath?: string;
        checksumIncludedInArchive?: boolean;
        digestSource?: string;
      };
      requiredArtifacts: {
        artifactPolicy: { includedInArchive?: boolean };
        evidence: { includedInArchive?: boolean };
        nextGoal4000Chars: { includedInArchive?: boolean };
        partyModeNotes: { includedInArchive?: boolean };
        badBehaviourLint: { includedInArchive?: boolean };
        manifest: { includedInArchive?: boolean };
        archive: { includedInArchive?: boolean };
        archiveChecksum: { includedInArchive?: boolean };
      };
      requiredArtifactPaths?: {
        evidence?: string;
        nextGoal4000Chars?: string;
        partyModeNotes?: string;
        badBehaviourLint?: string;
      };
      badBehaviourLintSummary?: {
        byPattern?: Record<string, number>;
      };
      files: Array<{ role?: string; includedInArchive?: boolean }>;
      commandArtifacts: Array<{ includedInArchive?: boolean }>;
    };
    const archiveChecksum = JSON.parse(
      readFileSync(output.dossier.archiveChecksumPath, 'utf8')
    ) as {
      archiveEntryCount?: number;
      archiveEntries?: Array<{ name?: string; bytes?: number; sha256?: string }>;
    };
    expect(manifest.requiredArtifacts.artifactPolicy.includedInArchive).toBe(true);
    expect(manifest.requiredArtifacts.evidence.includedInArchive).toBe(true);
    expect(manifest.requiredArtifacts.nextGoal4000Chars.includedInArchive).toBe(true);
    expect(manifest.requiredArtifacts.partyModeNotes.includedInArchive).toBe(true);
    expect(manifest.requiredArtifacts.badBehaviourLint.includedInArchive).toBe(true);
    expect(manifest.requiredArtifacts.manifest.includedInArchive).toBe(true);
    expect(manifest.requiredArtifacts.archive.includedInArchive).toBe(false);
    expect(manifest.requiredArtifacts.archiveChecksum.includedInArchive).toBe(false);
    expect(manifest.requiredArtifactPaths?.evidence).toContain('evidence.json');
    expect(manifest.requiredArtifactPaths?.nextGoal4000Chars).toContain('next_goal_4000chars.txt');
    expect(manifest.requiredArtifactPaths?.partyModeNotes).toContain('party-mode-notes.md');
    expect(manifest.requiredArtifactPaths?.badBehaviourLint).toContain('bad-behaviour-lint.json');
    expect(manifest.archiveVerification).toMatchObject({
      checksumRelativePath: 'archive-checksum.json',
      checksumIncludedInArchive: false,
      digestSource: 'archive-checksum.json',
    });
    expect(manifest.badBehaviourLintSummary?.byPattern).toEqual(
      expect.objectContaining({
        denied_before_write: expect.any(Number),
        writes_artifacts_scoped: expect.any(Number),
      })
    );
    expect(manifest.commandArtifacts.every(artifact => artifact.includedInArchive === true)).toBe(
      true
    );
    expect(
      manifest.files.find(file => file.role === 'manifest-self-reference')?.includedInArchive
    ).toBe(true);
    expect(
      manifest.files.find(file => file.role === 'archive-self-reference')?.includedInArchive
    ).toBe(false);
    const archivedNames = new Set(archiveChecksum.archiveEntries?.map(entry => entry.name));
    expect(archiveChecksum.archiveEntryCount).toBe(archiveChecksum.archiveEntries?.length);
    expect(archivedNames.has('artifact-policy.json')).toBe(true);
    expect(archivedNames.has('evidence.json')).toBe(true);
    expect(archivedNames.has('next_goal_4000chars.txt')).toBe(true);
    expect(archivedNames.has('party-mode-notes.md')).toBe(true);
    expect(archivedNames.has('bad-behaviour-lint.json')).toBe(true);
    expect(archivedNames.has('manifest.json')).toBe(true);
    expect(archivedNames.has('archive-checksum.json')).toBe(false);
    expect(archiveChecksum.archiveEntries?.every(entry => typeof entry.sha256 === 'string')).toBe(
      true
    );
  });

  test('can suppress default scoped bootstrap dossier artifacts', async () => {
    const exitCode = await acoCommand('/repo', ['aco', 'bootstrap-codex'], {
      event: 'SessionStart',
      format: 'markdown',
      noWriteArtifact: true,
    });

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(String(logSpy.mock.calls[0]?.[0])).not.toContain('ACO dossier written.');
  });

  test('classifies no-write artifact-capable invocations as read-only', () => {
    const bootstrap = resolveAcoCommandInvocation('/repo', ['aco', 'bootstrap-codex'], {
      event: 'SessionStart',
      noWriteArtifact: true,
    });
    const statusCommand = resolveAcoCommandInvocation('/repo', ['aco', 'status'], {
      noWriteArtifact: true,
    });
    const compile = resolveAcoCommandInvocation('/repo', ['context', 'compile', 'next slice'], {
      noWriteArtifact: true,
    });
    const status = resolveAcoCommandInvocation('/repo', ['context', 'status', 'next slice'], {
      noWriteArtifact: true,
    });
    const ledgers = resolveAcoCommandInvocation('/repo', ['context', 'ledgers', 'next slice'], {
      noWriteArtifact: true,
    });
    const route = resolveAcoCommandInvocation('/repo', ['context', 'route', 'next slice'], {
      noWriteArtifact: true,
    });
    const graphWaivers = resolveAcoCommandInvocation('/repo', ['context', 'graph-waivers'], {
      noWriteArtifact: true,
    });
    const validate = resolveAcoCommandInvocation('/repo', ['context', 'validate'], {
      noWriteArtifact: true,
    });

    expect(bootstrap.ok && bootstrap.invocation.requestedMutations).toEqual(['read-only']);
    expect(statusCommand.ok && statusCommand.invocation.requestedMutations).toEqual(['read-only']);
    expect(compile.ok && compile.invocation.requestedMutations).toEqual(['read-only']);
    expect(status.ok && status.invocation.requestedMutations).toEqual(['read-only']);
    expect(ledgers.ok && ledgers.invocation.requestedMutations).toEqual(['read-only']);
    expect(route.ok && route.invocation.requestedMutations).toEqual(['read-only']);
    expect(graphWaivers.ok && graphWaivers.invocation.requestedMutations).toEqual(['read-only']);
    expect(validate.ok && validate.invocation.requestedMutations).toEqual(['read-only']);
  });

  test('classifies artifact-capable invocations as scoped artifact writes by default', () => {
    const bootstrap = resolveAcoCommandInvocation('/repo', ['aco', 'bootstrap-codex'], {
      event: 'SessionStart',
    });
    const statusCommand = resolveAcoCommandInvocation('/repo', ['aco', 'status']);
    const compile = resolveAcoCommandInvocation('/repo', ['context', 'compile', 'next slice']);
    const approvalCapsule = resolveAcoCommandInvocation('/repo', [
      'context',
      'approval-capsule',
      'next slice',
    ]);
    const approvalCapsuleVerify = resolveAcoCommandInvocation('/repo', [
      'context',
      'approval-capsule-verify',
    ]);
    const status = resolveAcoCommandInvocation('/repo', ['context', 'status', 'next slice']);
    const ledgers = resolveAcoCommandInvocation('/repo', ['context', 'ledgers', 'next slice']);
    const route = resolveAcoCommandInvocation('/repo', ['context', 'route', 'next slice']);
    const graphWaivers = resolveAcoCommandInvocation('/repo', ['context', 'graph-waivers']);
    const validate = resolveAcoCommandInvocation('/repo', ['context', 'validate']);

    expect(bootstrap.ok && bootstrap.invocation.requestedMutations).toEqual(['writes-artifacts']);
    expect(statusCommand.ok && statusCommand.invocation.requestedMutations).toEqual([
      'writes-artifacts',
    ]);
    expect(compile.ok && compile.invocation.requestedMutations).toEqual(['writes-artifacts']);
    expect(approvalCapsule.ok && approvalCapsule.invocation.requestedMutations).toEqual([
      'writes-artifacts',
    ]);
    expect(approvalCapsuleVerify.ok && approvalCapsuleVerify.invocation.requestedMutations).toEqual(
      ['writes-artifacts']
    );
    expect(status.ok && status.invocation.requestedMutations).toEqual(['writes-artifacts']);
    expect(ledgers.ok && ledgers.invocation.requestedMutations).toEqual(['writes-artifacts']);
    expect(route.ok && route.invocation.requestedMutations).toEqual(['writes-artifacts']);
    expect(graphWaivers.ok && graphWaivers.invocation.requestedMutations).toEqual([
      'writes-artifacts',
    ]);
    expect(validate.ok && validate.invocation.requestedMutations).toEqual(['writes-artifacts']);
  });

  test('maps CLI surfaces to descriptor ids without local command truth', () => {
    const status = resolveAcoCommandInvocation('/repo', ['aco', 'status'], { json: true });
    const route = resolveAcoCommandInvocation('/repo', ['context', 'route', 'next slice']);
    const compile = resolveAcoCommandInvocation('/repo', ['context', 'compile', 'next slice']);

    expect(status.ok && status.invocation.commandId).toBe('archon.aco.status');
    expect(route.ok && route.invocation.commandId).toBe('archon.context.route');
    expect(compile.ok && compile.invocation.commandId).toBe('archon.context.compile');
  });
});

async function loadGolden(fileName: string): Promise<string> {
  const root = new URL('../../../../tests/fixtures/aco/cli-contracts/', import.meta.url);
  return Bun.file(new URL(fileName, root)).text();
}

async function loadContextGolden(fileName: string): Promise<string> {
  const root = new URL('../../../../tests/fixtures/aco/context/', import.meta.url);
  return Bun.file(new URL(fileName, root)).text();
}
