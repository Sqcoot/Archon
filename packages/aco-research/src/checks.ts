import {
  APPROVAL_REQUIRED_GRAPH_COMMAND,
  APPROVAL_REQUIRED_GRAPH_SAFETY_CLASS,
  REQUIRED_RESEARCH_ARTIFACTS,
} from './constants';
import {
  agenticSearchReportSchema,
  graphEvidenceRefSchema,
  graphWaiverClosureSchema,
  researchArtifactBundleSchema,
  researchArtifactMetadataSchema,
  upstreamGraphManifestSchema,
} from './schemas';
import type {
  GraphEvidenceRef,
  GraphWaiverClosure,
  ResearchArtifactMetadata,
  UpstreamGraphManifest,
} from './schemas';

export function checkGraphEvidenceRef(input: unknown): readonly string[] {
  const parsed = graphEvidenceRefSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map(issue => `invalid graph evidence ref: ${issue.message}`);
  }

  const ref = parsed.data;
  const errors: string[] = [];
  if (ref.status === 'complete' && ref.nodes === 0 && ref.edges === 0) {
    errors.push(`${ref.repository} complete graph evidence must record nodes or edges`);
  }
  if (ref.status === 'waived' && !ref.waiverRequired) {
    errors.push(`${ref.repository} cannot be waived unless waiverRequired is true`);
  }
  for (const path of [ref.graphPath, ref.reportPath, ref.metadataPath]) {
    if (path.startsWith('/')) {
      errors.push(`${ref.repository} graph evidence path must be artifact-root relative: ${path}`);
    }
    if (path.includes('://')) {
      errors.push(`${ref.repository} graph evidence path must not be a network URL: ${path}`);
    }
  }
  return errors;
}

export function checkResearchArtifactMetadata(input: unknown): readonly string[] {
  const parsed = researchArtifactMetadataSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map(issue => `invalid research artifact metadata: ${issue.message}`);
  }

  const metadata = parsed.data;
  const errors: string[] = [];
  if (metadata.path.startsWith('/')) {
    errors.push(`${metadata.path} must be artifact-root relative`);
  }
  if (metadata.path.includes('://')) {
    errors.push(`${metadata.path} must not be a network URL`);
  }
  return errors;
}

export function checkUpstreamGraphManifest(input: unknown): readonly string[] {
  const parsed = upstreamGraphManifestSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map(issue => `invalid upstream graph manifest: ${issue.message}`);
  }

  const manifest = parsed.data;
  const errors: string[] = [];
  const repositories = manifest.repositories.map(ref => ref.repository);
  if (new Set(repositories).size !== repositories.length) {
    errors.push('duplicate upstream graph repositories are not allowed');
  }
  for (const ref of manifest.repositories) {
    errors.push(...checkGraphEvidenceRef(ref));
  }
  for (const metadata of manifest.artifacts) {
    errors.push(...checkResearchArtifactMetadata(metadata));
  }
  return errors;
}

export function checkGraphWaiverClosure(input: unknown): readonly string[] {
  const parsed = graphWaiverClosureSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map(issue => `invalid graph waiver closure: ${issue.message}`);
  }

  const closure = parsed.data;
  const errors: string[] = [
    ...closure.graphRefs.flatMap(ref => checkGraphEvidenceRef(ref)),
    ...closure.artifacts.flatMap(metadata => checkResearchArtifactMetadata(metadata)),
  ];
  if (!closure.required && closure.status !== 'not-required') {
    errors.push('non-required graph evidence must return not-required closure status');
  }
  if (closure.status === 'approval_required') {
    if (closure.command !== APPROVAL_REQUIRED_GRAPH_COMMAND) {
      errors.push('approval_required closure must name bun run research:graph');
    }
    if (closure.safetyClass !== APPROVAL_REQUIRED_GRAPH_SAFETY_CLASS) {
      errors.push('approval_required closure must use writes-graph-cache safety class');
    }
    if (closure.expectedSuccessEvidence.length === 0) {
      errors.push('approval_required closure must describe expected success evidence');
    }
  } else if (closure.command !== null || closure.safetyClass !== null) {
    errors.push(`${closure.status} closure must not carry an executable command`);
  }
  if (closure.status === 'closed') {
    errors.push(...checkClosedGraphWaiverClosure(closure));
  }
  if (
    closure.status === 'failed' &&
    !closure.findings.some(finding => finding.includes('failed'))
  ) {
    errors.push('failed graph waiver closure must preserve failure findings');
  }
  return errors;
}

export function checkAgenticSearchReport(input: unknown): readonly string[] {
  const parsed = agenticSearchReportSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map(issue => `invalid agentic search report: ${issue.message}`);
  }

  const report = parsed.data;
  const errors: string[] = [];
  for (const ref of report.dependencyContextGraphRefs) {
    errors.push(...checkGraphEvidenceRef(ref));
  }
  for (const metadata of report.artifacts) {
    errors.push(...checkResearchArtifactMetadata(metadata));
  }
  const artifactPaths = new Set(report.artifacts.map(metadata => metadata.path));
  if (!artifactPaths.has('agentic-search-report.json')) {
    errors.push('Agentic Search JSON source artifact metadata is required');
  }
  if (!artifactPaths.has('agentic-search.md')) {
    errors.push('Agentic Search markdown view artifact metadata is required');
  }
  return errors;
}

export function checkResearchArtifactBundle(input: unknown): readonly string[] {
  const parsed = researchArtifactBundleSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map(issue => `invalid research artifact bundle: ${issue.message}`);
  }

  const bundle = parsed.data;
  const errors: string[] = [
    ...checkUpstreamGraphManifest(bundle.upstreamManifest),
    ...checkGraphWaiverClosure(bundle.waiverClosure),
    ...checkAgenticSearchReport(bundle.agenticSearchReport),
  ];
  const artifactNames = bundle.artifacts.map(artifact => artifact.name);
  if (new Set(artifactNames).size !== artifactNames.length) {
    errors.push('duplicate research artifact names are not allowed');
  }
  for (const required of REQUIRED_RESEARCH_ARTIFACTS) {
    if (!artifactNames.includes(required)) {
      errors.push(`missing required research artifact ${required}`);
    }
  }
  for (const artifact of bundle.artifacts) {
    if (artifact.content.trim().length === 0) {
      errors.push(`${artifact.name} must have non-empty content`);
    }
    errors.push(...checkResearchArtifactMetadata(artifact.metadata));
  }
  return errors;
}

export function requiredArtifactPaths(ref: GraphEvidenceRef): readonly string[] {
  return [ref.graphPath, ref.reportPath, ref.metadataPath];
}

export function metadataByPath(
  artifacts: readonly ResearchArtifactMetadata[]
): ReadonlyMap<string, ResearchArtifactMetadata> {
  return new Map(artifacts.map(metadata => [metadata.path, metadata]));
}

function checkClosedGraphWaiverClosure(closure: GraphWaiverClosure): readonly string[] {
  const errors: string[] = [];
  const artifactsByPath = metadataByPath(closure.artifacts);
  for (const ref of closure.graphRefs) {
    if (ref.status === 'failed' || ref.status === 'not-started') {
      errors.push(`${ref.repository} cannot close graph waiver with status ${ref.status}`);
    }
    if (ref.status === 'waived' && !ref.waiverRequired) {
      errors.push(`${ref.repository} cannot close a waiver that was not required`);
    }
    for (const path of requiredArtifactPaths(ref)) {
      const metadata = artifactsByPath.get(path);
      if (metadata === undefined) {
        errors.push(`${ref.repository} is missing artifact metadata for ${path}`);
      } else if (ref.status === 'complete' && metadata.freshness !== 'fresh') {
        errors.push(`${ref.repository} requires fresh artifact metadata for ${path}`);
      } else if (
        ref.status === 'waived' &&
        metadata.freshness !== 'waived' &&
        metadata.freshness !== 'fresh'
      ) {
        errors.push(
          `${ref.repository} waived evidence requires waived or fresh metadata for ${path}`
        );
      }
    }
  }
  return errors;
}

export function findGraphEvidenceRef(
  manifest: UpstreamGraphManifest,
  repository: string
): GraphEvidenceRef | undefined {
  return manifest.repositories.find(ref => ref.repository === repository);
}

export function findResearchArtifactMetadata(
  artifacts: readonly ResearchArtifactMetadata[],
  path: string
): ResearchArtifactMetadata | undefined {
  return artifacts.find(metadata => metadata.path === path);
}
