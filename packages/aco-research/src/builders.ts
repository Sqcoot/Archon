import type { EvidenceRef, Freshness, MutationClass, ParseResult } from '@archon/aco-core';
import { APPROVAL_REQUIRED_GRAPH_COMMAND, APPROVAL_REQUIRED_GRAPH_SAFETY_CLASS } from './constants';
import {
  agenticSearchReportSchema,
  graphEvidenceRefSchema,
  graphWaiverClosureSchema,
  researchArtifactBundleSchema,
  researchArtifactMetadataSchema,
  upstreamGraphManifestSchema,
} from './schemas';
import type {
  AgenticSearchReport,
  GraphEvidenceRef,
  GraphWaiverClosure,
  ResearchArtifact,
  ResearchArtifactBundle,
  ResearchArtifactMetadata,
  ResearchArtifactName,
  ResearchGraphEvidenceStatus,
  UpstreamGraphManifest,
} from './schemas';
import {
  checkAgenticSearchReport,
  checkGraphEvidenceRef,
  checkGraphWaiverClosure,
  checkResearchArtifactBundle,
  checkResearchArtifactMetadata,
  checkUpstreamGraphManifest,
  metadataByPath,
  requiredArtifactPaths,
} from './checks';
import {
  renderAgenticSearchMarkdown,
  renderAgenticSearchReportJson,
  renderGraphWaiverClosureJson,
  renderUpstreamGraphManifestJson,
} from './renderers';

const GRAPHIFY_ARCHITECTURE_EVIDENCE = {
  id: 'evidence.research.graphify-agentic-search',
  source: 'architecture/graphify-agentic-search.md',
  summary: 'Readonly S6 evidence separates graph evidence consumption from graph refresh',
  confidence: 'high',
  freshness: 'unknown',
} as const satisfies EvidenceRef;

const UPSTREAM_GRAPH_EVIDENCE = {
  id: 'evidence.research.upstream-graph-snapshot',
  source: 'evidence/upstream-graph-evidence.md',
  summary: 'Readonly S6 evidence lists upstream repositories with complete graph evidence',
  confidence: 'high',
  freshness: 'unknown',
} as const satisfies EvidenceRef;

const LEDGER_POLICY_EVIDENCE = {
  id: 'evidence.research.ledger-policy',
  source: 'ledgers/command-ledger.csv#bun-run-research-graph',
  summary: 'Command ledger classifies graph refresh as approval-gated writes-graph-cache work',
  confidence: 'high',
  freshness: 'unknown',
} as const satisfies EvidenceRef;

const ARTIFACT_CONTRACT_EVIDENCE = {
  id: 'evidence.research.artifact-contracts',
  source: 'architecture/artifact-contracts.md',
  summary:
    'Artifact contracts require schema version, producer, consumer, path, checksum, freshness',
  confidence: 'high',
  freshness: 'unknown',
} as const satisfies EvidenceRef;

interface GraphSeed {
  readonly repository: string;
  readonly branch: string | null;
  readonly commitSha: string | null;
  readonly status: ResearchGraphEvidenceStatus;
  readonly nodes: number;
  readonly edges: number;
  readonly waiverRequired: boolean;
}

interface GraphWaiverClosureInput {
  readonly id?: string;
  readonly required: boolean;
  readonly graphRefs: readonly GraphEvidenceRef[];
  readonly artifacts: readonly ResearchArtifactMetadata[];
}

export function readGraphEvidence(input: unknown): ParseResult<GraphEvidenceRef> {
  const parsed = graphEvidenceRefSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }

  const issues = checkGraphEvidenceRef(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function parseResearchArtifactMetadata(
  input: unknown
): ParseResult<ResearchArtifactMetadata> {
  const parsed = researchArtifactMetadataSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }

  const issues = checkResearchArtifactMetadata(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function parseUpstreamGraphManifest(input: unknown): ParseResult<UpstreamGraphManifest> {
  const parsed = upstreamGraphManifestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }

  const issues = checkUpstreamGraphManifest(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function parseGraphWaiverClosure(input: unknown): ParseResult<GraphWaiverClosure> {
  const parsed = graphWaiverClosureSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }

  const issues = checkGraphWaiverClosure(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function parseAgenticSearchReport(input: unknown): ParseResult<AgenticSearchReport> {
  const parsed = agenticSearchReportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }

  const issues = checkAgenticSearchReport(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function parseResearchArtifactBundle(input: unknown): ParseResult<ResearchArtifactBundle> {
  const parsed = researchArtifactBundleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }

  const issues = checkResearchArtifactBundle(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function defaultGraphEvidenceRefs(): readonly GraphEvidenceRef[] {
  return graphSeeds().map(seed => ({
    repository: seed.repository,
    branch: seed.branch,
    commitSha: seed.commitSha,
    status: seed.status,
    nodes: seed.nodes,
    edges: seed.edges,
    waiverRequired: seed.waiverRequired,
    graphPath: `graph/${seed.repository}/graph-context.json`,
    reportPath: `graph/${seed.repository}/graph-report.md`,
    metadataPath: `graph/${seed.repository}/metadata.json`,
  }));
}

export function buildResearchArtifactMetadata(input: {
  readonly path: string;
  readonly producer?: string;
  readonly consumer?: string;
  readonly freshness?: Freshness;
  readonly checksumSeed?: string;
}): ParseResult<ResearchArtifactMetadata> {
  const metadata = {
    kind: 'aco-research-artifact-metadata',
    schemaVersion: 'aco.research-artifact-metadata.v1',
    producer: input.producer ?? 'aco-research',
    consumer: input.consumer ?? 'aco-context',
    path: input.path,
    checksum: stableChecksum(input.checksumSeed ?? input.path),
    freshness: input.freshness ?? 'fresh',
  } as const;

  return parseResearchArtifactMetadata(metadata);
}

export function buildGraphArtifactMetadata(
  refs: readonly GraphEvidenceRef[] = defaultGraphEvidenceRefs(),
  freshness: Freshness = 'fresh'
): readonly ResearchArtifactMetadata[] {
  return refs.flatMap(ref =>
    requiredArtifactPaths(ref).map(path => buildMetadataOrThrow({ path, freshness }))
  );
}

export function buildUpstreamGraphManifest(
  refs: readonly GraphEvidenceRef[] = defaultGraphEvidenceRefs(),
  artifacts: readonly ResearchArtifactMetadata[] = [
    buildMetadataOrThrow({ path: 'upstream-graph-manifest.json', freshness: 'fresh' }),
  ]
): ParseResult<UpstreamGraphManifest> {
  const manifest = {
    kind: 'aco-upstream-graph-manifest',
    schemaVersion: 'aco.upstream-graph-manifest.v1',
    repositories: [...refs].sort((left, right) => left.repository.localeCompare(right.repository)),
    artifacts: [...artifacts].sort((left, right) => left.path.localeCompare(right.path)),
    evidence: [GRAPHIFY_ARCHITECTURE_EVIDENCE, UPSTREAM_GRAPH_EVIDENCE],
  } as const;

  const parsed = upstreamGraphManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }

  const issues = checkUpstreamGraphManifest(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function buildGraphWaiverClosure(
  input: GraphWaiverClosureInput = {
    required: true,
    graphRefs: defaultGraphEvidenceRefs(),
    artifacts: buildGraphArtifactMetadata(),
  }
): ParseResult<GraphWaiverClosure> {
  const status = decideClosureStatus(input.required, input.graphRefs, input.artifacts);
  const closure = {
    kind: 'aco-graph-waiver-closure',
    schemaVersion: 'aco.graph-waiver-closure.v1',
    id: input.id ?? 'aco.research.s6.graph-waiver-closure',
    required: input.required,
    status,
    command: status === 'approval_required' ? APPROVAL_REQUIRED_GRAPH_COMMAND : null,
    safetyClass:
      status === 'approval_required'
        ? (APPROVAL_REQUIRED_GRAPH_SAFETY_CLASS satisfies MutationClass)
        : null,
    expectedSuccessEvidence:
      status === 'approval_required'
        ? [
            'valid graph evidence refs with complete or waived status',
            'fresh checksum metadata for graph, report, and metadata artifacts',
          ]
        : [],
    graphRefs: [...input.graphRefs].sort((left, right) =>
      left.repository.localeCompare(right.repository)
    ),
    artifacts: [...input.artifacts].sort((left, right) => left.path.localeCompare(right.path)),
    findings: closureFindings(input.required, input.graphRefs, input.artifacts, status),
    evidence: [GRAPHIFY_ARCHITECTURE_EVIDENCE, LEDGER_POLICY_EVIDENCE, ARTIFACT_CONTRACT_EVIDENCE],
  } as const;

  const parsed = graphWaiverClosureSchema.safeParse(closure);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }

  const issues = checkGraphWaiverClosure(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function buildAgenticSearchReport(
  manifest: UpstreamGraphManifest = buildDefaultManifestOrThrow()
): ParseResult<AgenticSearchReport> {
  const artifacts = [
    buildMetadataOrThrow({ path: 'agentic-search-report.json', freshness: 'fresh' }),
    buildMetadataOrThrow({ path: 'agentic-search.md', freshness: 'fresh' }),
  ];
  const report = {
    kind: 'aco-agentic-search-report',
    schemaVersion: 'aco.agentic-search-report.v1',
    id: 'aco.research.s6.agentic-search',
    objective:
      'Implement S6 as pure Research and Graphify evidence contracts without implicit mutation.',
    intentHash: stableChecksum('S6:@archon/aco-research:pure-evidence-consumption'),
    candidateImplementationSurfaces: [
      {
        path: 'packages/aco-research/src/schemas.ts',
        owner: '@archon/aco-research',
        reason:
          'Define graph evidence, waiver closure, upstream manifest, and search report schemas.',
        evidence: [GRAPHIFY_ARCHITECTURE_EVIDENCE],
      },
      {
        path: 'packages/aco-research/src/builders.ts',
        owner: '@archon/aco-research',
        reason: 'Build deterministic evidence fixtures and fail-closed closure results.',
        evidence: [LEDGER_POLICY_EVIDENCE],
      },
      {
        path: 'tests/fixtures/aco/research/',
        owner: '@archon/aco-research',
        reason: 'Preserve complete, failed, waived, not-started, stale, and report golden outputs.',
        evidence: [UPSTREAM_GRAPH_EVIDENCE],
      },
    ],
    candidateTestsAndAcceptanceMarkers: [
      {
        commandOrPath: 'bun --filter @archon/aco-research test',
        marker: 'graph evidence parsing, waiver closure, deterministic report fixtures',
        evidence: [GRAPHIFY_ARCHITECTURE_EVIDENCE],
      },
      {
        commandOrPath: 'bun x eslint packages/aco-research/src --max-warnings 0 --no-cache',
        marker: 'production source imports only local modules, zod, and @archon/aco-core',
        evidence: [ARTIFACT_CONTRACT_EVIDENCE],
      },
    ],
    dependencyContextGraphRefs: manifest.repositories,
    evidenceGaps: [
      'Live graph cache freshness cannot be inferred without an explicitly approved graph refresh.',
    ],
    disallowedAssumptions: [
      'Do not infer graph freshness from the presence of a report path.',
      'Do not run network, shell, CLI, or Graphify execution from this package.',
      'Do not treat markdown as source of truth when JSON evidence exists.',
    ],
    recommendedNextSlice: {
      id: 'S7',
      packageName: 'CLI parity',
      reason: 'After pure research evidence exists, thin CLI adapters can consume it explicitly.',
    },
    artifacts,
    evidence: [GRAPHIFY_ARCHITECTURE_EVIDENCE, UPSTREAM_GRAPH_EVIDENCE, LEDGER_POLICY_EVIDENCE],
  } as const;

  const parsed = agenticSearchReportSchema.safeParse(report);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }

  const issues = checkAgenticSearchReport(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function buildResearchArtifacts(): ParseResult<ResearchArtifactBundle> {
  const manifest = buildUpstreamGraphManifest();
  if (!manifest.ok) return manifest;

  const closure = buildGraphWaiverClosure({
    required: true,
    graphRefs: defaultClosureRefs(manifest.value),
    artifacts: buildGraphArtifactMetadata(defaultClosureRefs(manifest.value)),
  });
  if (!closure.ok) return closure;

  const report = buildAgenticSearchReport(manifest.value);
  if (!report.ok) return report;

  const artifacts: readonly ResearchArtifact[] = [
    artifact(
      'upstream-graph-manifest.json',
      'application/json',
      manifest.value.schemaVersion,
      renderUpstreamGraphManifestJson(manifest.value)
    ),
    artifact(
      'graph-waiver-closure.json',
      'application/json',
      closure.value.schemaVersion,
      renderGraphWaiverClosureJson(closure.value)
    ),
    artifact(
      'agentic-search-report.json',
      'application/json',
      report.value.schemaVersion,
      renderAgenticSearchReportJson(report.value)
    ),
    artifact(
      'agentic-search.md',
      'text/markdown',
      report.value.schemaVersion,
      renderAgenticSearchMarkdown(report.value)
    ),
  ];

  const bundle = {
    kind: 'aco-research-artifact-bundle',
    schemaVersion: 'aco.research-artifacts.v1',
    artifacts,
    upstreamManifest: manifest.value,
    waiverClosure: closure.value,
    agenticSearchReport: report.value,
    evidence: [GRAPHIFY_ARCHITECTURE_EVIDENCE, UPSTREAM_GRAPH_EVIDENCE, LEDGER_POLICY_EVIDENCE],
  } as const;

  return parseResearchArtifactBundle(bundle);
}

function graphSeeds(): readonly GraphSeed[] {
  return [
    seed('archon', 'dev', 1842, 4130),
    seed('bmad-automator', null, 421, 736),
    seed('bmad-builder', null, 612, 1104),
    seed('bmad-cis', null, 388, 654),
    seed('bmad-method', null, 1290, 2610),
    seed('bmad-plugins-marketplace', null, 378, 611),
    seed('bmad-sample-data', null, 214, 319),
    seed('bmad-tea', null, 535, 901),
    seed('bmad-ui', null, 486, 844),
    seed('bmad-wds', null, 452, 790),
    seed('caveman', null, 153, 221),
    seed('codex', null, 9250, 21480),
    seed('context7', null, 704, 1328),
  ];
}

function seed(repository: string, branch: string | null, nodes: number, edges: number): GraphSeed {
  return {
    repository,
    branch,
    commitSha: null,
    status: 'complete',
    nodes,
    edges,
    waiverRequired: false,
  };
}

function artifact(
  name: ResearchArtifactName,
  mediaType: string,
  schemaVersion: string,
  content: string
): ResearchArtifact {
  return {
    name,
    mediaType,
    schemaVersion,
    content,
    metadata: buildMetadataOrThrow({
      path: name,
      freshness: 'fresh',
      consumer: name.endsWith('.md') ? 'human-handoff' : 'aco-context',
      checksumSeed: `${name}:${content}`,
    }),
  };
}

function buildMetadataOrThrow(input: {
  readonly path: string;
  readonly producer?: string;
  readonly consumer?: string;
  readonly freshness?: Freshness;
  readonly checksumSeed?: string;
}): ResearchArtifactMetadata {
  const metadata = buildResearchArtifactMetadata(input);
  if (!metadata.ok) throw new Error(metadata.issues.join('\n'));
  return metadata.value;
}

function buildDefaultManifestOrThrow(): UpstreamGraphManifest {
  const manifest = buildUpstreamGraphManifest();
  if (!manifest.ok) throw new Error(manifest.issues.join('\n'));
  return manifest.value;
}

function defaultClosureRefs(manifest: UpstreamGraphManifest): readonly GraphEvidenceRef[] {
  return manifest.repositories.filter(ref => ref.repository === 'archon');
}

function decideClosureStatus(
  required: boolean,
  refs: readonly GraphEvidenceRef[],
  artifacts: readonly ResearchArtifactMetadata[]
): GraphWaiverClosure['status'] {
  if (!required) return 'not-required';
  if (refs.length === 0) return 'approval_required';
  if (refs.some(ref => ref.status === 'failed')) return 'failed';
  if (refs.some(ref => ref.status === 'not-started')) return 'approval_required';
  const artifactsByPath = metadataByPath(artifacts);
  for (const ref of refs) {
    for (const path of requiredArtifactPaths(ref)) {
      const metadata = artifactsByPath.get(path);
      if (metadata === undefined) return 'approval_required';
      if (ref.status === 'complete' && metadata.freshness !== 'fresh') {
        return 'approval_required';
      }
      if (
        ref.status === 'waived' &&
        metadata.freshness !== 'fresh' &&
        metadata.freshness !== 'waived'
      ) {
        return 'approval_required';
      }
    }
  }
  return 'closed';
}

function closureFindings(
  required: boolean,
  refs: readonly GraphEvidenceRef[],
  artifacts: readonly ResearchArtifactMetadata[],
  status: GraphWaiverClosure['status']
): readonly string[] {
  if (!required) return ['graph evidence not required for this evaluation'];
  if (refs.length === 0) return ['graph evidence is required but no graph refs were supplied'];
  const artifactsByPath = metadataByPath(artifacts);
  const findings: string[] = [];
  for (const ref of refs) {
    if (ref.status === 'failed') findings.push(`${ref.repository} graph evidence failed`);
    if (ref.status === 'not-started') findings.push(`${ref.repository} graph evidence not started`);
    if (ref.status === 'waived') findings.push(`${ref.repository} graph evidence waived`);
    for (const path of requiredArtifactPaths(ref)) {
      const metadata = artifactsByPath.get(path);
      if (metadata === undefined) {
        findings.push(`${ref.repository} missing metadata for ${path}`);
      } else if (metadata.freshness === 'stale' || metadata.freshness === 'unknown') {
        findings.push(`${ref.repository} ${path} freshness is ${metadata.freshness}`);
      }
    }
  }
  if (findings.length > 0) return findings;
  return [
    status === 'closed' ? 'all required graph evidence is closed' : `closure status ${status}`,
  ];
}

function stableChecksum(seedValue: string): string {
  let hex = '';
  for (let index = 0; index < seedValue.length; index += 1) {
    hex += seedValue.charCodeAt(index).toString(16).padStart(2, '0');
  }
  return `${hex}${'0'.repeat(64)}`.slice(0, 64);
}

export function graphEvidenceRef(
  repository: string,
  status: ResearchGraphEvidenceStatus,
  options: {
    readonly branch?: string | null;
    readonly commitSha?: string | null;
    readonly nodes?: number;
    readonly edges?: number;
    readonly waiverRequired?: boolean;
  } = {}
): GraphEvidenceRef {
  return {
    repository,
    branch: options.branch ?? null,
    commitSha: options.commitSha ?? null,
    status,
    nodes: options.nodes ?? (status === 'complete' ? 1 : 0),
    edges: options.edges ?? (status === 'complete' ? 1 : 0),
    waiverRequired: options.waiverRequired ?? status === 'waived',
    graphPath: `graph/${repository}/graph-context.json`,
    reportPath: `graph/${repository}/graph-report.md`,
    metadataPath: `graph/${repository}/metadata.json`,
  };
}
