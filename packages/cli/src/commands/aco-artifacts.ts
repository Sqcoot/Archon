import { existsSync, readFileSync, writeFileSync } from 'fs';
import { relative, sep } from 'path';
import { createHash } from 'crypto';
import {
  type ScopedArtifactRootPolicy,
  ensureScopedArtifactDirectory,
  ensureScopedWritableFilePath,
  resolveScopedArtifactRoot,
  sanitizeArtifactName,
  scopedArtifactPath,
} from '@archon/paths';
import type { EvidenceRef } from '@archon/aco-core';

export interface AcoWritableArtifact {
  readonly name: string;
  readonly content: string;
  readonly mediaType?: string;
  readonly schemaVersion?: string;
}

export interface AcoDossierWriteResult {
  readonly directory: string;
  readonly manifestPath: string;
  readonly zipPath: string;
  readonly archiveChecksumPath: string;
  readonly requiredArtifactPaths: {
    readonly artifactPolicy: string;
    readonly evidence: string;
    readonly nextGoal4000Chars: string;
    readonly partyModeNotes: string;
    readonly badBehaviourLint: string;
    readonly manifest: string;
    readonly archive: string;
    readonly archiveChecksum: string;
  };
  readonly files: readonly string[];
}

type BadBehaviourClassification = 'intentional' | 'warning-only' | 'bug';

interface BadBehaviourLintSummary {
  readonly total: number;
  readonly byClassification: Record<BadBehaviourClassification, number>;
  readonly byPattern: Record<string, number>;
  readonly findings: readonly {
    readonly pattern: string;
    readonly classification: BadBehaviourClassification;
    readonly rationale?: string;
  }[];
}

function buildDossierArtifactPolicy(input: {
  readonly commandId: string;
  readonly runId: string;
  readonly artifactPolicy: ScopedArtifactRootPolicy;
  readonly artifactRoot: string;
  readonly dossierDir: string;
  readonly generatedAt: string;
}): Record<string, unknown> {
  return {
    kind: 'aco-dossier-artifact-policy',
    schemaVersion: 'archon.aco-dossier-artifact-policy.v1',
    commandId: input.commandId,
    runId: input.runId,
    generatedAt: input.generatedAt,
    scopedRunArtifact: true,
    checkoutMutation: false,
    artifactOnlyWrite: true,
    artifactRoot: input.artifactRoot,
    dossierDir: input.dossierDir,
    rootPolicy: input.artifactPolicy,
    invariants: {
      writesMustRemainUnderArtifactRoot: true,
      dossierFilesMustRemainUnderDossierDir: true,
      pathTraversalRejected: true,
      symlinkEscapeRejected: true,
      backslashTraversalRejected: true,
      archiveContainsOnlyDossierRelativeEntries: true,
      artifactWritesDoNotMutateCheckout: true,
    },
  };
}

export function writeAcoDossier(input: {
  readonly cwd: string;
  readonly runId: string;
  readonly commandId: string;
  readonly artifacts: readonly AcoWritableArtifact[];
  readonly evidence?: readonly EvidenceRef[];
  readonly extra?: Record<string, unknown>;
}): AcoDossierWriteResult {
  const artifactPolicy = resolveScopedArtifactRoot({
    cwd: input.cwd,
    artifactsDir: process.env.ARTIFACTS_DIR,
  });
  const artifactRoot = artifactPolicy.artifactRoot;
  const dossierName = sanitizeArtifactName(input.runId);
  const dossierDir = scopedArtifactPath(artifactRoot, dossierName);
  ensureScopedArtifactDirectory(artifactRoot, dossierDir);
  const createdAt = new Date().toISOString();
  const badBehaviourLintSummary = summarizeBadBehaviourLint(input.extra?.badBehaviourLint);

  const writtenFiles: string[] = [];
  const commandArtifactEntries: {
    role: 'command-artifact';
    name: string;
    path: string;
    relativePath: string;
    bytes: number;
    sha256: string;
    mediaType?: string;
    schemaVersion?: string;
    includedInArchive: true;
  }[] = [];
  for (const artifact of input.artifacts) {
    const path = scopedArtifactPath(dossierDir, sanitizeArtifactName(artifact.name));
    writeScopedTextFile(dossierDir, path, artifact.content);
    writtenFiles.push(path);
    commandArtifactEntries.push({
      role: 'command-artifact',
      name: artifact.name,
      path,
      relativePath: relative(dossierDir, path).split(sep).join('/'),
      bytes: Buffer.byteLength(artifact.content),
      sha256: sha256Text(artifact.content),
      ...(artifact.mediaType ? { mediaType: artifact.mediaType } : {}),
      ...(artifact.schemaVersion ? { schemaVersion: artifact.schemaVersion } : {}),
      includedInArchive: true,
    });
  }

  const artifactPolicyPath = scopedArtifactPath(dossierDir, 'artifact-policy.json');
  const dossierArtifactPolicy = buildDossierArtifactPolicy({
    commandId: input.commandId,
    runId: input.runId,
    artifactPolicy,
    artifactRoot,
    dossierDir,
    generatedAt: createdAt,
  });
  writeScopedTextFile(
    dossierDir,
    artifactPolicyPath,
    `${JSON.stringify(dossierArtifactPolicy, null, 2)}\n`
  );
  writtenFiles.push(artifactPolicyPath);

  const evidencePath = scopedArtifactPath(dossierDir, 'evidence.json');
  const dossierEvidence = renderDossierEvidence(
    input.commandId,
    artifactPolicy,
    input.evidence ?? []
  );
  writeScopedTextFile(dossierDir, evidencePath, `${JSON.stringify(dossierEvidence, null, 2)}\n`);
  writtenFiles.push(evidencePath);

  const nextGoalPath = scopedArtifactPath(dossierDir, 'next_goal_4000chars.txt');
  const nextGoal = renderNextGoal(input.commandId);
  writeScopedTextFile(dossierDir, nextGoalPath, nextGoal.content);
  writtenFiles.push(nextGoalPath);

  const notesPath = scopedArtifactPath(dossierDir, 'party-mode-notes.md');
  writeScopedTextFile(dossierDir, notesPath, renderPartyModeNotes());
  writtenFiles.push(notesPath);

  const badBehaviourLintPath = scopedArtifactPath(dossierDir, 'bad-behaviour-lint.json');
  writeScopedTextFile(
    dossierDir,
    badBehaviourLintPath,
    `${JSON.stringify(
      {
        kind: 'aco-bad-behaviour-lint',
        schemaVersion: 'archon.aco-bad-behaviour-lint.v1',
        commandId: input.commandId,
        runId: input.runId,
        generatedAt: createdAt,
        summary: badBehaviourLintSummary,
        raw: input.extra?.badBehaviourLint ?? null,
      },
      null,
      2
    )}\n`
  );
  writtenFiles.push(badBehaviourLintPath);

  const manifestPath = scopedArtifactPath(dossierDir, 'manifest.json');
  const zipPath = scopedArtifactPath(dossierDir, `${dossierName}.zip`);
  const archiveChecksumPath = scopedArtifactPath(dossierDir, 'archive-checksum.json');
  const requiredArtifactPaths = {
    artifactPolicy: artifactPolicyPath,
    evidence: evidencePath,
    nextGoal4000Chars: nextGoalPath,
    partyModeNotes: notesPath,
    badBehaviourLint: badBehaviourLintPath,
    manifest: manifestPath,
    archive: zipPath,
    archiveChecksum: archiveChecksumPath,
  };
  const fileEntries = [
    ...writtenFiles.map(path => fileManifestEntry(dossierDir, path)),
    {
      path: manifestPath,
      relativePath: relative(dossierDir, manifestPath).split(sep).join('/'),
      role: 'manifest-self-reference',
      includedInArchive: true,
      digestStatus:
        'self-referential manifest digest is not recorded inside the manifest; use the archive central directory or external checksum for manifest.json',
    },
    {
      path: zipPath,
      relativePath: relative(dossierDir, zipPath).split(sep).join('/'),
      role: 'archive-self-reference',
      includedInArchive: false,
      digestStatus:
        'archive is generated after manifest.json and cannot contain an in-archive digest of itself; compute an external checksum after write when needed',
    },
    {
      path: archiveChecksumPath,
      relativePath: relative(dossierDir, archiveChecksumPath).split(sep).join('/'),
      role: 'archive-checksum-sidecar',
      includedInArchive: false,
      digestStatus:
        'archive checksum sidecar is generated after the archive and is not included inside the archive',
    },
  ];
  const manifest = {
    kind: 'aco-dossier-manifest',
    schemaVersion: 'archon.aco-dossier.v1',
    commandId: input.commandId,
    runId: input.runId,
    createdAt,
    artifactPolicy,
    dossierArtifactPolicy,
    artifactRoot,
    dossierDir,
    zipPath,
    requiredArtifactPaths,
    archiveVerification: {
      archivePath: zipPath,
      archiveRelativePath: relative(dossierDir, zipPath).split(sep).join('/'),
      checksumPath: archiveChecksumPath,
      checksumRelativePath: relative(dossierDir, archiveChecksumPath).split(sep).join('/'),
      checksumIncludedInArchive: false,
      digestSource: 'archive-checksum.json',
      digestStatus:
        'archive digest and archive entry inventory are generated after manifest.json in the external checksum sidecar',
    },
    requiredArtifacts: {
      artifactPolicy: {
        path: artifactPolicyPath,
        relativePath: relative(dossierDir, artifactPolicyPath).split(sep).join('/'),
        includedInArchive: true,
        ...fileDigestFields(artifactPolicyPath),
      },
      evidence: {
        path: evidencePath,
        relativePath: relative(dossierDir, evidencePath).split(sep).join('/'),
        includedInArchive: true,
        ...fileDigestFields(evidencePath),
      },
      nextGoal4000Chars: {
        path: nextGoalPath,
        relativePath: relative(dossierDir, nextGoalPath).split(sep).join('/'),
        includedInArchive: true,
        maxChars: 4000,
        chars: nextGoal.content.length,
        truncated: nextGoal.truncated,
        ...fileDigestFields(nextGoalPath),
      },
      partyModeNotes: {
        path: notesPath,
        relativePath: relative(dossierDir, notesPath).split(sep).join('/'),
        includedInArchive: true,
        ...fileDigestFields(notesPath),
      },
      badBehaviourLint: {
        path: badBehaviourLintPath,
        relativePath: relative(dossierDir, badBehaviourLintPath).split(sep).join('/'),
        includedInArchive: true,
        ...fileDigestFields(badBehaviourLintPath),
      },
      manifest: {
        path: manifestPath,
        relativePath: relative(dossierDir, manifestPath).split(sep).join('/'),
        includedInArchive: true,
        digestStatus:
          'self-referential manifest digest is not recorded inside the manifest; manifest.json is still included in the archive',
      },
      archive: {
        path: zipPath,
        relativePath: relative(dossierDir, zipPath).split(sep).join('/'),
        includedInArchive: false,
        digestStatus:
          'archive is generated after manifest.json and cannot contain an in-archive digest of itself; compute an external checksum after write when needed',
      },
      archiveChecksum: {
        path: archiveChecksumPath,
        relativePath: relative(dossierDir, archiveChecksumPath).split(sep).join('/'),
        includedInArchive: false,
        digestStatus:
          'archive checksum sidecar is generated after the archive and is intentionally outside the archive',
      },
    },
    commandArtifacts: commandArtifactEntries,
    files: fileEntries,
    badBehaviourLintSummary,
    extra: input.extra ?? {},
  };
  writeScopedTextFile(dossierDir, manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writtenFiles.push(manifestPath);

  ensureScopedWritableFilePath(dossierDir, zipPath);
  const archiveEntries = writtenFiles.map(path => ({
    name: relative(dossierDir, path).split(sep).join('/'),
    content: Buffer.from(readableFileContent(path), 'utf8'),
  }));
  writeZip(archiveEntries, zipPath);
  writtenFiles.push(zipPath);
  writeScopedTextFile(
    dossierDir,
    archiveChecksumPath,
    `${JSON.stringify(
      {
        kind: 'aco-dossier-archive-checksum',
        schemaVersion: 'archon.aco-dossier-archive-checksum.v1',
        commandId: input.commandId,
        runId: input.runId,
        createdAt,
        manifestPath,
        archivePath: zipPath,
        archiveRelativePath: relative(dossierDir, zipPath).split(sep).join('/'),
        archiveEntryCount: archiveEntries.length,
        archiveEntries: archiveEntries.map(entry => ({
          name: entry.name,
          bytes: entry.content.byteLength,
          sha256: createHash('sha256').update(entry.content).digest('hex'),
        })),
        ...fileDigestFields(zipPath),
      },
      null,
      2
    )}\n`
  );
  writtenFiles.push(archiveChecksumPath);

  return {
    directory: dossierDir,
    manifestPath,
    zipPath,
    archiveChecksumPath,
    requiredArtifactPaths,
    files: writtenFiles,
  };
}

function writeScopedTextFile(root: string, path: string, content: string): void {
  ensureScopedWritableFilePath(root, path);
  writeFileSync(path, content, 'utf8');
}

function renderNextGoal(commandId: string): { content: string; truncated: boolean } {
  const handoff = `Objective: continue Archon's aggregate bad-behaviour remediation from the ACO dossier produced by ${commandId}.

The purpose of this handoff is to let another autonomous or party-mode run resume with enough context to keep moving without asking optional questions. Treat the dossier as scoped run evidence, not as an arbitrary checkout mutation. The safe write boundary is $ARTIFACTS_DIR when set, otherwise .archon/artifacts under the current project. All dossier writes must stay inside that artifact root, must reject path traversal, and must preserve symlink/path-escape checks.

Current acceptance target:
- A Codex workflow emits a hook bootloader report before provider execution.
- Codex hook contract evidence includes official-docs/Context7 contract assumptions plus installed runtime evidence when available.
- Runtime Codex hook inventory is visible enough to distinguish user, project, managed, plugin, and unknown hook sources.
- Safety/privacy hooks fail closed when untrusted, disabled, unsupported, timeoutless, or misleadingly scoped.
- PermissionRequest is not treated as sufficient when approval prompts are disabled.
- Stop/SubagentStop continuation hooks are artifacted, timeout bounded, and blocked when they rely on ignored matcher filters.
- Provider capability metadata distinguishes workflow YAML hooks from runtime/config hooks.
- Unsupported safety/output/resource controls fail validation or fail runtime dispatch rather than becoming warning-only behavior.
- ACO commands write a dossier zip by default and only suppress it through --no-write-artifact.
- The dossier contains command output, evidence, manifest, artifact policy, party-mode notes, archive checksum sidecar, and this 4000-character next-goal handoff.
- The dossier contains bad-behaviour-lint.json as a standalone machine-readable classification artifact and also mirrors its summary in the manifest.
- Autonomous workflow routing avoids guided or interactive-only workflows unless the user explicitly requests human-in-the-loop behavior.
- Approval gates show mutation class, affected path, command, reason, and approval scope in live messages, status views, and persisted events.
- Destructive, credential, remote, and production gates still require explicit approval and cannot be approved from normal chat.

Investigation order for the next run:
1. Start from the manifest and evidence files in this dossier.
2. Inspect any badBehaviourLint entries and classify each as intentional, warning-only, or bug.
3. Inspect bad-behaviour-lint.json and confirm the manifest summary agrees with the standalone artifact.
4. If the command output mentions unsupported, unavailable, unobservable, not-streamed, ignored, skipped, dropped, stripped, bypassed, silent, warning-only, advisory-only/advisory-control, no-op, fail-open, fail-closed, deferred, unimplemented/not-implemented, best-effort/degraded, or denied-before-write behavior, verify that the behavior is either explicitly surfaced, classified as intentional fail-closed enforcement, or blocked.
5. For Codex-provider work, inspect hook bootloader artifacts first: codex-hook-bootloader-report.json, codex-hooks-inventory.json, codex-hook-coverage.md, codex-hook-trust-status.md, codex-stop-continuation-policy.md, codex-permission-request-policy.md, codex-hook-contract.json, and codex-hook-contract-evidence.md.
6. For ACO command work, inspect manifest.json, archive-checksum.json, bad-behaviour-lint.json, evidence.json, artifact-policy.json, party-mode-notes.md, and all command-specific artifacts before editing source. Confirm manifest.archiveVerification points at the external checksum sidecar before trusting the dossier zip.
7. For approval work, inspect paused-run metadata, approval_requested events, CLI status rendering, chat status rendering, and web approval cards.
8. For provider capability work, compare provider manifests with validator and DAG runtime enforcement.
9. For routing work, check both prompt/router selection and hard dispatch guards.

Default assumptions:
- Prefer more artifacts over fewer when the output is scoped to the artifact root.
- Do not ask the user optional questions; make conservative engineering assumptions and record them.
- Do not treat docs, markdown, stdout, or a warning as enforcement.
- Do not let a field named hooks, sandbox, approval, output_format, allowed_tools, denied_tools, mcp, skills, or agents silently disappear on a provider that cannot implement it.
- Do not claim runtime hook observability if the provider can only preflight config and cannot observe hook decisions after launch.
- Do not widen approval scope from once to run unless run-scoped approval execution is implemented end to end.
- Do not classify artifact-only dossier writes as high-risk checkout mutations.

Useful follow-up patches:
- Add targeted tests for the newest hardening slices when validation is requested.
- Extend dossier archive fixtures when new required dossier files are introduced.
- Extend preflight fixture coverage if Codex adds new hook events, hook output fields, or schema locations.
- Extend approval status-rendering fixtures when new approval metadata fields or approval channels are introduced.
- Extend runtime DAG fail-closed fixtures whenever a new safety/output/resource control is introduced.

Completion audit guidance:
- Do not mark the remediation complete until every explicit objective item has direct current-state evidence.
- Evidence should be source code plus generated artifacts or tests that cover the broad requirement, not merely a search result that fails to find an obvious counterexample.
- Treat missing validation as incomplete verification, even when the implementation appears aligned.
`;
  if (handoff.length > 4000) {
    return { content: `${handoff.slice(0, 3999)}\n`, truncated: true };
  }
  return { content: handoff, truncated: false };
}

function renderPartyModeNotes(): string {
  return `# Party Mode Notes

This dossier is produced by the ACO artifact writer. Party-mode/subagent contributions can be appended by upstream workflow nodes when available.

Default stance: produce more artifacts than fewer, keep assumptions explicit, and preserve a 4000-character next-goal handoff.

The manifest includes a badBehaviourLintSummary with byClassification and byPattern counts. It classifies detected ignored, skipped, dropped, stripped, bypassed, silent, warning-only, advisory-only/advisory-control, no-op, fail-open, fail-closed enforcement, best-effort/degraded, unsupported/unavailable/unobservable/not-streamed, deferred, unimplemented/not-implemented, or denied-before-write patterns as intentional, warning-only, or bug.

The dossier also includes bad-behaviour-lint.json as the canonical machine-readable lint artifact. Use manifest.badBehaviourLintSummary.byPattern for quick scanning, then inspect bad-behaviour-lint.json for the full summary and raw lint input.

Archive integrity is recorded in archive-checksum.json and summarized in manifest.archiveVerification. Treat those fields as the handoff checkpoint before trusting a copied or resumed dossier.
`;
}

function summarizeBadBehaviourLint(value: unknown): BadBehaviourLintSummary {
  const findings: BadBehaviourLintSummary['findings'][number][] = [];
  collectBadBehaviourFindings(value, findings);
  augmentAcoBadBehaviourFindings(findings);
  const byClassification: Record<BadBehaviourClassification, number> = {
    intentional: 0,
    'warning-only': 0,
    bug: 0,
  };
  for (const finding of findings) {
    byClassification[finding.classification] += 1;
  }
  const byPattern = findings.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.pattern] = (acc[finding.pattern] ?? 0) + 1;
    return acc;
  }, {});
  return {
    total: findings.length,
    byClassification,
    byPattern,
    findings,
  };
}

function augmentAcoBadBehaviourFindings(
  findings: BadBehaviourLintSummary['findings'][number][]
): void {
  const hasScopedArtifactWrite = findings.some(
    finding => finding.pattern === 'writes_artifacts_scoped'
  );
  const alreadyClassifiedDeniedBeforeWrite = findings.some(
    finding => finding.pattern === 'denied_before_write'
  );
  if (hasScopedArtifactWrite && !alreadyClassifiedDeniedBeforeWrite) {
    findings.push({
      pattern: 'denied_before_write',
      classification: 'intentional',
      rationale:
        'ACO artifact-capable commands deliberately allow scoped dossier writes before any checkout-mutation denial; invalid invocations and --no-write-artifact suppress output before writing by design.',
    });
  }
}

function collectBadBehaviourFindings(
  value: unknown,
  findings: BadBehaviourLintSummary['findings'][number][]
): void {
  if (Array.isArray(value)) {
    for (const item of value) collectBadBehaviourFindings(item, findings);
    return;
  }
  if (!isPlainObject(value)) return;

  const classification = readBadBehaviourClassification(value.classification);
  if (classification !== undefined) {
    findings.push({
      pattern: typeof value.pattern === 'string' ? value.pattern : 'unknown',
      classification,
      ...(typeof value.rationale === 'string' ? { rationale: value.rationale } : {}),
    });
    return;
  }

  for (const item of Object.values(value)) collectBadBehaviourFindings(item, findings);
}

function readBadBehaviourClassification(value: unknown): BadBehaviourClassification | undefined {
  return value === 'intentional' || value === 'warning-only' || value === 'bug' ? value : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function renderDossierEvidence(
  commandId: string,
  artifactPolicy: ScopedArtifactRootPolicy,
  evidence: readonly EvidenceRef[]
): Record<string, unknown> {
  return {
    kind: 'aco-dossier-evidence',
    schemaVersion: 'archon.aco-dossier-evidence.v1',
    commandId,
    generatedAt: new Date().toISOString(),
    artifactPolicy,
    evidence,
  };
}

function readableFileContent(path: string): string {
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf8');
}

function sha256Text(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function fileDigestFields(path: string): { bytes: number; sha256: string } {
  const content = readableFileContent(path);
  return {
    bytes: Buffer.byteLength(content),
    sha256: sha256Text(content),
  };
}

function fileManifestEntry(
  dossierDir: string,
  path: string
): {
  path: string;
  relativePath: string;
  bytes: number;
  sha256: string;
  includedInArchive: true;
} {
  return {
    path,
    relativePath: relative(dossierDir, path).split(sep).join('/'),
    ...fileDigestFields(path),
    includedInArchive: true,
  };
}

interface ZipEntry {
  readonly name: string;
  readonly content: Buffer;
}

function writeZip(entries: readonly ZipEntry[], zipPath: string): void {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const crc = crc32(entry.content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entry.content.length, 18);
    localHeader.writeUInt32LE(entry.content.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, entry.content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(entry.content.length, 20);
    centralHeader.writeUInt32LE(entry.content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + entry.content.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  writeFileSync(zipPath, Buffer.concat([...localParts, ...centralParts, end]));
}

function crc32(input: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
