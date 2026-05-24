import { readFile } from 'fs/promises';
import { join, relative, resolve } from 'path';
import { redactSecrets, isPathInside } from './security';
import { getContextOrchestratorLedgers, getContextOrchestratorStatus } from './status';
import type {
  CommandLedgerEntry,
  GraphRepositoryStatus,
  GraphStatus,
  GraphWaiver,
  GraphWaiverArtifactDiagnostic,
  GraphWaiverArtifactStatus,
  GraphWaiverClosureDecision,
  GraphWaiverClosureDiagnostic,
  GraphWaiverClosureReport,
  GraphWaiverClosureCommand,
  ToolAvailabilityLedgerEntry,
} from './types';

export const GRAPH_WAIVER_CLOSURE_SCHEMA_VERSION = 'aco.graph-waiver-closure.v1' as const;
const UPSTREAM_MANIFEST_PATH = 'docs/context-orchestrator/research/upstream-manifest.json';
const GRAPH_EVIDENCE_INDEX_PATH = 'docs/context-orchestrator/research/graph-evidence-index.md';
const RESEARCH_WAIVERS_PATH = 'docs/context-orchestrator/research/waivers.md';

interface BuildGraphWaiverClosureReportOptions {
  cwd: string;
  timestamp?: string;
}

interface ManifestRepository {
  name: string;
  localPath?: string;
  cloneStatus?: string;
  graphStatus?: GraphStatus;
  waiverRequired?: boolean;
  error?: string | null;
}

interface UpstreamManifest {
  repositories?: ManifestRepository[];
}

type LedgerRow = ToolAvailabilityLedgerEntry | CommandLedgerEntry;

interface GraphFileShape {
  graphStatus?: unknown;
  nodes?: unknown;
  edges?: unknown;
  reason?: unknown;
}

interface GraphMetadataShape {
  graphStatus?: unknown;
  error?: unknown;
}

type MissingGraphSynthesisReason =
  | 'documented_failed_waiver_required'
  | 'missing_manifest'
  | 'missing_index_row'
  | 'missing_waiver_section'
  | 'contradictory_docs'
  | 'malformed_docs'
  | 'unsafe_path'
  | 'existing_malformed_artifact';
type MissingGraphSynthesisFailureReason = Exclude<
  MissingGraphSynthesisReason,
  'documented_failed_waiver_required'
>;

interface MissingGraphSynthesisEvaluation {
  canSynthesize: boolean;
  reason: MissingGraphSynthesisReason;
  message: string;
}

interface GraphEvidenceIndexRow {
  repository: string;
  graphStatus: string;
  cloneStatus: string;
  nodes: number;
  edges: number;
  waiverRequired: string;
  graphPath: string;
}

interface WaiverDocSection {
  repository: string;
  status: string;
  graphPath: string;
}

export async function getGraphWaiverClosureReport(
  options: BuildGraphWaiverClosureReportOptions
): Promise<GraphWaiverClosureReport> {
  const [status, ledgers, manifest] = await Promise.all([
    getContextOrchestratorStatus(options.cwd),
    getContextOrchestratorLedgers(options.cwd, options.timestamp),
    readManifest(options.cwd),
  ]);
  const manifestByName = new Map(manifest.repositories.map(repo => [repo.name, repo]));
  const graphStatusByName = new Map(
    status.waivers.map(waiver => [
      waiver.repository,
      statusToRepositoryStatus(status.graphStatus, waiver, manifestByName.get(waiver.repository)),
    ])
  );
  const ledgerRows = [...ledgers.toolAvailability, ...ledgers.commands];
  const diagnostics: GraphWaiverClosureDiagnostic[] = [];

  for (const waiver of status.waivers) {
    const manifestRepo = manifestByName.get(waiver.repository);
    const repositoryStatus = graphStatusByName.get(waiver.repository);
    const inspectedGraphArtifact = await inspectGraphArtifact(options.cwd, waiver.repository);
    const graphArtifact = await synthesizeMissingGraphArtifact({
      cwd: options.cwd,
      repository: waiver.repository,
      manifestRepo,
      graphArtifact: inspectedGraphArtifact,
    });
    const failureSummary = await buildFailureSummary(options.cwd, waiver.repository, manifestRepo);
    const decision = decideClosure(repositoryStatus, manifestRepo, graphArtifact);
    diagnostics.push(
      buildDiagnostic({
        waiver,
        manifestRepo,
        repositoryStatus,
        graphArtifact,
        failureSummary,
        affectedLedgerRows: affectedLedgerRows(ledgerRows, waiver),
        decision,
      })
    );
  }

  return {
    schemaVersion: GRAPH_WAIVER_CLOSURE_SCHEMA_VERSION,
    ...(options.timestamp ? { generatedAt: options.timestamp } : {}),
    cwd: options.cwd,
    readiness: status.readiness,
    graphStatus: status.graphStatus,
    validationStatus: status.validationStatus,
    approvalRequired: status.approvalRequired,
    waiverCount: status.graphWaivers,
    diagnostics,
    summary: summarizeDiagnostics(diagnostics),
  };
}

export function renderGraphWaiverClosureReportMarkdown(report: GraphWaiverClosureReport): string {
  const rows = report.diagnostics.flatMap(diagnostic => [
    `## ${diagnostic.waiverId}`,
    '',
    `Repository: ${diagnostic.repository}`,
    `Decision: ${diagnostic.decision}`,
    `Approval: ${diagnostic.approvalStatus}`,
    `Graph artifact: ${diagnostic.graphArtifact.status} (${diagnostic.graphArtifact.nodes} nodes, ${diagnostic.graphArtifact.edges} edges)`,
    `Artifact path: ${diagnostic.graphArtifact.path}`,
    `Artifact message: ${diagnostic.graphArtifact.message}`,
    `Reason: ${diagnostic.reason}`,
    `Failure: ${diagnostic.failureSummary}`,
    `Affected ledger rows: ${diagnostic.affectedLedgerRows.join(', ') || 'none'}`,
    '',
    'Recommended action:',
    diagnostic.recommendedAction,
    '',
    'Expected success evidence:',
    ...diagnostic.expectedSuccessEvidence.map(item => `- ${item}`),
    '',
  ]);

  return [
    '# Graph Waiver Closure Report',
    '',
    `Schema: ${report.schemaVersion}`,
    `Readiness: ${report.readiness}`,
    `Graph: ${report.graphStatus}`,
    `Validation: ${report.validationStatus}`,
    `Approval required: ${report.approvalRequired ? 'yes' : 'no'}`,
    `Waivers: ${report.waiverCount}`,
    '',
    '## Summary',
    '',
    ...Object.entries(report.summary.byDecision).map(
      ([decision, count]) => `${decision}: ${count}`
    ),
    '',
    ...rows,
  ].join('\n');
}

async function readManifest(cwd: string): Promise<{ repositories: ManifestRepository[] }> {
  const manifestPath = join(cwd, UPSTREAM_MANIFEST_PATH);
  try {
    const parsed = JSON.parse(await readFile(manifestPath, 'utf8')) as UpstreamManifest;
    return { repositories: Array.isArray(parsed.repositories) ? parsed.repositories : [] };
  } catch {
    return { repositories: [] };
  }
}

async function synthesizeMissingGraphArtifact(input: {
  cwd: string;
  repository: string;
  manifestRepo: ManifestRepository | undefined;
  graphArtifact: GraphWaiverArtifactDiagnostic;
}): Promise<GraphWaiverArtifactDiagnostic> {
  if (input.graphArtifact.status === 'malformed') {
    return {
      ...input.graphArtifact,
      message: `${input.graphArtifact.message} Missing graph synthesis rejected (existing_malformed_artifact): existing graph artifacts are never overridden by tracked waiver docs.`,
    };
  }
  if (input.graphArtifact.status !== 'missing') {
    return input.graphArtifact;
  }

  const evaluation = await evaluateMissingGraphSynthesis(input);
  if (!evaluation.canSynthesize) {
    return {
      ...input.graphArtifact,
      message: `${input.graphArtifact.message} Missing graph synthesis rejected (${evaluation.reason}): ${evaluation.message}`,
    };
  }

  return {
    ...input.graphArtifact,
    status: 'empty-waiver',
    graphStatus: 'waived',
    nodes: 0,
    edges: 0,
    message: `Graph artifact is missing from ignored research/graphs cache, but tracked evidence proves failed waiver-required graph evidence remains unresolved (${evaluation.reason}). ${evaluation.message}`,
  };
}

async function evaluateMissingGraphSynthesis(input: {
  cwd: string;
  repository: string;
  manifestRepo: ManifestRepository | undefined;
}): Promise<MissingGraphSynthesisEvaluation> {
  const expectedGraphPath = expectedGraphPathForRepository(input.repository);
  if (expectedGraphPath === null) {
    return synthesisFailure(
      'unsafe_path',
      `Repository name "${input.repository}" cannot form a safe repo-relative graph path.`
    );
  }

  if (input.manifestRepo?.name !== input.repository) {
    return synthesisFailure(
      'missing_manifest',
      `No manifest row in ${UPSTREAM_MANIFEST_PATH} exactly matches repository ${input.repository}.`
    );
  }
  if (input.manifestRepo.graphStatus !== 'failed' || input.manifestRepo.waiverRequired !== true) {
    return synthesisFailure(
      'contradictory_docs',
      `${UPSTREAM_MANIFEST_PATH} must record graphStatus=failed and waiverRequired=true for ${input.repository}.`
    );
  }

  const indexRow = await readGraphEvidenceIndexRow(input.cwd, input.repository);
  if (!indexRow.ok) return synthesisFailure(indexRow.reason, indexRow.message);
  const indexPathProblem = validateProofGraphPath(indexRow.row.graphPath, expectedGraphPath);
  if (indexPathProblem !== null)
    return synthesisFailure(indexPathProblem.reason, indexPathProblem.message);
  if (
    indexRow.row.graphStatus !== 'failed' ||
    indexRow.row.cloneStatus !== 'fetched' ||
    indexRow.row.nodes !== 0 ||
    indexRow.row.edges !== 0 ||
    indexRow.row.waiverRequired !== 'yes'
  ) {
    return synthesisFailure(
      'contradictory_docs',
      `${GRAPH_EVIDENCE_INDEX_PATH} must record failed/fetched/0 nodes/0 edges/waiver yes for ${input.repository}.`
    );
  }

  const waiverSection = await readWaiverDocSection(input.cwd, input.repository);
  if (!waiverSection.ok) return synthesisFailure(waiverSection.reason, waiverSection.message);
  const waiverPathProblem = validateProofGraphPath(
    waiverSection.section.graphPath,
    expectedGraphPath
  );
  if (waiverPathProblem !== null) {
    return synthesisFailure(waiverPathProblem.reason, waiverPathProblem.message);
  }
  if (waiverSection.section.status !== 'failed') {
    return synthesisFailure(
      'contradictory_docs',
      `${RESEARCH_WAIVERS_PATH} must record Status: failed for ${input.repository}.`
    );
  }

  return {
    canSynthesize: true,
    reason: 'documented_failed_waiver_required',
    message: `Proof sources: ${UPSTREAM_MANIFEST_PATH}, ${GRAPH_EVIDENCE_INDEX_PATH}, ${RESEARCH_WAIVERS_PATH}. Next action: approve a targeted graph evidence refresh before clearing the waiver.`,
  };
}

function synthesisFailure(
  reason: MissingGraphSynthesisFailureReason,
  message: string
): MissingGraphSynthesisEvaluation {
  return {
    canSynthesize: false,
    reason,
    message,
  };
}

async function readGraphEvidenceIndexRow(
  cwd: string,
  repository: string
): Promise<
  | { ok: true; row: GraphEvidenceIndexRow }
  | { ok: false; reason: MissingGraphSynthesisFailureReason; message: string }
> {
  const text = await readOptionalText(join(cwd, GRAPH_EVIDENCE_INDEX_PATH));
  if (text === null) {
    return {
      ok: false,
      reason: 'missing_index_row',
      message: `${GRAPH_EVIDENCE_INDEX_PATH} is missing.`,
    };
  }

  for (const line of text.split(/\r?\n/)) {
    const cells = parseMarkdownTableCells(line);
    if (cells === null || cells.length === 0) continue;
    if (cells[0] === 'Repository' || cells.every(cell => /^:?-{3,}:?$/.test(cell))) continue;
    if (cells[0] !== repository) continue;
    if (cells.length < 9) {
      return {
        ok: false,
        reason: 'malformed_docs',
        message: `${GRAPH_EVIDENCE_INDEX_PATH} row for ${repository} has ${cells.length} cells; expected at least 9.`,
      };
    }
    const nodes = parseStrictCount(cells[5]);
    const edges = parseStrictCount(cells[6]);
    if (nodes === null || edges === null) {
      return {
        ok: false,
        reason: 'malformed_docs',
        message: `${GRAPH_EVIDENCE_INDEX_PATH} row for ${repository} must use numeric node and edge counts.`,
      };
    }
    return {
      ok: true,
      row: {
        repository: cells[0],
        graphStatus: cells[1],
        cloneStatus: cells[2],
        nodes,
        edges,
        waiverRequired: cells[7],
        graphPath: cells[8],
      },
    };
  }

  return {
    ok: false,
    reason: 'missing_index_row',
    message: `${GRAPH_EVIDENCE_INDEX_PATH} has no row for ${repository}.`,
  };
}

async function readWaiverDocSection(
  cwd: string,
  repository: string
): Promise<
  | { ok: true; section: WaiverDocSection }
  | { ok: false; reason: MissingGraphSynthesisFailureReason; message: string }
> {
  const text = await readOptionalText(join(cwd, RESEARCH_WAIVERS_PATH));
  if (text === null) {
    return {
      ok: false,
      reason: 'missing_waiver_section',
      message: `${RESEARCH_WAIVERS_PATH} is missing.`,
    };
  }

  let inSection = false;
  let status: string | null = null;
  let graphPath: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      if (inSection) break;
      inSection = line.trim() === `## ${repository}`;
      continue;
    }
    if (!inSection) continue;
    const statusMatch = /^Status:\s*(.+)$/.exec(line);
    if (statusMatch) status = statusMatch[1]?.trim() ?? null;
    const graphPathMatch = /^Graph path:\s*(.+)$/.exec(line);
    if (graphPathMatch) graphPath = graphPathMatch[1]?.trim() ?? null;
  }

  if (!inSection) {
    return {
      ok: false,
      reason: 'missing_waiver_section',
      message: `${RESEARCH_WAIVERS_PATH} has no ## ${repository} section.`,
    };
  }
  if (status === null || graphPath === null) {
    return {
      ok: false,
      reason: 'malformed_docs',
      message: `${RESEARCH_WAIVERS_PATH} section for ${repository} must include Status and Graph path.`,
    };
  }

  return {
    ok: true,
    section: {
      repository,
      status,
      graphPath,
    },
  };
}

function parseMarkdownTableCells(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed
    .slice(1, -1)
    .split('|')
    .map(cell => cell.trim());
}

function parseStrictCount(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function expectedGraphPathForRepository(repository: string): string | null {
  if (!isSafeRepositoryName(repository)) return null;
  return `research/graphs/${repository}/graph.json`;
}

function isSafeRepositoryName(repository: string): boolean {
  return (
    repository.length > 0 &&
    !repository.includes('\0') &&
    !repository.includes('/') &&
    !repository.includes('\\') &&
    !repository.includes('..') &&
    !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(repository)
  );
}

function validateProofGraphPath(
  graphPath: string,
  expectedGraphPath: string
): { reason: MissingGraphSynthesisFailureReason; message: string } | null {
  if (
    graphPath.includes('\0') ||
    graphPath.startsWith('/') ||
    graphPath.includes('\\') ||
    graphPath.split('/').includes('..') ||
    /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(graphPath) ||
    !graphPath.startsWith('research/graphs/')
  ) {
    return {
      reason: 'unsafe_path',
      message: `Graph proof path "${graphPath}" must be a safe repo-relative path under research/graphs.`,
    };
  }
  if (
    graphPath.toLowerCase() === expectedGraphPath.toLowerCase() &&
    graphPath !== expectedGraphPath
  ) {
    return {
      reason: 'unsafe_path',
      message: `Graph proof path "${graphPath}" must match ${expectedGraphPath} with exact case.`,
    };
  }
  if (graphPath !== expectedGraphPath) {
    return {
      reason: 'contradictory_docs',
      message: `Graph proof path "${graphPath}" does not match expected path ${expectedGraphPath}.`,
    };
  }
  return null;
}

function statusToRepositoryStatus(
  graphStatus: GraphWaiverClosureReport['graphStatus'],
  waiver: GraphWaiver,
  manifestRepo: ManifestRepository | undefined
): GraphRepositoryStatus {
  return {
    name: waiver.repository,
    graphStatus: manifestRepo?.graphStatus ?? graphContextToGraphStatus(graphStatus),
    cloneStatus: manifestRepo?.cloneStatus ?? 'unknown',
    branch: null,
    commitSha: null,
    waiverRequired: manifestRepo?.waiverRequired ?? true,
    nodes: 0,
    edges: 0,
  };
}

function graphContextToGraphStatus(status: GraphWaiverClosureReport['graphStatus']): GraphStatus {
  if (status === 'available') return 'complete';
  if (status === 'unavailable') return 'not-started';
  if (status === 'forbidden') return 'failed';
  return 'waived';
}

async function inspectGraphArtifact(
  cwd: string,
  repository: string
): Promise<GraphWaiverArtifactDiagnostic> {
  const graphsRoot = resolve(cwd, 'research/graphs');
  const graphPath = resolve(graphsRoot, repository, 'graph.json');
  const metadataPath = resolve(graphsRoot, repository, 'graph-metadata.json');
  const reportPath = resolve(graphsRoot, repository, 'GRAPH_REPORT.md');
  const base = {
    path: relativeFromCwd(cwd, graphPath),
    metadataPath: relativeFromCwd(cwd, metadataPath),
    reportPath: relativeFromCwd(cwd, reportPath),
  };

  if (!isPathInside(graphsRoot, graphPath)) {
    return {
      ...base,
      status: 'malformed',
      graphStatus: 'unknown',
      nodes: 0,
      edges: 0,
      message: 'Graph artifact path escapes research/graphs.',
    };
  }

  const graphText = await readOptionalText(graphPath);
  if (graphText === null) {
    return {
      ...base,
      status: 'missing',
      graphStatus: 'unknown',
      nodes: 0,
      edges: 0,
      message: 'Graph artifact is missing.',
    };
  }

  let parsed: GraphFileShape;
  try {
    parsed = JSON.parse(graphText) as GraphFileShape;
  } catch (error) {
    return {
      ...base,
      status: 'malformed',
      graphStatus: 'unknown',
      nodes: 0,
      edges: 0,
      message: `Graph artifact is not valid JSON: ${messageFromError(error)}`,
    };
  }

  const graphStatus = typeof parsed.graphStatus === 'string' ? parsed.graphStatus : 'unknown';
  const nodes = countCollection(parsed.nodes);
  const edges = countCollection(parsed.edges);
  return {
    ...base,
    status: classifyArtifact(graphStatus, nodes, edges),
    graphStatus,
    nodes,
    edges,
    message: artifactMessage(graphStatus, nodes, edges, parsed.reason),
  };
}

function classifyArtifact(
  graphStatus: string,
  nodes: number,
  edges: number
): GraphWaiverArtifactStatus {
  if (nodes > 0 || edges > 0) return 'valid';
  if (graphStatus === 'complete') return 'empty-complete';
  if (graphStatus === 'waived') return 'empty-waiver';
  return 'empty-waiver';
}

function artifactMessage(
  graphStatus: string,
  nodes: number,
  edges: number,
  reason: unknown
): string {
  if (nodes > 0 || edges > 0) return 'Graph artifact contains graph evidence.';
  const suffix = typeof reason === 'string' && reason.length > 0 ? ` Reason: ${reason}` : '';
  if (graphStatus === 'complete') return `Graph artifact is complete but empty.${suffix}`;
  return `Graph artifact is an empty waiver graph.${suffix}`;
}

async function buildFailureSummary(
  cwd: string,
  repository: string,
  manifestRepo: ManifestRepository | undefined
): Promise<string> {
  const graphsRoot = resolve(cwd, 'research/graphs');
  const graphDir = resolve(graphsRoot, repository);
  if (!isPathInside(graphsRoot, graphDir)) {
    return 'Graph artifact path escapes research/graphs.';
  }
  const metadata = await readJson<GraphMetadataShape>(join(graphDir, 'graph-metadata.json'));
  const report = await readOptionalText(join(graphDir, 'GRAPH_REPORT.md'));
  const parts = [
    manifestRepo?.error ?? null,
    typeof metadata?.error === 'string' ? metadata.error : null,
    report ? compactText(report) : null,
  ].filter((part): part is string => part !== null && part.trim().length > 0);
  return parts.length > 0 ? redact(parts.join(' | ')) : 'No failure detail was found.';
}

function decideClosure(
  repositoryStatus: GraphRepositoryStatus | undefined,
  manifestRepo: ManifestRepository | undefined,
  graphArtifact: GraphWaiverArtifactDiagnostic
): GraphWaiverClosureDecision {
  if (repositoryStatus?.graphStatus === 'complete' && graphArtifact.status === 'valid') {
    return 'cleared';
  }
  if (graphArtifact.status === 'missing' || graphArtifact.status === 'malformed') {
    return 'manual_action_required';
  }
  if (graphArtifact.status === 'empty-waiver') {
    return 'unresolved';
  }
  if (repositoryStatus?.graphStatus === 'not-started' && manifestRepo?.cloneStatus === 'fetched') {
    return 'rebuild_available';
  }
  if (repositoryStatus?.graphStatus === 'waived') {
    return 'justified_waiver';
  }
  return 'unresolved';
}

function buildDiagnostic(input: {
  waiver: GraphWaiver;
  manifestRepo: ManifestRepository | undefined;
  repositoryStatus: GraphRepositoryStatus | undefined;
  graphArtifact: GraphWaiverArtifactDiagnostic;
  failureSummary: string;
  affectedLedgerRows: string[];
  decision: GraphWaiverClosureDecision;
}): GraphWaiverClosureDiagnostic {
  const approvalRequired = input.decision !== 'cleared';
  return {
    waiverId: redact(input.waiver.id),
    repository: redact(input.waiver.repository),
    owner: redact(input.waiver.owner),
    graphStatus:
      input.repositoryStatus?.graphStatus ?? input.manifestRepo?.graphStatus ?? 'unknown',
    cloneStatus:
      input.repositoryStatus?.cloneStatus ?? input.manifestRepo?.cloneStatus ?? 'unknown',
    waiverRequired:
      input.repositoryStatus?.waiverRequired ?? input.manifestRepo?.waiverRequired ?? true,
    reason: redact(input.waiver.reason),
    evidence: redact(input.waiver.evidence),
    expiryCondition: redact(input.waiver.expiryCondition),
    graphArtifact: {
      ...input.graphArtifact,
      message: redact(input.graphArtifact.message),
    },
    failureSummary: redact(input.failureSummary),
    affectedLedgerRows: input.affectedLedgerRows,
    decision: input.decision,
    diagnosis: diagnosisFor(input.decision, input.graphArtifact),
    recommendedAction: recommendedActionFor(input.decision, input.waiver.repository),
    recommendedCommands: approvalRequired ? recommendedCommands(input.waiver.repository) : [],
    expectedSuccessEvidence: expectedSuccessEvidence(input.waiver.repository),
    approvalStatus: approvalRequired ? 'approval_required' : 'not_required',
  };
}

function diagnosisFor(
  decision: GraphWaiverClosureDecision,
  artifact: GraphWaiverArtifactDiagnostic
): string {
  if (decision === 'cleared') return 'Graph evidence is complete and non-empty.';
  if (artifact.status === 'empty-waiver') {
    return 'Graph build produced an empty waiver graph, so graph evidence remains unresolved.';
  }
  if (artifact.status === 'missing') return 'Graph artifact is missing.';
  if (artifact.status === 'malformed') return 'Graph artifact cannot be parsed safely.';
  if (decision === 'justified_waiver')
    return 'Waiver remains explicit and reviewer approval is required.';
  return 'Graph evidence requires bounded follow-up before readiness can improve.';
}

function recommendedActionFor(decision: GraphWaiverClosureDecision, repository: string): string {
  if (decision === 'cleared') {
    return 'No waiver action is required for this repository.';
  }
  if (decision === 'manual_action_required') {
    return `Inspect ${repository} graph artifacts and manifest state, then approve a targeted graph rebuild if the repository should remain in required evidence.`;
  }
  if (decision === 'justified_waiver') {
    return `Keep ${repository} as an explicit waiver only after reviewer approval records why graph evidence is not required for the current architecture decision.`;
  }
  return `Approve and run a targeted graph evidence refresh for ${repository}, then re-render graph evidence docs and verify status before clearing the waiver.`;
}

function recommendedCommands(repository: string): GraphWaiverClosureCommand[] {
  return [
    {
      command: 'bun scripts/research/graph-upstreams.ts --mode required --force',
      safety: 'writes-tracked-files',
      requiresApproval: true,
      willRun: false,
      reason: `Regenerates graph evidence and manifest state; needed before ${repository} waiver can be cleared.`,
    },
    {
      command: 'bun scripts/research/render-graph-evidence-docs.ts',
      safety: 'writes-tracked-files',
      requiresApproval: true,
      willRun: false,
      reason: 'Re-renders tracked graph evidence docs after graph status changes.',
    },
  ];
}

function expectedSuccessEvidence(repository: string): string[] {
  return [
    `research/graphs/${repository}/graph.json contains non-empty graph evidence.`,
    `research/graphs/${repository}/graph-metadata.json records graphStatus=complete.`,
    `docs/context-orchestrator/research/upstream-manifest.json records ${repository} graphStatus=complete and waiverRequired=false.`,
    'bun run cli context status --cwd . --json no longer reports this waiver as failed graph evidence.',
  ];
}

function affectedLedgerRows(rows: LedgerRow[], waiver: GraphWaiver): string[] {
  return rows
    .filter(
      row =>
        row.sourceEvidence.includes(waiver.id) ||
        row.notes.includes(waiver.id) ||
        row.sourceEvidence.includes(waiver.repository) ||
        row.notes.includes(waiver.repository)
    )
    .map(row => row.id)
    .sort();
}

function summarizeDiagnostics(
  diagnostics: GraphWaiverClosureDiagnostic[]
): GraphWaiverClosureReport['summary'] {
  const byDecision: Record<GraphWaiverClosureDecision, number> = {
    unresolved: 0,
    rebuild_available: 0,
    manual_action_required: 0,
    justified_waiver: 0,
    cleared: 0,
  };
  for (const diagnostic of diagnostics) {
    byDecision[diagnostic.decision] += 1;
  }
  return {
    total: diagnostics.length,
    byDecision,
    approvalRequired: diagnostics.some(
      diagnostic => diagnostic.approvalStatus === 'approval_required'
    ),
  };
}

async function readJson<T>(path: string): Promise<T | null> {
  const text = await readOptionalText(path);
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function readOptionalText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return null;
    return null;
  }
}

function countCollection(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (value !== null && typeof value === 'object') return Object.keys(value).length;
  return 0;
}

function compactText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 300);
}

function relativeFromCwd(cwd: string, path: string): string {
  const relativePath = relative(cwd, path);
  return relativePath.startsWith('..') ? path : relativePath;
}

function redact(value: string): string {
  return redactSecrets(value);
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNodeError(error: unknown): error is Error & { code?: string } {
  return error instanceof Error && 'code' in error;
}
