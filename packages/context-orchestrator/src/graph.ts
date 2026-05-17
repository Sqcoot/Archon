import { readFile } from 'fs/promises';
import { join } from 'path';
import type { GraphContext, GraphRepositoryStatus, GraphStatus } from './types';

interface ManifestRepository {
  name: string;
  cloneStatus?: string;
  branch?: string | null;
  commitSha?: string | null;
  graphStatus?: GraphStatus;
  waiverRequired?: boolean;
}

interface UpstreamManifest {
  repositories: ManifestRepository[];
}

interface GraphMetadata {
  nodeCount?: number;
  edgeCount?: number;
  nodes?: number;
  edges?: number;
}

export interface GetGraphContextOptions {
  cwd: string;
}

export async function getGraphContext(options: GetGraphContextOptions): Promise<GraphContext> {
  const manifestPath = join(
    options.cwd,
    'docs/context-orchestrator/research/upstream-manifest.json'
  );
  let manifest: UpstreamManifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as UpstreamManifest;
  } catch {
    return {
      status: 'unavailable',
      repositories: [],
      waiverCount: 0,
      summary: 'Graph evidence is unavailable for this codebase.',
    };
  }

  const repositories: GraphRepositoryStatus[] = [];
  for (const repo of manifest.repositories) {
    const metadata = await readGraphMetadata(options.cwd, repo.name);
    repositories.push({
      name: repo.name,
      graphStatus: repo.graphStatus ?? 'not-started',
      cloneStatus: repo.cloneStatus ?? 'unknown',
      branch: repo.branch ?? null,
      commitSha: repo.commitSha ?? null,
      waiverRequired: repo.waiverRequired ?? false,
      nodes: metadata.nodes,
      edges: metadata.edges,
    });
  }

  const waiverCount = repositories.filter(repo => repo.waiverRequired).length;
  return {
    status: waiverCount > 0 ? 'partial' : 'available',
    repositories,
    waiverCount,
    summary: `${repositories.length} repositories indexed; ${waiverCount} graph waiver(s).`,
  };
}

async function readGraphMetadata(
  cwd: string,
  repoName: string
): Promise<{ nodes: number; edges: number }> {
  const metadataPath = join(cwd, 'research/graphs', repoName, 'graph-metadata.json');
  try {
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as GraphMetadata;
    return {
      nodes: metadata.nodeCount ?? metadata.nodes ?? 0,
      edges: metadata.edgeCount ?? metadata.edges ?? 0,
    };
  } catch {
    return { nodes: 0, edges: 0 };
  }
}
