import { lstat, readdir, readFile, realpath } from 'fs/promises';
import { basename, resolve } from 'path';
import { assertPathInside, assertRealPathInside, validateSafeRunId } from './security';

export interface ArtifactPackageFile {
  name: string;
  path: string;
}

export interface ArtifactPackageLookup {
  runId: string;
  archivePath: string;
  manifest: Record<string, unknown>;
  files: ArtifactPackageFile[];
}

export async function readArtifactPackageManifest(
  cwd: string,
  runIdInput: string
): Promise<ArtifactPackageLookup> {
  const runId = validateSafeRunId(runIdInput);
  const archiveRoot = resolve(cwd, '.archon/artifacts/context-orchestrator');
  const archivePath = resolve(archiveRoot, runId);
  const manifestPath = resolve(archivePath, 'manifest.json');

  assertPathInside(archiveRoot, archivePath);
  assertPathInside(archiveRoot, manifestPath);

  const [realArchiveRoot, realArchivePath] = await Promise.all([
    realpath(archiveRoot),
    realpath(archivePath),
  ]);
  await assertRealPathInside(realArchiveRoot, realArchivePath);

  const manifestStat = await lstat(manifestPath);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) {
    throw new Error('ACO artifact manifest must be a regular file');
  }
  const realManifestPath = await realpath(manifestPath);
  await assertRealPathInside(realArchivePath, realManifestPath);

  const manifestContent = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent) as Record<string, unknown>;
  const entries = await readdir(archivePath, { withFileTypes: true });
  const files = entries
    .filter(entry => entry.isFile())
    .map(entry => {
      const filePath = resolve(archivePath, entry.name);
      assertPathInside(archivePath, filePath);
      return {
        name: basename(entry.name),
        path: filePath,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    runId,
    archivePath,
    manifest,
    files,
  };
}
