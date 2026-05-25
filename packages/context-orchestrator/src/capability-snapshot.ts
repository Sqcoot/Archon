import { readdir, readFile } from 'fs/promises';
import { basename, extname, join, relative } from 'path';
import { routeBmad } from './bmad';
import { planDocumentation } from './docs';
import { getGraphContext } from './graph';
import { redactSecrets } from './security';
import type { DocumentationPlan, GraphContext } from './types';

export const CAPABILITY_SNAPSHOT_SCHEMA_VERSION = 'aco.capability-snapshot.v1' as const;
export const ACO_BOOTSTRAP_CONTEXT_SCHEMA_VERSION = 'aco.bootstrap-context.v1' as const;

export const acoBootstrapEvents = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'PreCompact',
  'PostCompact',
  'SubagentStart',
  'SubagentStop',
  'Stop',
] as const;

export type AcoBootstrapEvent = (typeof acoBootstrapEvents)[number];
export type AcoGoalStatus = 'complete' | 'incomplete' | 'unknown';
export type CapabilityClaimStatus = 'verified' | 'unknown' | 'blocked' | 'deferred';
export type CapabilityDomainStatus = 'available' | 'unknown' | 'blocked' | 'deferred';
export type CapabilityConfidence = 'high' | 'medium' | 'low' | 'unknown';
export type CapabilitySourceKind =
  | 'adapter'
  | 'command'
  | 'file'
  | 'graph'
  | 'ledger'
  | 'manifest'
  | 'mcp'
  | 'plugin'
  | 'unknown';
export type CapabilityRegistration = 'adapter' | 'ledger' | 'manifest' | 'mcp' | 'plugin';

export interface CapabilityBudget {
  maxBytes: number;
  estimatedBytes: number;
  purpose: string;
}

export interface CapabilitySourceRef {
  id: string;
  kind: CapabilitySourceKind;
  path?: string;
  description: string;
  safeToInject: boolean;
}

export interface CapabilityEvidenceClaim {
  id: string;
  subject: string;
  status: CapabilityClaimStatus;
  confidence: CapabilityConfidence;
  verificationSource: string;
  sourceArtifact?: string;
  command?: string;
  lastVerifiedAt?: string;
  safeToInject: boolean;
  budget: CapabilityBudget;
  summary: string;
}

export interface CapabilityItem {
  id: string;
  label: string;
  category: string;
  status: CapabilityClaimStatus;
  confidence: CapabilityConfidence;
  registration: CapabilityRegistration;
  sourceRef: string;
  sourceArtifact?: string;
  command?: string;
  safeToInject: boolean;
  summary: string;
  budget: CapabilityBudget;
}

export interface CapabilityDomainCoverage {
  id: string;
  label: string;
  status: CapabilityDomainStatus;
  evidence: string[];
  summary: string;
}

export interface CapabilityRisk {
  id: string;
  status: Exclude<CapabilityClaimStatus, 'verified'>;
  summary: string;
  sourceRef: string;
}

export interface CapabilityGraphSnapshot {
  status: GraphContext['status'];
  waiverCount: number;
  repositories: {
    name: string;
    graphStatus: string;
    waiverRequired: boolean;
    nodes: number;
    edges: number;
  }[];
  sourceRef: string;
  summary: string;
}

export interface CapabilitySnapshot {
  schemaVersion: typeof CAPABILITY_SNAPSHOT_SCHEMA_VERSION;
  generatedAt: string;
  sourceRefs: CapabilitySourceRef[];
  providers: CapabilityItem[];
  commands: CapabilityItem[];
  workflows: CapabilityItem[];
  mcpServers: CapabilityItem[];
  plugins: CapabilityItem[];
  hooks: CapabilityItem[];
  roles: CapabilityItem[];
  ledgers: CapabilityItem[];
  artifacts: CapabilityItem[];
  graph: CapabilityGraphSnapshot;
  docsTargets: CapabilityItem[];
  risks: CapabilityRisk[];
  unknowns: CapabilityRisk[];
  evidenceClaims: CapabilityEvidenceClaim[];
  domains: CapabilityDomainCoverage[];
}

export interface BuildCapabilitySnapshotOptions {
  cwd: string;
  prompt?: string;
  timestamp?: string;
  graphContext?: GraphContext;
  documentationPlan?: DocumentationPlan;
}

export interface BuildAcoBootstrapContextOptions extends BuildCapabilitySnapshotOptions {
  prompt: string;
  event: AcoBootstrapEvent;
  maxBytes: number;
  goalStatus?: AcoGoalStatus;
  nextGoalObjective?: string;
  snapshot?: CapabilitySnapshot;
}

export interface AcoBootstrapContinuation {
  required: boolean;
  reason: string;
  nextGoal?: string;
}

export interface AcoBootstrapContextJson {
  event: AcoBootstrapEvent;
  route: {
    id: string;
    steps: string[];
  };
  snapshot: {
    schemaVersion: CapabilitySnapshot['schemaVersion'];
    generatedAt: string;
    counts: Record<string, number>;
    unknowns: string[];
    risks: string[];
    evidenceClaims: number;
  };
  eventGuidance: string[];
  guards: string[];
  artifacts: string[];
  continuation: AcoBootstrapContinuation;
}

export interface AcoBootstrapContext {
  schemaVersion: typeof ACO_BOOTSTRAP_CONTEXT_SCHEMA_VERSION;
  generatedAt: string;
  event: AcoBootstrapEvent;
  maxBytes: number;
  truncated: boolean;
  markdown: string;
  json: AcoBootstrapContextJson;
}

type CapabilitySection =
  | 'providers'
  | 'commands'
  | 'workflows'
  | 'mcpServers'
  | 'plugins'
  | 'hooks'
  | 'roles'
  | 'ledgers'
  | 'artifacts'
  | 'docsTargets';

type ManifestArrayKey = Exclude<CapabilitySection, 'hooks' | 'roles' | 'docsTargets'>;

type CapabilityCollections = Record<CapabilitySection, CapabilityItem[]>;

interface CollectedFile {
  absolutePath: string;
  relativePath: string;
}

interface SnapshotDraft {
  cwd: string;
  generatedAt: string;
  sourceRefs: CapabilitySourceRef[];
  claims: CapabilityEvidenceClaim[];
  risks: CapabilityRisk[];
  unknowns: CapabilityRisk[];
  collections: CapabilityCollections;
}

interface ManifestCapability {
  id?: unknown;
  label?: unknown;
  summary?: unknown;
  status?: unknown;
  confidence?: unknown;
}

const manifestKeys = [
  'providers',
  'commands',
  'workflows',
  'mcpServers',
  'plugins',
  'ledgers',
  'artifacts',
] as const satisfies readonly ManifestArrayKey[];

const textEncoder = new TextEncoder();

export async function buildCapabilitySnapshot(
  options: BuildCapabilitySnapshotOptions
): Promise<CapabilitySnapshot> {
  const generatedAt = options.timestamp ?? new Date().toISOString();
  const prompt = redactSecrets(options.prompt ?? '');
  const graphContext = options.graphContext ?? (await getGraphContext({ cwd: options.cwd }));
  const documentationPlan = options.documentationPlan ?? planDocumentation({ prompt });
  const draft: SnapshotDraft = {
    cwd: options.cwd,
    generatedAt,
    sourceRefs: [],
    claims: [],
    risks: [],
    unknowns: [],
    collections: emptyCollections(),
  };

  await adaptCodexStructure(draft);
  await adaptCapabilityManifests(draft);
  await adaptPackageScripts(draft);
  await adaptArchonCommands(draft);
  await adaptArchonWorkflows(draft);
  await adaptArchonLedgersAndArtifacts(draft);
  await adaptBmadRoles(draft);
  await adaptProviderRegistry(draft);
  await adaptMcpEvidence(draft);
  adaptGraphEvidence(draft, graphContext);
  adaptDocumentationTargets(draft, documentationPlan);

  return {
    schemaVersion: CAPABILITY_SNAPSHOT_SCHEMA_VERSION,
    generatedAt,
    sourceRefs: sortById(draft.sourceRefs),
    providers: sortById(draft.collections.providers),
    commands: sortById(draft.collections.commands),
    workflows: sortById(draft.collections.workflows),
    mcpServers: sortById(draft.collections.mcpServers),
    plugins: sortById(draft.collections.plugins),
    hooks: sortById(draft.collections.hooks),
    roles: sortById(draft.collections.roles),
    ledgers: sortById(draft.collections.ledgers),
    artifacts: sortById(draft.collections.artifacts),
    graph: toGraphSnapshot(draft, graphContext),
    docsTargets: sortById(draft.collections.docsTargets),
    risks: sortById(draft.risks),
    unknowns: sortById(draft.unknowns),
    evidenceClaims: sortById(draft.claims),
    domains: buildDomainCoverage(draft, graphContext),
  };
}

export async function buildAcoBootstrapContext(
  options: BuildAcoBootstrapContextOptions
): Promise<AcoBootstrapContext> {
  const generatedAt = options.timestamp ?? new Date().toISOString();
  const prompt = redactSecrets(options.prompt);
  const snapshot =
    options.snapshot ??
    (await buildCapabilitySnapshot({
      cwd: options.cwd,
      prompt,
      timestamp: generatedAt,
      graphContext: options.graphContext,
      documentationPlan: options.documentationPlan,
    }));
  const route = routeBmad({ prompt });
  const eventGuidance = eventGuidanceFor(options.event);
  const guards = guardrailsFor(options.event);
  const continuation = continuationFor(options.event, prompt, options);
  const json: AcoBootstrapContextJson = {
    event: options.event,
    route: {
      id: route.id,
      steps: route.steps,
    },
    snapshot: {
      schemaVersion: snapshot.schemaVersion,
      generatedAt: snapshot.generatedAt,
      counts: snapshotCounts(snapshot),
      unknowns: snapshot.unknowns.map(item => item.id),
      risks: snapshot.risks.map(item => item.id),
      evidenceClaims: snapshot.evidenceClaims.length,
    },
    eventGuidance,
    guards,
    artifacts: [
      'capability-snapshot.json',
      'aco-bootstrap-context.json',
      'aco-bootstrap-context.md',
      'tool-availability-ledger.json',
      'commands-ledger.json',
      'decision-dossier.json',
    ],
    continuation,
  };
  const markdown = renderBootstrapMarkdown({
    cwd: options.cwd,
    prompt,
    event: options.event,
    generatedAt,
    snapshot,
    json,
  });
  const limited = limitBytes(markdown, options.maxBytes);

  return {
    schemaVersion: ACO_BOOTSTRAP_CONTEXT_SCHEMA_VERSION,
    generatedAt,
    event: options.event,
    maxBytes: options.maxBytes,
    truncated: limited.truncated,
    markdown: limited.text,
    json,
  };
}

function emptyCollections(): CapabilityCollections {
  return {
    providers: [],
    commands: [],
    workflows: [],
    mcpServers: [],
    plugins: [],
    hooks: [],
    roles: [],
    ledgers: [],
    artifacts: [],
    docsTargets: [],
  };
}

async function adaptCodexStructure(draft: SnapshotDraft): Promise<void> {
  const sourceRef = addSourceRef(draft, {
    kind: 'adapter',
    description: 'Read-only Codex lifecycle adapter; active user config intentionally not read.',
    safeToInject: true,
  });

  for (const event of acoBootstrapEvents) {
    addItem(draft, 'hooks', {
      id: `hook.${event}`,
      label: event,
      category: 'codex-lifecycle',
      status: 'deferred',
      confidence: 'medium',
      registration: 'adapter',
      sourceRef,
      safeToInject: true,
      summary: `Lifecycle context is available as bootstrap sidecar for ${event}; active hook installation remains approval-gated.`,
    });
  }

  addUnknown(
    draft,
    'codex.active-config',
    'Active user-level Codex config and hooks are not read by this slice.',
    sourceRef
  );
  addClaim(draft, {
    id: 'claim.codex.active-config',
    subject: 'Codex active config and hook installation',
    status: 'unknown',
    confidence: 'unknown',
    verificationSource: 'unknown',
    safeToInject: false,
    summary: 'Active user-level config is intentionally outside this read-only adapter.',
  });

  await Promise.resolve();
}

async function adaptCapabilityManifests(draft: SnapshotDraft): Promise<void> {
  const files = [
    ...(await collectFiles(draft.cwd, '.archon/capabilities', ['.json'], 50)),
    ...(await collectFiles(draft.cwd, 'docs/context-orchestrator/capabilities', ['.json'], 50)),
  ];

  if (files.length === 0) {
    const sourceRef = addSourceRef(draft, {
      kind: 'manifest',
      description: 'Capability manifest directory not present.',
      safeToInject: true,
    });
    addUnknown(
      draft,
      'capability-manifest.none',
      'No committed capability manifest was found.',
      sourceRef
    );
    return;
  }

  for (const file of files) {
    const parsed = await readJsonFile(file.absolutePath);
    const sourceArtifact = file.relativePath;
    const sourceRef = addSourceRef(draft, {
      kind: 'manifest',
      path: sourceArtifact,
      description: `Capability manifest ${sourceArtifact}`,
      safeToInject: true,
    });
    if (!isRecord(parsed)) {
      addRisk(draft, `capability-manifest.invalid.${slug(sourceArtifact)}`, 'blocked', sourceRef);
      continue;
    }

    for (const key of manifestKeys) {
      const value = parsed[key];
      if (!Array.isArray(value)) continue;
      for (const entry of value) {
        if (!isRecord(entry) || typeof entry.id !== 'string') continue;
        const capability = manifestCapability(entry);
        addItem(draft, key, {
          id: capability.id,
          label: capability.label,
          category: 'manifest',
          status: capability.status,
          confidence: capability.confidence,
          registration: 'manifest',
          sourceRef,
          sourceArtifact,
          safeToInject: true,
          summary: capability.summary,
        });
      }
    }
  }
}

async function adaptPackageScripts(draft: SnapshotDraft): Promise<void> {
  const packagePath = join(draft.cwd, 'package.json');
  const parsed = await readJsonFile(packagePath);
  const sourceRef = addSourceRef(draft, {
    kind: 'file',
    path: 'package.json',
    description: 'Root package scripts.',
    safeToInject: true,
  });
  if (!isRecord(parsed) || !isRecord(parsed.scripts)) {
    addUnknown(draft, 'package-scripts', 'Root package scripts unavailable.', sourceRef);
    return;
  }

  for (const [name, command] of Object.entries(parsed.scripts).slice(0, 80)) {
    if (typeof command !== 'string') continue;
    const isAco = name.startsWith('aco:') || name === 'cli' || name === 'validate';
    if (!isAco) continue;
    addItem(draft, 'commands', {
      id: `script.${name}`,
      label: `bun run ${name}`,
      category: 'package-script',
      status: 'verified',
      confidence: 'high',
      registration: 'adapter',
      sourceRef,
      sourceArtifact: 'package.json',
      command: `bun run ${name}`,
      safeToInject: true,
      summary: `Package script registered for ${name}.`,
    });
  }
}

async function adaptArchonCommands(draft: SnapshotDraft): Promise<void> {
  const files = await collectFiles(draft.cwd, '.archon/commands', ['.md'], 100);
  for (const file of files) {
    const name = basename(file.relativePath, extname(file.relativePath));
    const sourceRef = addSourceRef(draft, {
      kind: 'file',
      path: file.relativePath,
      description: `Archon command ${name}.`,
      safeToInject: true,
    });
    addItem(draft, 'commands', {
      id: `archon.command.${slug(name)}`,
      label: name,
      category: 'archon-command',
      status: 'verified',
      confidence: 'high',
      registration: 'adapter',
      sourceRef,
      sourceArtifact: file.relativePath,
      safeToInject: true,
      summary: `Archon command discovered at ${file.relativePath}.`,
    });
  }
}

async function adaptArchonWorkflows(draft: SnapshotDraft): Promise<void> {
  const files = await collectFiles(draft.cwd, '.archon/workflows', ['.yaml', '.yml'], 100);
  for (const file of files) {
    const text = await readTextFile(file.absolutePath);
    const name = extractYamlName(text) ?? basename(file.relativePath, extname(file.relativePath));
    const sourceRef = addSourceRef(draft, {
      kind: 'file',
      path: file.relativePath,
      description: `Archon workflow ${name}.`,
      safeToInject: true,
    });
    addItem(draft, 'workflows', {
      id: `workflow.${slug(name)}`,
      label: name,
      category: 'archon-workflow',
      status: 'verified',
      confidence: 'high',
      registration: 'adapter',
      sourceRef,
      sourceArtifact: file.relativePath,
      safeToInject: true,
      summary: `Archon workflow discovered at ${file.relativePath}.`,
    });
  }
}

async function adaptArchonLedgersAndArtifacts(draft: SnapshotDraft): Promise<void> {
  const stateLedgers = await collectFiles(draft.cwd, '.archon/state', ['.json'], 30);
  const artifactLedgers = await collectFiles(
    draft.cwd,
    '.archon/artifacts/context-orchestrator',
    ['.json'],
    60
  );
  const files = [...stateLedgers, ...artifactLedgers].filter(file =>
    /ledger|manifest|evidence|handoff|snapshot|bootstrap/i.test(file.relativePath)
  );

  for (const file of files.slice(0, 60)) {
    const kind = /ledger/i.test(file.relativePath) ? 'ledgers' : 'artifacts';
    const sourceRef = addSourceRef(draft, {
      kind: kind === 'ledgers' ? 'ledger' : 'file',
      path: file.relativePath,
      description: `ACO ${kind === 'ledgers' ? 'ledger' : 'artifact'} ${file.relativePath}.`,
      safeToInject: true,
    });
    addItem(draft, kind, {
      id: `${kind === 'ledgers' ? 'ledger' : 'artifact'}.${slug(file.relativePath)}`,
      label: basename(file.relativePath),
      category: kind === 'ledgers' ? 'aco-ledger' : 'aco-artifact',
      status: 'verified',
      confidence: 'medium',
      registration: kind === 'ledgers' ? 'ledger' : 'adapter',
      sourceRef,
      sourceArtifact: file.relativePath,
      safeToInject: true,
      summary: `${kind === 'ledgers' ? 'Ledger' : 'Artifact'} discovered at ${file.relativePath}.`,
    });
  }
}

async function adaptBmadRoles(draft: SnapshotDraft): Promise<void> {
  const manifestPath = join(draft.cwd, '_bmad/_config/manifest.yaml');
  const skillManifestPath = join(draft.cwd, '_bmad/_config/skill-manifest.csv');
  const manifest = await readTextFile(manifestPath);
  if (manifest !== null) {
    const sourceRef = addSourceRef(draft, {
      kind: 'manifest',
      path: '_bmad/_config/manifest.yaml',
      description: 'BMAD installation manifest.',
      safeToInject: true,
    });
    addItem(draft, 'plugins', {
      id: 'plugin.bmad',
      label: 'BMAD',
      category: 'bmad',
      status: 'verified',
      confidence: 'high',
      registration: 'manifest',
      sourceRef,
      sourceArtifact: '_bmad/_config/manifest.yaml',
      safeToInject: true,
      summary: 'BMAD installation manifest is present.',
    });
  }

  const skills = await readTextFile(skillManifestPath);
  if (skills === null) {
    const sourceRef = addSourceRef(draft, {
      kind: 'manifest',
      path: '_bmad/_config/skill-manifest.csv',
      description: 'BMAD skill manifest missing.',
      safeToInject: true,
    });
    addUnknown(draft, 'bmad.roles', 'BMAD skill manifest unavailable.', sourceRef);
    return;
  }

  const sourceRef = addSourceRef(draft, {
    kind: 'manifest',
    path: '_bmad/_config/skill-manifest.csv',
    description: 'BMAD skill/role manifest.',
    safeToInject: true,
  });
  for (const row of parseCsv(skills).slice(0, 80)) {
    const canonicalId = row.canonicalId;
    if (!canonicalId?.startsWith('bmad-')) continue;
    const roleLike = canonicalId.includes('agent') || canonicalId.includes('review');
    addItem(draft, roleLike ? 'roles' : 'workflows', {
      id: canonicalId,
      label: row.name ?? canonicalId,
      category: roleLike ? 'bmad-role' : 'bmad-skill',
      status: 'verified',
      confidence: 'high',
      registration: 'manifest',
      sourceRef,
      sourceArtifact: '_bmad/_config/skill-manifest.csv',
      safeToInject: true,
      summary: row.description ?? `BMAD capability ${canonicalId}.`,
    });
  }
}

async function adaptProviderRegistry(draft: SnapshotDraft): Promise<void> {
  const files = await collectFiles(draft.cwd, 'packages/providers/src', ['.ts'], 120);
  for (const file of files.filter(item => item.relativePath.endsWith('/capabilities.ts'))) {
    const parts = file.relativePath.split('/');
    const providerName = parts.at(-2) ?? basename(file.relativePath, '.ts');
    const sourceRef = addSourceRef(draft, {
      kind: 'file',
      path: file.relativePath,
      description: `Provider capability source for ${providerName}.`,
      safeToInject: true,
    });
    addItem(draft, 'providers', {
      id: `provider.${slug(providerName)}`,
      label: providerName,
      category: 'provider-registry',
      status: 'verified',
      confidence: 'medium',
      registration: 'adapter',
      sourceRef,
      sourceArtifact: file.relativePath,
      safeToInject: true,
      summary: `Provider capabilities discovered at ${file.relativePath}.`,
    });
  }
}

async function adaptMcpEvidence(draft: SnapshotDraft): Promise<void> {
  const sourcePath = 'packages/providers/src/mcp/config.ts';
  const text = await readTextFile(join(draft.cwd, sourcePath));
  const sourceRef = addSourceRef(draft, {
    kind: 'mcp',
    path: sourcePath,
    description: 'Committed MCP configuration source.',
    safeToInject: true,
  });
  if (text === null) {
    addUnknown(
      draft,
      'mcp.committed-config',
      'Committed MCP config source unavailable.',
      sourceRef
    );
    return;
  }

  addItem(draft, 'mcpServers', {
    id: 'mcp.committed-config',
    label: 'Committed MCP config',
    category: 'mcp-registry',
    status: 'verified',
    confidence: 'medium',
    registration: 'mcp',
    sourceRef,
    sourceArtifact: sourcePath,
    safeToInject: true,
    summary: 'Committed MCP config source is present; active OAuth state is not read.',
  });
  addUnknown(draft, 'mcp.oauth-state', 'MCP OAuth state intentionally not read.', sourceRef);
}

function adaptGraphEvidence(draft: SnapshotDraft, graphContext: GraphContext): void {
  const sourceArtifact = 'docs/context-orchestrator/research/upstream-manifest.json';
  const sourceRef = addSourceRef(draft, {
    kind: 'graph',
    path: sourceArtifact,
    description: 'Committed graph evidence manifest.',
    safeToInject: true,
  });
  addClaim(draft, {
    id: 'claim.graph.evidence',
    subject: 'Committed graph evidence',
    status: graphContext.status === 'unavailable' ? 'unknown' : 'verified',
    confidence: graphContext.status === 'available' ? 'high' : 'medium',
    verificationSource: sourceRef,
    sourceArtifact,
    safeToInject: true,
    summary: graphContext.summary,
  });
  if (graphContext.waiverCount > 0) {
    addRisk(
      draft,
      'graph.waivers-present',
      'deferred',
      sourceRef,
      `Graph waivers present: ${String(graphContext.waiverCount)}. Refresh remains approval-gated.`
    );
  }
}

function adaptDocumentationTargets(
  draft: SnapshotDraft,
  documentationPlan: DocumentationPlan
): void {
  const sourceRef = addSourceRef(draft, {
    kind: 'adapter',
    description: 'Context7/docs target planner.',
    safeToInject: true,
  });
  addItem(draft, 'mcpServers', {
    id: 'mcp.context7',
    label: 'Context7',
    category: 'docs-mcp',
    status: documentationPlan.readiness.context7 === 'verified_available' ? 'verified' : 'unknown',
    confidence: documentationPlan.readiness.context7 === 'verified_available' ? 'high' : 'unknown',
    registration: 'mcp',
    sourceRef,
    safeToInject: true,
    summary: `Context7 readiness: ${documentationPlan.readiness.context7}.`,
  });

  for (const target of documentationPlan.targets) {
    const status = target.status === 'resolved' ? 'verified' : 'unknown';
    addItem(draft, 'docsTargets', {
      id: `docs.${slug(target.source)}.${slug(target.topic)}`,
      label: target.topic,
      category: target.source,
      status,
      confidence: status === 'verified' ? 'medium' : 'unknown',
      registration: 'adapter',
      sourceRef,
      safeToInject: true,
      summary: target.reason,
    });
  }
}

function toGraphSnapshot(
  draft: SnapshotDraft,
  graphContext: GraphContext
): CapabilityGraphSnapshot {
  const sourceRef =
    draft.sourceRefs.find(
      ref => ref.path === 'docs/context-orchestrator/research/upstream-manifest.json'
    )?.id ??
    addSourceRef(draft, {
      kind: 'graph',
      path: 'docs/context-orchestrator/research/upstream-manifest.json',
      description: 'Committed graph evidence manifest.',
      safeToInject: true,
    });
  return {
    status: graphContext.status,
    waiverCount: graphContext.waiverCount,
    repositories: graphContext.repositories.map(repository => ({
      name: repository.name,
      graphStatus: repository.graphStatus,
      waiverRequired: repository.waiverRequired,
      nodes: repository.nodes,
      edges: repository.edges,
    })),
    sourceRef,
    summary: graphContext.summary,
  };
}

function addItem(
  draft: SnapshotDraft,
  section: CapabilitySection,
  item: Omit<CapabilityItem, 'budget'>
): void {
  const safeSummary = redactSecrets(item.summary);
  const normalized: CapabilityItem = {
    ...item,
    label: redactSecrets(item.label),
    summary: safeSummary,
    sourceArtifact:
      item.sourceArtifact === undefined ? undefined : redactSecrets(item.sourceArtifact),
    command: item.command === undefined ? undefined : redactSecrets(item.command),
    budget: budgetFor(`${item.id} ${item.label} ${safeSummary}`),
  };
  draft.collections[section].push(normalized);
  addClaim(draft, {
    id: `claim.${slug(section)}.${slug(item.id)}`,
    subject: item.label,
    status: item.status,
    confidence: item.confidence,
    verificationSource: item.sourceRef,
    sourceArtifact: item.sourceArtifact,
    command: item.command,
    safeToInject: item.safeToInject,
    summary: safeSummary,
  });
}

function addClaim(draft: SnapshotDraft, claim: Omit<CapabilityEvidenceClaim, 'budget'>): void {
  const summary = redactSecrets(claim.summary);
  draft.claims.push({
    ...claim,
    subject: redactSecrets(claim.subject),
    verificationSource: redactSecrets(claim.verificationSource),
    sourceArtifact:
      claim.sourceArtifact === undefined ? undefined : redactSecrets(claim.sourceArtifact),
    command: claim.command === undefined ? undefined : redactSecrets(claim.command),
    summary,
    budget: budgetFor(`${claim.subject} ${summary}`),
  });
}

function addRisk(
  draft: SnapshotDraft,
  id: string,
  status: CapabilityRisk['status'],
  sourceRef: string,
  summary = 'Capability evidence requires follow-up.'
): void {
  draft.risks.push({
    id,
    status,
    sourceRef,
    summary: redactSecrets(summary),
  });
}

function addUnknown(draft: SnapshotDraft, id: string, summary: string, sourceRef: string): void {
  draft.unknowns.push({
    id,
    status: 'unknown',
    sourceRef,
    summary: redactSecrets(summary),
  });
}

function addSourceRef(draft: SnapshotDraft, ref: Omit<CapabilitySourceRef, 'id'>): string {
  const id = `${ref.kind}.${slug(ref.path ?? ref.description)}`;
  const existing = draft.sourceRefs.find(sourceRef => sourceRef.id === id);
  if (existing !== undefined) return existing.id;
  draft.sourceRefs.push({
    id,
    kind: ref.kind,
    path: ref.path === undefined ? undefined : redactSecrets(ref.path),
    description: redactSecrets(ref.description),
    safeToInject: ref.safeToInject,
  });
  return id;
}

function manifestCapability(entry: ManifestCapability): {
  id: string;
  label: string;
  summary: string;
  status: CapabilityClaimStatus;
  confidence: CapabilityConfidence;
} {
  const id = typeof entry.id === 'string' ? entry.id : 'unknown';
  return {
    id: redactSecrets(id),
    label: typeof entry.label === 'string' ? redactSecrets(entry.label) : redactSecrets(id),
    summary: typeof entry.summary === 'string' ? redactSecrets(entry.summary) : 'Manifest entry.',
    status: toClaimStatus(entry.status),
    confidence: toConfidence(entry.confidence),
  };
}

function toClaimStatus(value: unknown): CapabilityClaimStatus {
  return value === 'unknown' || value === 'blocked' || value === 'deferred' ? value : 'verified';
}

function toConfidence(value: unknown): CapabilityConfidence {
  return value === 'high' || value === 'medium' || value === 'low' || value === 'unknown'
    ? value
    : 'medium';
}

function eventGuidanceFor(event: AcoBootstrapEvent): string[] {
  switch (event) {
    case 'SessionStart':
      return [
        'bootstrap status: load snapshot summary before planning.',
        'Prefer manifests/adapters/ledgers over remembered tool lists.',
      ];
    case 'UserPromptSubmit':
      return [
        'route prompt through ACO, BMAD, docs, graph, ledgers, and role contracts.',
        'Attach compact context, not raw search logs.',
      ];
    case 'PreToolUse':
      return [
        'forbidden ledger commands: block or defer commands marked forbidden.',
        'Guard graph refreshes, destructive operations, auth mutation, and secret exposure.',
      ];
    case 'PermissionRequest':
      return [
        'approval capsule: show requested action, source ledger row, safety, and willRun=false until approved.',
        'Use ledger reason before asking for permission.',
      ];
    case 'PostToolUse':
      return [
        'capture evidence: record command, exit status, artifacts, and unresolved claims.',
        'Update handoff instead of making unsupported claims.',
      ];
    case 'PreCompact':
      return [
        'durable summary: persist decisions, changed files, validation, blockers, questions, next actions.',
        'Keep enough context for PostCompact reload.',
      ];
    case 'PostCompact':
      return [
        'reload handoff: read latest snapshot, bootstrap context, ledgers, and decision dossier.',
        'Resume from artifacts before new work.',
      ];
    case 'SubagentStart':
      return [
        'role contract: provide role scope, snapshot summary, evidence sources, and artifact expectations.',
        'Keep generator/evaluator responsibilities separate.',
      ];
    case 'SubagentStop':
      return [
        'role artifact: collect role output, evidence claims, unknowns, and evaluator notes.',
        'Summarize findings for parent context.',
      ];
    case 'Stop':
      return [
        'Evaluator continuation: verify goal completion before final claim.',
        'Emit next /goal when work is incomplete or evidence remains unknown.',
      ];
  }
}

function guardrailsFor(event: AcoBootstrapEvent): string[] {
  const base = [
    'Do not read auth stores, provider credentials, MCP OAuth state, or active user-level config.',
    'Do not print or archive secrets.',
    'Preserve graph waivers and committed graph evidence.',
    'Do not refresh graph evidence or activate hooks without approval.',
  ];
  if (event === 'PreToolUse' || event === 'PermissionRequest') {
    return [
      ...base,
      'Block forbidden ledger commands.',
      'Block destructive operations unless explicitly approved.',
      'Block graph refresh commands unless explicitly approved.',
      event === 'PermissionRequest'
        ? 'Approval capsule must name the requested command, risk, ledger reason, and willRun=false until approved.'
        : 'Guard capsule must stop approval-sensitive actions before tool execution.',
    ];
  }
  return base;
}

function continuationFor(
  event: AcoBootstrapEvent,
  prompt: string,
  options: Pick<BuildAcoBootstrapContextOptions, 'goalStatus' | 'nextGoalObjective'>
): AcoBootstrapContinuation {
  if (event !== 'Stop') {
    return {
      required: false,
      reason: 'Continuation only applies to Stop event.',
    };
  }

  const goalStatus = options.goalStatus ?? 'unknown';
  if (goalStatus === 'complete') {
    return {
      required: false,
      reason: 'Goal marked complete by evaluator.',
    };
  }

  const objective = redactSecrets(options.nextGoalObjective ?? prompt);
  return {
    required: true,
    reason: `Goal ${goalStatus}; evaluator must continue instead of claiming completion.`,
    nextGoal: `/goal ${objective}`,
  };
}

function renderBootstrapMarkdown(input: {
  cwd: string;
  prompt: string;
  event: AcoBootstrapEvent;
  generatedAt: string;
  snapshot: CapabilitySnapshot;
  json: AcoBootstrapContextJson;
}): string {
  const counts = input.json.snapshot.counts;
  return [
    '# ACO Bootstrap Context',
    '',
    `Event: ${input.event}`,
    `Generated: ${input.generatedAt}`,
    `CWD: ${redactSecrets(input.cwd)}`,
    `Prompt: ${input.prompt}`,
    '',
    '## Snapshot',
    '',
    `Schema: ${input.snapshot.schemaVersion}`,
    `Providers: ${String(counts.providers)}`,
    `Commands: ${String(counts.commands)}`,
    `Workflows: ${String(counts.workflows)}`,
    `MCP servers: ${String(counts.mcpServers)}`,
    `Plugins: ${String(counts.plugins)}`,
    `Hooks: ${String(counts.hooks)}`,
    `Roles: ${String(counts.roles)}`,
    `Ledgers: ${String(counts.ledgers)}`,
    `Artifacts: ${String(counts.artifacts)}`,
    `Docs targets: ${String(counts.docsTargets)}`,
    `Evidence claims: ${String(input.snapshot.evidenceClaims.length)}`,
    `Graph: ${input.snapshot.graph.status}; waivers=${String(input.snapshot.graph.waiverCount)}`,
    '',
    '## Route',
    '',
    `Route prompt via: ${input.json.route.id}`,
    ...input.json.route.steps.slice(0, 8).map(step => `- ${step}`),
    '',
    '## Event Guidance',
    '',
    ...input.json.eventGuidance.map(item => `- ${item}`),
    '',
    '## Guards',
    '',
    ...input.json.guards.map(item => `- ${item}`),
    '',
    '## Artifacts',
    '',
    ...input.json.artifacts.map(item => `- ${item}`),
    '',
    '## Unknowns',
    '',
    input.snapshot.unknowns.length > 0
      ? input.snapshot.unknowns
          .slice(0, 12)
          .map(item => `- ${item.id}: ${item.summary}`)
          .join('\n')
      : '- none',
    '',
    '## Continuation',
    '',
    `Required: ${input.json.continuation.required ? 'yes' : 'no'}`,
    `Reason: ${input.json.continuation.reason}`,
    input.json.continuation.nextGoal ?? '',
  ].join('\n');
}

function snapshotCounts(snapshot: CapabilitySnapshot): Record<string, number> {
  return {
    sourceRefs: snapshot.sourceRefs.length,
    providers: snapshot.providers.length,
    commands: snapshot.commands.length,
    workflows: snapshot.workflows.length,
    mcpServers: snapshot.mcpServers.length,
    plugins: snapshot.plugins.length,
    hooks: snapshot.hooks.length,
    roles: snapshot.roles.length,
    ledgers: snapshot.ledgers.length,
    artifacts: snapshot.artifacts.length,
    docsTargets: snapshot.docsTargets.length,
    risks: snapshot.risks.length,
    unknowns: snapshot.unknowns.length,
    domains: snapshot.domains.length,
  };
}

function buildDomainCoverage(
  draft: SnapshotDraft,
  graphContext: GraphContext
): CapabilityDomainCoverage[] {
  const sourceById = new Map(draft.sourceRefs.map(sourceRef => [sourceRef.id, sourceRef]));
  const evidenceForItems = (items: CapabilityItem[]): string[] =>
    unique(
      items
        .slice(0, 8)
        .map(item => {
          const sourceRef = sourceById.get(item.sourceRef);
          return `${item.id}: ${item.sourceArtifact ?? item.command ?? sourceRef?.path ?? sourceRef?.description ?? item.sourceRef}`;
        })
        .filter(Boolean)
    );
  const evidenceForUnknown = (idPart: string): string[] =>
    unique(
      [...draft.unknowns, ...draft.risks]
        .filter(item => item.id.includes(idPart))
        .map(item => {
          const sourceRef = sourceById.get(item.sourceRef);
          return `${item.id}: ${sourceRef?.path ?? sourceRef?.description ?? item.sourceRef}`;
        })
    );
  const domain = (
    id: string,
    label: string,
    items: CapabilityItem[],
    fallbackEvidence: string[],
    summary: string,
    preferredStatus?: CapabilityDomainStatus
  ): CapabilityDomainCoverage => ({
    id,
    label,
    status: preferredStatus ?? (items.length > 0 ? 'available' : 'unknown'),
    evidence: evidenceForItems(items).concat(fallbackEvidence).slice(0, 12),
    summary: redactSecrets(summary),
  });

  const context7Evidence = [
    ...evidenceForItems(draft.collections.docsTargets),
    ...evidenceForItems(draft.collections.mcpServers.filter(item => item.id.includes('context7'))),
    ...evidenceForUnknown('docs'),
    'Context7/docs adapter: planDocumentation()',
  ];
  const hookEvidence = [
    ...evidenceForItems(draft.collections.hooks),
    'Codex 0.128.0 hook source: codex-rs/hooks/src',
  ];
  const roleItems = draft.collections.roles;
  const bmadItems = [
    ...draft.collections.plugins.filter(item => item.id.includes('bmad')),
    ...roleItems.filter(item => item.id.includes('bmad')),
  ];
  const providerItems = [
    ...draft.collections.providers,
    ...draft.collections.providers.filter(item => item.category.includes('future')),
  ];

  const domains: CapabilityDomainCoverage[] = [
    domain(
      'commands',
      'Archon commands',
      draft.collections.commands,
      evidenceForUnknown('commands'),
      'Command registry, defaults, package scripts, and validators.'
    ),
    domain(
      'workflows',
      'Archon workflows',
      draft.collections.workflows,
      evidenceForUnknown('workflows'),
      'Workflow manifests, defaults, and validation surfaces.'
    ),
    domain(
      'artifacts',
      'Artifacts',
      draft.collections.artifacts,
      evidenceForUnknown('artifact'),
      'Bootstrap capsules, cleanup manifests, handoffs, and sidecars.'
    ),
    domain(
      'tools',
      'Tools',
      [...draft.collections.commands, ...draft.collections.mcpServers, ...draft.collections.hooks],
      evidenceForUnknown('tools'),
      'CLI, hook, and MCP tool surfaces.'
    ),
    domain(
      'adapters',
      'Adapters',
      [
        ...draft.collections.providers,
        ...draft.collections.mcpServers,
        ...draft.collections.roles,
        ...draft.collections.docsTargets,
      ],
      ['Adapter source refs: Codex, plugin, MCP, Archon, BMAD, graph, docs, providers.'],
      'Read-only adapters and fixture-backed capability discovery.'
    ),
    domain(
      'gates',
      'Gates',
      [],
      [
        'ACO gates: forbidden ledgers, graph refresh, destructive ops, secret exposure, auth/config mutation.',
      ],
      'Safety gates are enforced by bootstrap guardrails and cleanup refusals.',
      'available'
    ),
    domain(
      'manifests',
      'Manifests',
      [
        ...draft.collections.plugins,
        ...draft.collections.providers,
        ...draft.collections.mcpServers,
        ...draft.collections.workflows,
      ],
      evidenceForUnknown('manifest'),
      'Commands, workflows, plugins, providers, hooks, MCP, and BMAD manifests.'
    ),
    domain(
      'mcp-tools',
      'MCP/tools',
      draft.collections.mcpServers,
      ['MCP evidence: committed config only; OAuth state intentionally not read.'],
      'Codex/Archon MCP config and tools with OAuth-safe evidence.'
    ),
    domain(
      'context7-docs',
      'Context7/docs',
      draft.collections.docsTargets,
      context7Evidence,
      'Context7/docs targets and documentation readiness.'
    ),
    domain(
      'bmad',
      'BMAD',
      bmadItems,
      ['BMAD role and skill manifest coverage.', ...evidenceForUnknown('bmad')],
      'BMAD roles, skill manifests, and role-aware routing.'
    ),
    domain(
      'subagents-roles',
      'Subagents/roles',
      roleItems,
      [
        'Subagent lifecycle uses ACO role contracts; Codex generated agents are provider-level custom-agent config, while legacy hook lifecycle evidence remains simulated.',
      ],
      'Codex agents, Archon/BMAD roles, and role contracts.'
    ),
    domain(
      'research-agentic-search',
      'Research/Agentic Search',
      draft.collections.docsTargets.filter(item => /research|docs/i.test(item.category)),
      [
        'Research/Agentic Search manifests are available when committed; otherwise explicit unknown.',
      ],
      'Research provider and Agentic Search awareness.',
      draft.collections.docsTargets.length > 0 ? 'available' : 'unknown'
    ),
    domain(
      'context-bootload',
      'Context/bootload',
      draft.collections.commands.filter(item => item.id.includes('bootstrap')),
      ['Context bootload: /aco:bootstrap-codex and buildAcoBootstrapContext().'],
      'ACO bootstrap command, context builder, and bootload artifacts.',
      'available'
    ),
    domain(
      'hooks',
      'Hooks',
      draft.collections.hooks,
      hookEvidence,
      'Hook templates, schemas, runner, and real smoke support.'
    ),
    domain(
      'plugins',
      'Plugins',
      draft.collections.plugins,
      evidenceForUnknown('plugin'),
      'Plugin manifests, plugin hooks, MCP, and app evidence.'
    ),
    domain(
      'ledgers',
      'Ledgers',
      draft.collections.ledgers,
      evidenceForUnknown('ledger'),
      'Evidence rows and cleanup ledger idempotency proof.'
    ),
    {
      id: 'graph-graphify',
      label: 'Graph/Graphify',
      status: graphContext.status === 'available' ? 'available' : 'unknown',
      evidence: [
        'docs/context-orchestrator/research/upstream-manifest.json',
        `graph status=${graphContext.status} waivers=${String(graphContext.waiverCount)}`,
      ],
      summary: 'Committed graph evidence only; no graph refresh.',
    },
    domain(
      'providers-future',
      'Providers/future',
      providerItems,
      evidenceForUnknown('provider'),
      'Provider registry and future extension manifests.'
    ),
  ];

  return domains.map(
    (item): CapabilityDomainCoverage => ({
      ...item,
      evidence:
        item.evidence.length > 0 ? unique(item.evidence) : ['explicit unknown: no evidence'],
    })
  );
}

async function collectFiles(
  cwd: string,
  subdir: string,
  extensions: readonly string[],
  maxFiles: number
): Promise<CollectedFile[]> {
  const root = join(cwd, subdir);
  const files: CollectedFile[] = [];
  await collectFilesInner(cwd, root, extensions, maxFiles, files);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

async function collectFilesInner(
  cwd: string,
  dir: string,
  extensions: readonly string[],
  maxFiles: number,
  files: CollectedFile[]
): Promise<void> {
  if (files.length >= maxFiles) return;
  let entries: {
    name: string;
    isSymbolicLink(): boolean;
    isDirectory(): boolean;
    isFile(): boolean;
  }[];
  try {
    entries = await readdir(dir, { withFileTypes: true, encoding: 'utf8' });
  } catch {
    return;
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (files.length >= maxFiles) return;
    if (entry.isSymbolicLink()) continue;
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFilesInner(cwd, absolutePath, extensions, maxFiles, files);
      continue;
    }
    if (!entry.isFile() || !extensions.includes(extname(entry.name))) continue;
    files.push({
      absolutePath,
      relativePath: normalizePath(relative(cwd, absolutePath)),
    });
  }
}

async function readJsonFile(path: string): Promise<unknown> {
  const text = await readTextFile(path);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readTextFile(path: string): Promise<string | null> {
  try {
    return redactSecrets(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

function extractYamlName(text: string | null): string | null {
  if (text === null) return null;
  const match = /^name:\s*['"]?([^'"\n\r]+)['"]?/m.exec(text);
  return match?.[1]?.trim() ?? null;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const [headerLine, ...rows] = lines;
  if (headerLine === undefined) return [];
  const headers = parseCsvLine(headerLine);
  return rows.map(row => {
    const values = parseCsvLine(row);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      cells.push(cell);
      cell = '';
      continue;
    }
    cell += char;
  }
  cells.push(cell);
  return cells;
}

function budgetFor(text: string, maxBytes = 320): CapabilityBudget {
  return {
    maxBytes,
    estimatedBytes: byteLength(redactSecrets(text)),
    purpose: 'compact-bootstrap',
  };
}

function limitBytes(text: string, maxBytes: number): { text: string; truncated: boolean } {
  if (byteLength(text) <= maxBytes) return { text, truncated: false };
  const suffix = '\n\n[truncated: compact bootstrap context exceeded maxBytes]\n';
  const budget = Math.max(0, maxBytes - byteLength(suffix));
  let truncated = text;
  while (byteLength(truncated) > budget && truncated.length > 0) {
    truncated = truncated.slice(0, Math.max(0, truncated.length - 64));
  }
  return { text: `${truncated}${suffix}`, truncated: true };
}

function byteLength(text: string): number {
  return textEncoder.encode(text).length;
}

function slug(value: string): string {
  const redacted = redactSecrets(value);
  const slugged = redacted
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slugged.length > 0 ? slugged.slice(0, 96) : 'unknown';
}

function normalizePath(path: string): string {
  return path.split('\\').join('/');
}

function sortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

function unique(items: string[]): string[] {
  return [...new Set(items.map(item => redactSecrets(item)).filter(item => item.trim()))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
