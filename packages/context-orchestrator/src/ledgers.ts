import { readFile } from 'fs/promises';
import { join } from 'path';
import { redactSecrets } from './security';
import type {
  AcceptancePlan,
  BmadRoute,
  CapabilityRoute,
  CommandLedgerEntry,
  CommandSafety,
  DocumentationPlan,
  GraphContext,
  LedgerBundle,
  LedgerBundleSummary,
  LedgerConfidence,
  LedgerEntryBase,
  LedgerEvidence,
  LedgerStatus,
  LedgerStatusCounts,
  LedgerSummary,
  ToolAvailabilityLedgerEntry,
  ValidationCheck,
  ValidationReport,
} from './types';

export const LEDGER_SCHEMA_VERSION = 'aco.ledger-bundle.v1' as const;

export const ledgerStatusOrder = [
  'available',
  'partial',
  'blocked',
  'deferred',
  'forbidden',
  'not used',
  'unknown',
] as const satisfies readonly LedgerStatus[];

const ledgerStatuses = new Set<LedgerStatus>(ledgerStatusOrder);

const commandSafetyValues = new Set<CommandSafety>([
  'read-only',
  'writes-artifacts',
  'writes-tracked-files',
  'destructive',
  'network',
  'unknown',
]);

export interface BuildLedgerBundleOptions {
  cwd: string;
  timestamp?: string;
  graphContext: GraphContext;
  documentationPlan: DocumentationPlan;
  bmadRoute: BmadRoute;
  acceptancePlan: AcceptancePlan;
  selectedCapabilities: CapabilityRoute;
  validationReport: ValidationReport;
  packageScripts?: Record<string, string>;
  repositoryStatus?: RepositoryStatusEvidence;
}

export interface RepositoryStatusEvidence {
  status: Extract<LedgerStatus, 'available' | 'partial' | 'blocked' | 'unknown'>;
  sourceEvidence: string;
  verification: string;
  notes: string;
  confidence: LedgerConfidence;
}

type LedgerBundleDraft = Omit<LedgerBundle, 'summary'> & {
  summary?: LedgerBundleSummary;
};

type ToolEntryDraft = Omit<ToolAvailabilityLedgerEntry, 'evidence' | 'confidence'> & {
  confidence?: LedgerConfidence;
  evidence?: LedgerEvidence[];
};

type CommandEntryDraft = Omit<CommandLedgerEntry, 'evidence' | 'confidence'> & {
  confidence?: LedgerConfidence;
  evidence?: LedgerEvidence[];
};

export async function buildLedgerBundle(options: BuildLedgerBundleOptions): Promise<LedgerBundle> {
  const packageScripts = options.packageScripts ?? (await readPackageScripts(options.cwd));
  const repositoryStatus =
    options.repositoryStatus ?? (await getRepositoryStatusEvidence(options.cwd));
  const lastVerified = toLastVerified(options.timestamp);
  const toolAvailability = buildToolAvailabilityEntries(
    options,
    packageScripts,
    repositoryStatus,
    lastVerified
  );
  const commands = buildCommandEntries(options, packageScripts, repositoryStatus, lastVerified);

  return normalizeLedgerBundle({
    schemaVersion: LEDGER_SCHEMA_VERSION,
    generatedAt: options.timestamp,
    toolAvailability,
    commands,
  });
}

export function normalizeLedgerBundle(bundle: LedgerBundleDraft): LedgerBundle {
  if (bundle.schemaVersion !== LEDGER_SCHEMA_VERSION) {
    throw new Error(`Invalid ledger schemaVersion: ${String(bundle.schemaVersion)}`);
  }

  const toolAvailability = bundle.toolAvailability
    .map(entry => normalizeToolEntry(entry))
    .sort(compareById);
  const commands = bundle.commands.map(entry => normalizeCommandEntry(entry)).sort(compareById);
  const normalized: Omit<LedgerBundle, 'summary'> = {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    ...(bundle.generatedAt !== undefined ? { generatedAt: redactSecrets(bundle.generatedAt) } : {}),
    toolAvailability,
    commands,
  };

  return {
    ...normalized,
    summary: summarizeLedgerBundle(normalized),
  };
}

export function summarizeLedgerBundle(
  bundle: Pick<LedgerBundle, 'toolAvailability' | 'commands'>
): LedgerBundleSummary {
  const toolAvailability = summarizeEntries(bundle.toolAvailability);
  const commands = summarizeEntries(bundle.commands);
  return {
    toolAvailability,
    commands,
    combined: combineSummaries(toolAvailability, commands),
  };
}

export function serializeLedgerBundle(bundle: LedgerBundle): LedgerBundle {
  return normalizeLedgerBundle(bundle);
}

export function serializeToolAvailabilityLedger(bundle: LedgerBundle): {
  schemaVersion: LedgerBundle['schemaVersion'];
  summary: LedgerSummary;
  toolAvailability: ToolAvailabilityLedgerEntry[];
} {
  const normalized = normalizeLedgerBundle(bundle);
  return {
    schemaVersion: normalized.schemaVersion,
    summary: normalized.summary.toolAvailability,
    toolAvailability: normalized.toolAvailability,
  };
}

export function serializeCommandsLedger(bundle: LedgerBundle): {
  schemaVersion: LedgerBundle['schemaVersion'];
  summary: LedgerSummary;
  commands: CommandLedgerEntry[];
} {
  const normalized = normalizeLedgerBundle(bundle);
  return {
    schemaVersion: normalized.schemaVersion,
    summary: normalized.summary.commands,
    commands: normalized.commands,
  };
}

export function renderLedgerBundleMarkdown(bundle: LedgerBundle): string {
  const normalized = normalizeLedgerBundle(bundle);
  return [
    '# ACO Ledger Bundle',
    '',
    `Schema: ${normalized.schemaVersion}`,
    '',
    renderSummaryMarkdown(normalized.summary.combined),
    '',
    renderToolAvailabilityLedgerMarkdown(normalized.toolAvailability),
    '',
    renderCommandsLedgerMarkdown(normalized.commands),
  ].join('\n');
}

export function renderToolAvailabilityLedgerMarkdown(
  entries: ToolAvailabilityLedgerEntry[]
): string {
  const normalized = entries.map(entry => normalizeToolEntry(entry)).sort(compareById);
  return [
    '# Tool Availability Ledger',
    '',
    '| ID | Name | Category | Status | Source Evidence | Invocation Path | Scope | Preconditions | Verification | Primary Use | Failure Mode | Fallback | Owner | Last Verified | Confidence | Notes |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...normalized
      .map(entry =>
        [
          entry.id,
          entry.name,
          entry.category,
          entry.status,
          entry.sourceEvidence,
          entry.invocationPath,
          entry.scope,
          entry.preconditions,
          entry.verification,
          entry.primaryUse,
          entry.failureMode,
          entry.fallback,
          entry.owner,
          entry.lastVerified,
          entry.confidence,
          entry.notes,
        ]
          .map(escapeMarkdownTableCell)
          .join(' | ')
      )
      .map(row => `| ${row} |`),
  ].join('\n');
}

export function renderCommandsLedgerMarkdown(entries: CommandLedgerEntry[]): string {
  const normalized = entries.map(entry => normalizeCommandEntry(entry)).sort(compareById);
  return [
    '# Commands Ledger',
    '',
    '| ID | Command | Category | Status | Source Evidence | Invocation Path | Scope | Preconditions | Verification | Primary Use | Failure Mode | Fallback | Owner | Last Verified | Mutates Tracked Files | Requires Approval | Safety | Confidence | Notes |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...normalized
      .map(entry =>
        [
          entry.id,
          entry.command,
          entry.category,
          entry.status,
          entry.sourceEvidence,
          entry.invocationPath,
          entry.scope,
          entry.preconditions,
          entry.verification,
          entry.primaryUse,
          entry.failureMode,
          entry.fallback,
          entry.owner,
          entry.lastVerified,
          String(entry.mutatesTrackedFiles),
          String(entry.requiresApproval),
          entry.safety,
          entry.confidence,
          entry.notes,
        ]
          .map(escapeMarkdownTableCell)
          .join(' | ')
      )
      .map(row => `| ${row} |`),
  ].join('\n');
}

function buildToolAvailabilityEntries(
  options: BuildLedgerBundleOptions,
  packageScripts: Record<string, string>,
  repositoryStatus: RepositoryStatusEvidence,
  lastVerified: string
): ToolAvailabilityLedgerEntry[] {
  const policy = checkById(options.validationReport, 'aco-policy');
  const traceability = checkById(options.validationReport, 'aco-traceability');
  const packageScriptStatus = Object.keys(packageScripts).length > 0 ? 'available' : 'blocked';
  const docsStatus =
    options.documentationPlan.unresolved.length > 0 ? 'partial' : ('available' as LedgerStatus);
  const graphStatus = graphToLedgerStatus(options.graphContext.status);

  return [
    toolEntry({
      id: 'tool.acceptance-plan',
      name: 'Acceptance plan',
      category: 'aco',
      status: options.acceptancePlan.status === 'ready' ? 'available' : 'blocked',
      sourceEvidence: `acceptancePlan status=${options.acceptancePlan.status}; scenarios=${options.acceptancePlan.scenarios.length}.`,
      invocationPath: 'createAcceptancePlan({ prompt, route })',
      scope: 'ATDD acceptance scenario planning.',
      preconditions: 'Prompt and BMAD route available.',
      verification: `${options.acceptancePlan.scenarios.length} acceptance scenario(s).`,
      primaryUse: 'Gate implementation behind acceptance criteria.',
      failureMode: 'Missing acceptance scenarios.',
      fallback: 'Create acceptance plan before implementation.',
      owner: 'context-orchestrator',
      lastVerified,
      notes: 'Acceptance evidence is included in prompt package policy input.',
      confidence: 'observed',
    }),
    toolEntry({
      id: 'tool.aco-compile',
      name: 'ACO compile',
      category: 'aco',
      status: 'available',
      sourceEvidence: 'packages/context-orchestrator/src/compiler.ts',
      invocationPath: 'bun run cli context compile --cwd . "<prompt>"',
      scope: 'Prompt package compilation and archive artifact generation.',
      preconditions: 'Bun and ACO package available; archive path must pass security checks.',
      verification:
        'Compiler module is imported by CLI and existing compile tests exercise archive writes.',
      primaryUse: 'Build Codex-ready prompt packages and ledger artifacts.',
      failureMode: 'Unsafe archive path, policy denial, missing OPA, or malformed ledger row.',
      fallback: 'Use context ledgers/status output and record archive generation as blocked.',
      owner: 'context-orchestrator',
      lastVerified,
      notes: 'Declared capability; compile writes archive artifacts.',
      confidence: 'declared',
    }),
    toolEntry({
      id: 'tool.aco-route',
      name: 'ACO route',
      category: 'aco',
      status: 'available',
      sourceEvidence: `routeBmad returned ${options.bmadRoute.id}.`,
      invocationPath: 'bun run cli context route --cwd . "<prompt>"',
      scope: 'BMAD route selection.',
      preconditions: 'Prompt text is available.',
      verification: `Route ID ${options.bmadRoute.id} selected.`,
      primaryUse: 'Choose implementation planning route.',
      failureMode: 'Unknown or ambiguous route selection.',
      fallback: 'Use bmad-help guidance and mark route confidence partial.',
      owner: 'context-orchestrator',
      lastVerified,
      notes: options.bmadRoute.rationale,
      confidence: 'observed',
    }),
    toolEntry({
      id: 'tool.aco-status',
      name: 'ACO status',
      category: 'aco',
      status:
        graphStatus === 'available' && options.validationReport.status === 'passed'
          ? 'available'
          : 'partial',
      sourceEvidence: `graph=${options.graphContext.status}; validation=${options.validationReport.status}.`,
      invocationPath: 'bun run cli context status --cwd .',
      scope: 'Aggregate ACO readiness signal.',
      preconditions: 'Graph evidence and validation checks available.',
      verification: 'Status can be built from graph context and validation report.',
      primaryUse: 'Expose readiness caveats.',
      failureMode: 'Graph waivers or validation warnings limit confidence.',
      fallback: 'Inspect graph-summary.md and validation-report.md artifacts.',
      owner: 'context-orchestrator',
      lastVerified,
      notes: options.graphContext.summary,
      confidence: 'observed',
    }),
    toolEntry({
      id: 'tool.aco-validate',
      name: 'ACO validate',
      category: 'aco',
      status: validationToLedgerStatus(options.validationReport.status),
      sourceEvidence: `validateContextOrchestrator returned ${options.validationReport.status}.`,
      invocationPath: 'bun run cli context validate --cwd .',
      scope: 'ACO research/spec/policy/traceability validation.',
      preconditions: 'Bun scripts, OPA, and traceability manifest available.',
      verification: validationSummary(options.validationReport),
      primaryUse: 'Validate ACO evidence readiness.',
      failureMode: 'Missing script, missing OPA, failed policy, or traceability drift.',
      fallback: 'Run individual aco:policy and aco:traceability checks.',
      owner: 'context-orchestrator',
      lastVerified,
      notes: 'Observed through validation report.',
      confidence: 'observed',
    }),
    toolEntry({
      id: 'tool.bundled-defaults',
      name: 'Bundled defaults check/generation',
      category: 'defaults',
      status: hasScripts(packageScripts, ['check:bundled', 'generate:bundled'])
        ? 'available'
        : 'blocked',
      sourceEvidence: 'package.json scripts: check:bundled, generate:bundled.',
      invocationPath: 'bun run check:bundled',
      scope: 'Default command/workflow synchronization.',
      preconditions: 'Default files exist under .archon.',
      verification:
        'Script declarations are present; execution result must be recorded separately.',
      primaryUse: 'Detect generated default drift.',
      failureMode: 'Generated defaults stale or generator fails.',
      fallback: 'Regenerate during implementation, then re-run check.',
      owner: 'workflows',
      lastVerified,
      notes: 'Generation writes tracked output; check mode is read-only.',
      confidence: 'declared',
    }),
    toolEntry({
      id: 'tool.cli-context-integration',
      name: 'CLI context integration',
      category: 'cli',
      status: 'available',
      sourceEvidence: 'packages/cli/src/commands/context.ts and packages/cli/src/cli.ts.',
      invocationPath: 'bun run cli context <subcommand>',
      scope: 'Route, compile, status, validate, and ledgers subcommands.',
      preconditions: 'CLI package can import @archon/context-orchestrator.',
      verification: 'CLI command module provides context command entry points.',
      primaryUse: 'Expose ledger bundle to users and agents.',
      failureMode: 'Unknown context subcommand or import failure.',
      fallback: 'Use context-orchestrator package helpers directly.',
      owner: 'cli',
      lastVerified,
      notes: 'Static CLI integration evidence.',
      confidence: 'declared',
    }),
    toolEntry({
      id: 'tool.capability-route',
      name: 'Capability route',
      category: 'aco',
      status: options.selectedCapabilities.capabilities.length > 0 ? 'available' : 'unknown',
      sourceEvidence: `selectedCapabilities count=${options.selectedCapabilities.capabilities.length}.`,
      invocationPath: 'selectCapabilities({ graphContext, documentationPlan })',
      scope: 'Prompt package capability selection.',
      preconditions: 'Graph and documentation evidence available.',
      verification: `${options.selectedCapabilities.capabilities.length} capability row(s).`,
      primaryUse: 'Tell agents which ACO capabilities are in scope.',
      failureMode: 'Capability selection missing or unsupported.',
      fallback: 'Use graph, docs, BMAD, acceptance, and prompt-package defaults.',
      owner: 'context-orchestrator',
      lastVerified,
      notes: options.selectedCapabilities.capabilities.map(capability => capability.id).join(', '),
      confidence: options.selectedCapabilities.capabilities.length > 0 ? 'observed' : 'unknown',
    }),
    toolEntry({
      id: 'tool.command-default-sync',
      name: 'Command/default synchronization',
      category: 'defaults',
      status: hasScripts(packageScripts, ['check:bundled']) ? 'available' : 'blocked',
      sourceEvidence: 'package.json script check:bundled.',
      invocationPath: 'bun run check:bundled',
      scope: 'Synchronize .archon command defaults with bundled generated defaults.',
      preconditions: 'Generator source and default command directories exist.',
      verification: 'Script declaration present; pass/fail result is command-ledger evidence.',
      primaryUse: 'Keep runtime defaults aligned with docs command files.',
      failureMode: 'Stale generated defaults.',
      fallback: 'Run bun run generate:bundled during implementation.',
      owner: 'workflows',
      lastVerified,
      notes: 'Use check mode during validation; generation mutates tracked file.',
      confidence: 'declared',
    }),
    toolEntry({
      id: 'tool.docs-evidence',
      name: 'Docs evidence',
      category: 'evidence',
      status: docsStatus,
      sourceEvidence: `documentationPlan targets=${options.documentationPlan.targets.length}; unresolved=${options.documentationPlan.unresolved.length}.`,
      invocationPath: 'planDocumentation({ prompt })',
      scope: 'OpenAI Docs MCP, Context7, or generic docs planning.',
      preconditions: 'Prompt can be inspected for documentation needs.',
      verification: 'Documentation plan generated.',
      primaryUse: 'Record docs requirements and unresolved library IDs.',
      failureMode: 'Unresolved library target limits confidence.',
      fallback: 'Resolve docs before implementation choices depend on external APIs.',
      owner: 'context-orchestrator',
      lastVerified,
      notes:
        options.documentationPlan.unresolved.length > 0
          ? `Unresolved: ${options.documentationPlan.unresolved.join(', ')}`
          : 'No unresolved docs targets.',
      confidence: 'observed',
    }),
    toolEntry({
      id: 'tool.format-check',
      name: 'Format check',
      category: 'validation',
      status: packageScripts['format:check'] ? 'available' : 'blocked',
      sourceEvidence: 'package.json script format:check.',
      invocationPath: 'bun run format:check',
      scope: 'Repository formatting gate.',
      preconditions: 'Dependencies installed.',
      verification: 'Script declaration present; execution result is command-ledger evidence.',
      primaryUse: 'Pre-PR validation.',
      failureMode: 'Prettier drift.',
      fallback: 'Review formatting diff; do not run write formatter during discovery.',
      owner: 'repo',
      lastVerified,
      notes: 'Check-only command.',
      confidence: packageScripts['format:check'] ? 'declared' : 'unknown',
    }),
    toolEntry({
      id: 'tool.git-status',
      name: 'Current repository cleanliness/status',
      category: 'git',
      status: repositoryStatus.status,
      sourceEvidence: repositoryStatus.sourceEvidence,
      invocationPath: 'git status --short --untracked-files=all',
      scope: 'Worktree cleanliness.',
      preconditions: 'Git repository available.',
      verification: repositoryStatus.verification,
      primaryUse: 'Avoid overwriting unrelated user changes.',
      failureMode: 'Dirty worktree, untracked files, or not a git repository.',
      fallback: 'Stop and inspect changes before editing.',
      owner: 'repo',
      lastVerified,
      notes: repositoryStatus.notes,
      confidence: repositoryStatus.confidence,
    }),
    toolEntry({
      id: 'tool.graph-evidence',
      name: 'Graph evidence',
      category: 'evidence',
      status: graphStatus,
      sourceEvidence: graphSourceEvidence(options.graphContext),
      invocationPath: 'getGraphContext({ cwd })',
      scope: 'Repository graph evidence.',
      preconditions: 'upstream-manifest.json and graph metadata available.',
      verification: `${options.graphContext.repositories.length} repositories; ${options.graphContext.waiverCount} waiver(s).`,
      primaryUse: 'Evidence-backed implementation context.',
      failureMode: 'Missing graph manifest or graph waivers.',
      fallback: 'Record waiver and limit confidence.',
      owner: 'context-orchestrator',
      lastVerified,
      notes:
        options.graphContext.waiverCount > 0
          ? graphWaiverNotes(options.graphContext)
          : 'No graph waivers.',
      confidence: 'observed',
    }),
    toolEntry({
      id: 'tool.opa-policy',
      name: 'OPA policy validation',
      category: 'validation',
      status: validationCheckToLedgerStatus(policy),
      sourceEvidence: policy?.message ?? 'unknown',
      invocationPath: 'bun run aco:policy',
      scope: 'Prompt package OPA policy gate.',
      preconditions: 'OPA CLI on PATH and policy fixtures available.',
      verification: policy?.message ?? 'Policy check not present.',
      primaryUse: 'Validate prompt-package evidence shape.',
      failureMode: 'Missing OPA, policy denial, or malformed output.',
      fallback: 'Install OPA or mark policy validation blocked.',
      owner: 'context-orchestrator',
      lastVerified,
      notes: policy?.status ?? 'unknown',
      confidence: policy ? 'observed' : 'unknown',
    }),
    toolEntry({
      id: 'tool.package-manager',
      name: 'Package manager',
      category: 'runtime',
      status: typeof Bun === 'undefined' ? 'unknown' : 'available',
      sourceEvidence: typeof Bun === 'undefined' ? 'unknown' : `Bun ${Bun.version}`,
      invocationPath: 'bun --version',
      scope: 'Runtime, package scripts, tests.',
      preconditions: 'Bun installed.',
      verification: typeof Bun === 'undefined' ? 'Bun global unavailable.' : `Bun ${Bun.version}`,
      primaryUse: 'Run Archon scripts.',
      failureMode: 'Bun missing or unsupported version.',
      fallback: 'Install supported Bun version.',
      owner: 'repo',
      lastVerified,
      notes: 'Detected from Bun runtime when bundle is built.',
      confidence: typeof Bun === 'undefined' ? 'unknown' : 'observed',
    }),
    toolEntry({
      id: 'tool.package-scripts',
      name: 'Package script discovery',
      category: 'package-json',
      status: packageScriptStatus,
      sourceEvidence:
        Object.keys(packageScripts).length > 0
          ? `package.json scripts discovered: ${Object.keys(packageScripts).sort().join(', ')}`
          : 'package.json scripts unavailable.',
      invocationPath: 'read package.json',
      scope: 'Discover validation and generation commands.',
      preconditions: 'Readable package.json at cwd.',
      verification: `${Object.keys(packageScripts).length} script(s) discovered.`,
      primaryUse: 'Populate commands ledger.',
      failureMode: 'Missing or invalid package.json.',
      fallback: 'Record commands as unknown.',
      owner: 'repo',
      lastVerified,
      notes: 'Static package script evidence.',
      confidence: Object.keys(packageScripts).length > 0 ? 'observed' : 'unknown',
    }),
    toolEntry({
      id: 'tool.prompt-package-archive',
      name: 'Generated prompt package/archive',
      category: 'archive',
      status: 'available',
      sourceEvidence: 'packages/context-orchestrator/src/compiler.ts archiveFiles.',
      invocationPath: 'bun run cli context compile --cwd . "<prompt>"',
      scope: 'Prompt package archive artifacts.',
      preconditions: 'Archive root writable and OPA policy gate available.',
      verification: 'Compiler owns archive file writes.',
      primaryUse: 'Export ledger-backed prompt packages.',
      failureMode: 'Archive path blocked, policy denial, or file write failure.',
      fallback: 'Use read-only context ledgers output without archive.',
      owner: 'context-orchestrator',
      lastVerified,
      notes: 'Compile mutates archive output, not tracked source by default.',
      confidence: 'declared',
    }),
    toolEntry({
      id: 'tool.test-runner',
      name: 'Test runner',
      category: 'validation',
      status: packageScripts.test ? 'available' : 'blocked',
      sourceEvidence: 'package.json script test.',
      invocationPath: 'bun test packages/context-orchestrator/src/*.test.ts',
      scope: 'Unit and package tests.',
      preconditions: 'Dependencies installed.',
      verification: 'Script declaration present; execution result is command-ledger evidence.',
      primaryUse: 'Verify ledger and compiler behavior.',
      failureMode: 'Test failures or Bun mock pollution if wrong command is used.',
      fallback: 'Run targeted package tests in isolated processes.',
      owner: 'repo',
      lastVerified,
      notes: 'Use targeted tests before broad validation.',
      confidence: packageScripts.test ? 'declared' : 'unknown',
    }),
    toolEntry({
      id: 'tool.traceability',
      name: 'Traceability validation',
      category: 'validation',
      status: validationCheckToLedgerStatus(traceability),
      sourceEvidence: traceability?.message ?? 'unknown',
      invocationPath: 'bun run aco:traceability',
      scope: 'SDD/ATDD traceability gate.',
      preconditions: 'Traceability manifest and matrix available.',
      verification: traceability?.message ?? 'Traceability check not present.',
      primaryUse: 'Ensure requirements link specs and tests.',
      failureMode: 'Manifest drift or missing markers.',
      fallback: 'Update traceability manifest and tests before implementation completion.',
      owner: 'context-orchestrator',
      lastVerified,
      notes: traceability?.status ?? 'unknown',
      confidence: traceability ? 'observed' : 'unknown',
    }),
    toolEntry({
      id: 'tool.type-check',
      name: 'Type check',
      category: 'validation',
      status: packageScripts['type-check'] ? 'available' : 'blocked',
      sourceEvidence: 'package.json script type-check.',
      invocationPath: 'bun run type-check',
      scope: 'Repository TypeScript gate.',
      preconditions: 'Dependencies installed.',
      verification: 'Script declaration present; execution result is command-ledger evidence.',
      primaryUse: 'Pre-PR validation.',
      failureMode: 'TypeScript errors.',
      fallback: 'Run package-local type-check to isolate failures.',
      owner: 'repo',
      lastVerified,
      notes: 'Check-only command.',
      confidence: packageScripts['type-check'] ? 'declared' : 'unknown',
    }),
  ];
}

function buildCommandEntries(
  options: BuildLedgerBundleOptions,
  packageScripts: Record<string, string>,
  repositoryStatus: RepositoryStatusEvidence,
  lastVerified: string
): CommandLedgerEntry[] {
  const policy = checkById(options.validationReport, 'aco-policy');
  const traceability = checkById(options.validationReport, 'aco-traceability');
  const commands: CommandLedgerEntry[] = [
    commandEntry({
      id: 'cmd.aco-compile',
      command: 'bun run cli context compile --cwd . "<prompt>"',
      category: 'aco',
      status: 'deferred',
      sourceEvidence: 'packages/cli/src/commands/context.ts',
      invocationPath: 'repo root',
      scope: 'Compile prompt package archive.',
      preconditions: 'Writable archive root; OPA available.',
      verification: 'Archive path returned and ledger artifacts written.',
      primaryUse: 'Generate ledger-backed prompt package.',
      failureMode: 'Archive write or policy gate failure.',
      fallback: 'Use `bun run cli context ledgers --cwd . --json` for read-only evidence.',
      owner: 'context-orchestrator',
      lastVerified,
      mutatesTrackedFiles: false,
      requiresApproval: true,
      safety: 'writes-artifacts',
      notes: 'Writes archive artifacts; approval required during read-only discovery.',
      confidence: 'declared',
    }),
    commandEntry({
      id: 'cmd.aco-ledgers',
      command: 'bun run cli context ledgers --cwd . --json',
      category: 'aco',
      status: 'available',
      sourceEvidence: 'packages/cli/src/commands/context.ts',
      invocationPath: 'repo root',
      scope: 'Build read-only ledger bundle.',
      preconditions: 'ACO package and cwd available.',
      verification: 'Emits combined LedgerBundle JSON.',
      primaryUse: 'Inspect ledgers without archive writes.',
      failureMode: 'Schema invariant failure.',
      fallback: 'Use package helper buildLedgerBundle in tests.',
      owner: 'context-orchestrator',
      lastVerified,
      mutatesTrackedFiles: false,
      requiresApproval: false,
      safety: 'read-only',
      notes: 'Read-only CLI surface.',
      confidence: 'declared',
    }),
    commandEntry({
      id: 'cmd.aco-policy',
      command: 'bun run aco:policy',
      category: 'validation',
      status: validationCheckToLedgerStatus(policy),
      sourceEvidence: policy?.message ?? 'unknown',
      invocationPath: 'repo root',
      scope: 'OPA policy gate.',
      preconditions: 'OPA CLI and policy fixtures available.',
      verification: policy?.message ?? 'Policy command not observed.',
      primaryUse: 'Validate prompt package policy fixtures.',
      failureMode: 'OPA unavailable or policy denial.',
      fallback: 'Install OPA or mark policy validation blocked.',
      owner: 'context-orchestrator',
      lastVerified,
      mutatesTrackedFiles: false,
      requiresApproval: false,
      safety: 'read-only',
      notes: policy?.status ?? 'unknown',
      confidence: policy ? 'observed' : 'unknown',
    }),
    commandEntry({
      id: 'cmd.aco-research',
      command: 'bun run aco:research',
      category: 'research',
      status: 'forbidden',
      sourceEvidence: packageScripts['aco:research'] ?? 'package.json script aco:research',
      invocationPath: 'repo root',
      scope: 'Fetch/update graph and research corpus artifacts.',
      preconditions: 'Network and graph tooling available.',
      verification: 'Not run during read-only discovery.',
      primaryUse: 'Refresh ACO research corpus.',
      failureMode: 'Writes generated research artifacts or fetches network data.',
      fallback: 'Use committed research evidence and record staleness.',
      owner: 'context-orchestrator',
      lastVerified: 'unknown',
      mutatesTrackedFiles: true,
      requiresApproval: true,
      safety: 'writes-tracked-files',
      notes: 'Forbidden during read-only discovery because it can write generated artifacts.',
      confidence: packageScripts['aco:research'] ? 'declared' : 'unknown',
    }),
    commandEntry({
      id: 'cmd.aco-status',
      command: 'bun run cli context status --cwd .',
      category: 'aco',
      status: options.graphContext.status === 'partial' ? 'partial' : 'available',
      sourceEvidence: `graph=${options.graphContext.status}; validation=${options.validationReport.status}.`,
      invocationPath: 'repo root',
      scope: 'ACO status summary.',
      preconditions: 'Graph and validation evidence can be computed.',
      verification: 'Outputs graph and validation status.',
      primaryUse: 'Readiness summary.',
      failureMode: 'Graph waivers or validation failures limit confidence.',
      fallback: 'Inspect graph and validation artifacts directly.',
      owner: 'context-orchestrator',
      lastVerified,
      mutatesTrackedFiles: false,
      requiresApproval: false,
      safety: 'read-only',
      notes:
        options.graphContext.waivers.length > 0
          ? `${options.graphContext.summary} Waivers: ${options.graphContext.waivers
              .map(waiver => waiver.id)
              .join(', ')}.`
          : options.graphContext.summary,
      confidence: 'observed',
    }),
    commandEntry({
      id: 'cmd.aco-traceability',
      command: 'bun run aco:traceability',
      category: 'validation',
      status: validationCheckToLedgerStatus(traceability),
      sourceEvidence: traceability?.message ?? 'unknown',
      invocationPath: 'repo root',
      scope: 'Traceability gate.',
      preconditions: 'Traceability manifest and matrix available.',
      verification: traceability?.message ?? 'Traceability command not observed.',
      primaryUse: 'Validate SDD/ATDD evidence links.',
      failureMode: 'Missing marker or manifest drift.',
      fallback: 'Repair manifest or tests.',
      owner: 'context-orchestrator',
      lastVerified,
      mutatesTrackedFiles: false,
      requiresApproval: false,
      safety: 'read-only',
      notes: traceability?.status ?? 'unknown',
      confidence: traceability ? 'observed' : 'unknown',
    }),
    commandEntry({
      id: 'cmd.aco-validate',
      command: 'bun run cli context validate --cwd .',
      category: 'aco',
      status: validationToLedgerStatus(options.validationReport.status),
      sourceEvidence: validationSummary(options.validationReport),
      invocationPath: 'repo root',
      scope: 'ACO aggregate validation.',
      preconditions: 'Bun scripts and OPA prerequisites available.',
      verification: `Validation status ${options.validationReport.status}.`,
      primaryUse: 'Validate ACO readiness.',
      failureMode: 'Missing scripts, failed policy, or traceability drift.',
      fallback: 'Run individual failed checks.',
      owner: 'context-orchestrator',
      lastVerified,
      mutatesTrackedFiles: false,
      requiresApproval: false,
      safety: 'read-only',
      notes: 'Observed through validateContextOrchestrator.',
      confidence: 'observed',
    }),
    commandEntry({
      id: 'cmd.bundled-check',
      command: 'bun run check:bundled',
      category: 'defaults',
      status: packageScripts['check:bundled'] ? 'available' : 'blocked',
      sourceEvidence: packageScripts['check:bundled'] ?? 'unknown',
      invocationPath: 'repo root',
      scope: 'Verify bundled defaults are current.',
      preconditions: '.archon defaults and generated output exist.',
      verification: 'Exit 0 means generated defaults are current.',
      primaryUse: 'Detect default command drift.',
      failureMode: 'Generated defaults stale.',
      fallback: 'Run bun run generate:bundled during implementation.',
      owner: 'workflows',
      lastVerified,
      mutatesTrackedFiles: false,
      requiresApproval: false,
      safety: 'read-only',
      notes: 'Check mode is read-only.',
      confidence: packageScripts['check:bundled'] ? 'declared' : 'unknown',
    }),
    commandEntry({
      id: 'cmd.bundled-generate',
      command: 'bun run generate:bundled',
      category: 'defaults',
      status: 'forbidden',
      sourceEvidence: packageScripts['generate:bundled'] ?? 'unknown',
      invocationPath: 'repo root',
      scope: 'Regenerate bundled defaults.',
      preconditions: 'Default command or workflow files changed.',
      verification: 'Generated file changes, then check:bundled passes.',
      primaryUse: 'Synchronize generated defaults after source changes.',
      failureMode: 'Writes tracked generated file.',
      fallback: 'Use check:bundled to detect drift before mutating.',
      owner: 'workflows',
      lastVerified: 'unknown',
      mutatesTrackedFiles: true,
      requiresApproval: true,
      safety: 'writes-tracked-files',
      notes:
        'Forbidden during read-only discovery; allowed during implementation when defaults changed.',
      confidence: packageScripts['generate:bundled'] ? 'declared' : 'unknown',
    }),
    commandEntry({
      id: 'cmd.format-check',
      command: 'bun run format:check',
      category: 'validation',
      status: packageScripts['format:check'] ? 'available' : 'blocked',
      sourceEvidence: packageScripts['format:check'] ?? 'unknown',
      invocationPath: 'repo root',
      scope: 'Formatting validation.',
      preconditions: 'Dependencies installed.',
      verification: 'Exit 0 means files match Prettier style.',
      primaryUse: 'Pre-PR validation.',
      failureMode: 'Formatting drift.',
      fallback: 'Inspect formatting output; do not run write formatter in read-only discovery.',
      owner: 'repo',
      lastVerified,
      mutatesTrackedFiles: false,
      requiresApproval: false,
      safety: 'read-only',
      notes: 'Check-only command.',
      confidence: packageScripts['format:check'] ? 'declared' : 'unknown',
    }),
    commandEntry({
      id: 'cmd.format-write',
      command: 'bun run format',
      category: 'formatting',
      status: 'forbidden',
      sourceEvidence: packageScripts.format ?? 'unknown',
      invocationPath: 'repo root',
      scope: 'Rewrite files with Prettier.',
      preconditions: 'Formatting changes are intentionally part of implementation.',
      verification: 'Tracked file diff reviewed after command.',
      primaryUse: 'Apply formatting fixes.',
      failureMode: 'Writes broad tracked file changes.',
      fallback: 'Use format:check and targeted manual edits.',
      owner: 'repo',
      lastVerified: 'unknown',
      mutatesTrackedFiles: true,
      requiresApproval: true,
      safety: 'writes-tracked-files',
      notes: 'Forbidden during read-only discovery.',
      confidence: packageScripts.format ? 'declared' : 'unknown',
    }),
    commandEntry({
      id: 'cmd.git-status',
      command: 'git status --short --untracked-files=all',
      category: 'git',
      status: repositoryStatus.status,
      sourceEvidence: repositoryStatus.sourceEvidence,
      invocationPath: 'repo root',
      scope: 'Worktree cleanliness.',
      preconditions: 'Git repository available.',
      verification: repositoryStatus.verification,
      primaryUse: 'Protect user changes before edits.',
      failureMode: 'Dirty worktree or not a git repository.',
      fallback: 'Inspect git state manually.',
      owner: 'repo',
      lastVerified,
      mutatesTrackedFiles: false,
      requiresApproval: false,
      safety: 'read-only',
      notes: repositoryStatus.notes,
      confidence: repositoryStatus.confidence,
    }),
    commandEntry({
      id: 'cmd.lint-fix',
      command: 'bun run lint:fix',
      category: 'lint',
      status: 'forbidden',
      sourceEvidence: packageScripts['lint:fix'] ?? 'unknown',
      invocationPath: 'repo root',
      scope: 'Rewrite lint-fixable files.',
      preconditions: 'Lint fixes intentionally part of implementation.',
      verification: 'Tracked file diff reviewed after command.',
      primaryUse: 'Apply lint fixes.',
      failureMode: 'Writes broad tracked file changes.',
      fallback: 'Use lint check and targeted manual edits.',
      owner: 'repo',
      lastVerified: 'unknown',
      mutatesTrackedFiles: true,
      requiresApproval: true,
      safety: 'writes-tracked-files',
      notes: 'Forbidden during read-only discovery.',
      confidence: packageScripts['lint:fix'] ? 'declared' : 'unknown',
    }),
    commandEntry({
      id: 'cmd.package-script-inspection',
      command: 'read package.json scripts',
      category: 'package-json',
      status: Object.keys(packageScripts).length > 0 ? 'available' : 'blocked',
      sourceEvidence:
        Object.keys(packageScripts).length > 0
          ? `scripts=${Object.keys(packageScripts).sort().join(', ')}`
          : 'package.json scripts unavailable',
      invocationPath: 'repo root/package.json',
      scope: 'Discover commands affecting ACO ledgers and validation.',
      preconditions: 'Readable package.json.',
      verification: `${Object.keys(packageScripts).length} script(s) discovered.`,
      primaryUse: 'Populate command ledger.',
      failureMode: 'Missing or invalid package.json.',
      fallback: 'Record commands as unknown.',
      owner: 'repo',
      lastVerified,
      mutatesTrackedFiles: false,
      requiresApproval: false,
      safety: 'read-only',
      notes: 'Static package script inspection.',
      confidence: Object.keys(packageScripts).length > 0 ? 'observed' : 'unknown',
    }),
    commandEntry({
      id: 'cmd.research-graph',
      command: 'bun run research:graph',
      category: 'research',
      status: 'forbidden',
      sourceEvidence: packageScripts['research:graph'] ?? 'unknown',
      invocationPath: 'repo root',
      scope: 'Regenerate graph evidence.',
      preconditions: 'Research upstreams available.',
      verification: 'Generated graph output reviewed.',
      primaryUse: 'Refresh graph evidence.',
      failureMode: 'Writes generated research artifacts.',
      fallback: 'Use committed graph evidence and record partial confidence.',
      owner: 'context-orchestrator',
      lastVerified: 'unknown',
      mutatesTrackedFiles: true,
      requiresApproval: true,
      safety: 'writes-tracked-files',
      notes: 'Forbidden during read-only discovery.',
      confidence: packageScripts['research:graph'] ? 'declared' : 'unknown',
    }),
    commandEntry({
      id: 'cmd.targeted-context-tests',
      command:
        'bun test packages/context-orchestrator/src/ledgers.test.ts packages/context-orchestrator/src/context-orchestrator.test.ts packages/context-orchestrator/src/telemetry.test.ts',
      category: 'test',
      status: 'deferred',
      sourceEvidence: 'package-local test files.',
      invocationPath: 'repo root',
      scope: 'Ledger/compiler/telemetry test coverage.',
      preconditions: 'Implementation complete.',
      verification: 'All targeted tests pass.',
      primaryUse: 'Focused validation before broader gates.',
      failureMode: 'Behavioral regression in ledger or compile path.',
      fallback: 'Run a smaller failing test file and fix.',
      owner: 'context-orchestrator',
      lastVerified: 'unknown',
      mutatesTrackedFiles: false,
      requiresApproval: false,
      safety: 'read-only',
      notes: 'Deferred until implementation exists.',
      confidence: 'declared',
    }),
    commandEntry({
      id: 'cmd.type-check',
      command: 'bun run type-check',
      category: 'validation',
      status: packageScripts['type-check'] ? 'available' : 'blocked',
      sourceEvidence: packageScripts['type-check'] ?? 'unknown',
      invocationPath: 'repo root',
      scope: 'TypeScript validation.',
      preconditions: 'Dependencies installed.',
      verification: 'Exit 0 means TypeScript passes.',
      primaryUse: 'Pre-PR validation.',
      failureMode: 'Type errors.',
      fallback: 'Run package-local type-check.',
      owner: 'repo',
      lastVerified,
      mutatesTrackedFiles: false,
      requiresApproval: false,
      safety: 'read-only',
      notes: 'Check-only command.',
      confidence: packageScripts['type-check'] ? 'declared' : 'unknown',
    }),
    commandEntry({
      id: 'cmd.validate',
      command: 'bun run validate',
      category: 'validation',
      status: packageScripts.validate ? 'deferred' : 'blocked',
      sourceEvidence: packageScripts.validate ?? 'unknown',
      invocationPath: 'repo root',
      scope: 'Full repository validation.',
      preconditions: 'Narrower gates pass first.',
      verification: 'Exit 0 means CI-equivalent local validation passed.',
      primaryUse: 'Final validation gate.',
      failureMode: 'Any check, lint, format, type, policy, traceability, or test failure.',
      fallback: 'Run narrower failed command.',
      owner: 'repo',
      lastVerified: 'unknown',
      mutatesTrackedFiles: false,
      requiresApproval: false,
      safety: 'read-only',
      notes: 'Deferred until targeted gates pass.',
      confidence: packageScripts.validate ? 'declared' : 'unknown',
    }),
  ];

  if (packageScripts['research:validate-corpus']) {
    commands.push(
      commandEntry({
        id: 'cmd.research-validate-corpus',
        command: 'bun run research:validate-corpus',
        category: 'research',
        status: 'available',
        sourceEvidence: packageScripts['research:validate-corpus'],
        invocationPath: 'repo root',
        scope: 'Validate committed ACO research corpus.',
        preconditions: 'Research corpus files exist.',
        verification: 'Exit 0 means corpus validation passes.',
        primaryUse: 'Evidence corpus validation.',
        failureMode: 'Missing or stale corpus data.',
        fallback: 'Inspect failing corpus file.',
        owner: 'context-orchestrator',
        lastVerified,
        mutatesTrackedFiles: false,
        requiresApproval: false,
        safety: 'read-only',
        notes: 'Declared package script.',
        confidence: 'declared',
      })
    );
  }

  return commands;
}

function toolEntry(entry: ToolEntryDraft): ToolAvailabilityLedgerEntry {
  return {
    ...entry,
    confidence: entry.confidence ?? statusToConfidence(entry.status),
    evidence: entry.evidence ?? [evidenceFromEntry(entry, entry.confidence)],
  };
}

function commandEntry(entry: CommandEntryDraft): CommandLedgerEntry {
  return {
    ...entry,
    confidence: entry.confidence ?? statusToConfidence(entry.status),
    evidence: entry.evidence ?? [evidenceFromEntry(entry, entry.confidence)],
  };
}

function evidenceFromEntry(
  entry: Pick<LedgerEntryBase, 'sourceEvidence' | 'invocationPath' | 'verification' | 'status'>,
  confidence?: LedgerConfidence
): LedgerEvidence {
  return {
    sourceType: sourceTypeFromConfidence(confidence ?? statusToConfidence(entry.status)),
    sourceEvidence: entry.sourceEvidence,
    invocationPath: entry.invocationPath,
    confidence: confidence ?? statusToConfidence(entry.status),
    reason: entry.verification,
  };
}

function normalizeToolEntry(entry: ToolAvailabilityLedgerEntry): ToolAvailabilityLedgerEntry {
  const normalized = normalizeEntryBase(entry);
  return {
    ...normalized,
    name: redactAndRequire(entry.name, `${entry.id}.name`),
  };
}

function normalizeCommandEntry(entry: CommandLedgerEntry): CommandLedgerEntry {
  const normalized = normalizeEntryBase(entry);
  if (!commandSafetyValues.has(entry.safety)) {
    throw new Error(`Invalid command safety for ${entry.id}: ${entry.safety}`);
  }
  if ((entry.requiresApproval || entry.mutatesTrackedFiles) && entry.notes.trim().length === 0) {
    throw new Error(`Command ${entry.id} requires notes explaining approval or mutation risk.`);
  }
  return {
    ...normalized,
    command: redactAndRequire(entry.command, `${entry.id}.command`),
    mutatesTrackedFiles: entry.mutatesTrackedFiles,
    requiresApproval: entry.requiresApproval,
    safety: entry.safety,
  };
}

function normalizeEntryBase<T extends LedgerEntryBase>(entry: T): T {
  if (!ledgerStatuses.has(entry.status)) {
    throw new Error(`Invalid ledger status for ${entry.id}: ${entry.status}`);
  }
  const evidence = entry.evidence.map(item => normalizeEvidence(item, entry.id));
  if (entry.status !== 'unknown' && evidence.length === 0) {
    throw new Error(`Ledger entry ${entry.id} must include evidence for status ${entry.status}.`);
  }
  if (entry.status !== 'unknown' && entry.sourceEvidence.trim().length === 0) {
    throw new Error(`Ledger entry ${entry.id} must include sourceEvidence.`);
  }

  return {
    ...entry,
    id: redactAndRequire(entry.id, 'id'),
    category: redactAndRequire(entry.category, `${entry.id}.category`),
    status: entry.status,
    sourceEvidence: redactText(entry.sourceEvidence),
    invocationPath: redactAndRequire(entry.invocationPath, `${entry.id}.invocationPath`),
    scope: redactAndRequire(entry.scope, `${entry.id}.scope`),
    preconditions: redactAndRequire(entry.preconditions, `${entry.id}.preconditions`),
    verification: redactAndRequire(entry.verification, `${entry.id}.verification`),
    primaryUse: redactAndRequire(entry.primaryUse, `${entry.id}.primaryUse`),
    failureMode: redactAndRequire(entry.failureMode, `${entry.id}.failureMode`),
    fallback: redactAndRequire(entry.fallback, `${entry.id}.fallback`),
    owner: redactAndRequire(entry.owner, `${entry.id}.owner`),
    lastVerified: redactAndRequire(entry.lastVerified, `${entry.id}.lastVerified`),
    notes: redactText(entry.notes),
    confidence: entry.confidence,
    evidence,
  };
}

function normalizeEvidence(evidence: LedgerEvidence, entryId: string): LedgerEvidence {
  return {
    sourceType: evidence.sourceType,
    sourceEvidence: redactAndRequire(evidence.sourceEvidence, `${entryId}.evidence.sourceEvidence`),
    invocationPath: redactAndRequire(evidence.invocationPath, `${entryId}.evidence.invocationPath`),
    confidence: evidence.confidence,
    reason: redactAndRequire(evidence.reason, `${entryId}.evidence.reason`),
  };
}

function summarizeEntries(entries: { status: LedgerStatus }[]): LedgerSummary {
  const counts = emptyStatusCounts();
  for (const entry of entries) {
    counts[entry.status] += 1;
  }
  return {
    total: entries.length,
    counts,
  };
}

function emptyStatusCounts(): LedgerStatusCounts {
  return Object.fromEntries(ledgerStatusOrder.map(status => [status, 0])) as LedgerStatusCounts;
}

function combineSummaries(first: LedgerSummary, second: LedgerSummary): LedgerSummary {
  const counts = emptyStatusCounts();
  for (const status of ledgerStatusOrder) {
    counts[status] = first.counts[status] + second.counts[status];
  }
  return {
    total: first.total + second.total,
    counts,
  };
}

async function readPackageScripts(cwd: string): Promise<Record<string, string>> {
  try {
    const parsed = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    return parsed.scripts ?? {};
  } catch {
    return {};
  }
}

async function getRepositoryStatusEvidence(cwd: string): Promise<RepositoryStatusEvidence> {
  try {
    const proc = Bun.spawn(['git', 'status', '--short', '--untracked-files=all'], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    const lines = stdout.split(/\r?\n/).filter(line => line.trim().length > 0);
    const tracked = lines.filter(line => !line.startsWith('??')).length;
    const untracked = lines.length - tracked;

    if (exitCode === 0) {
      const clean = lines.length === 0;
      return {
        status: clean ? 'available' : 'partial',
        sourceEvidence: `git status exited 0; clean=${String(clean)}; tracked=${tracked}; untracked=${untracked}.`,
        verification: clean ? 'Worktree is clean.' : `Worktree has ${lines.length} status row(s).`,
        notes: clean
          ? 'No tracked or untracked files reported.'
          : 'Worktree has tracked or untracked changes; inspect git status before editing.',
        confidence: 'observed',
      };
    }

    return {
      status: 'blocked',
      sourceEvidence: `git status failed with exit ${exitCode}: ${compactCommandOutput(stderr || stdout)}`,
      verification: 'Git status command failed.',
      notes: 'Repository status could not be observed with git status.',
      confidence: 'observed',
    };
  } catch (error) {
    return {
      status: 'blocked',
      sourceEvidence: `git status could not be executed: ${error instanceof Error ? error.message : String(error)}`,
      verification: 'Git status command could not be executed.',
      notes: 'Repository status could not be observed with git status.',
      confidence: 'observed',
    };
  }
}

function graphSourceEvidence(graphContext: GraphContext): string {
  if (graphContext.waivers.length === 0) return graphContext.summary;
  return `${graphContext.summary} Waiver evidence: ${graphContext.waivers
    .map(waiver => `${waiver.id}(${waiver.repository})`)
    .join(', ')}.`;
}

function graphWaiverNotes(graphContext: GraphContext): string {
  return graphContext.waivers
    .map(
      waiver =>
        `${waiver.id}: owner=${waiver.owner}; reason=${waiver.reason}; evidence=${waiver.evidence}; expiry=${waiver.expiryCondition}`
    )
    .join(' | ');
}

function compactCommandOutput(output: string): string {
  const compact = output.replace(/\s+/g, ' ').trim();
  if (compact.length === 0) return 'no output';
  return compact.length > 240 ? `${compact.slice(0, 237)}...` : compact;
}

function checkById(report: ValidationReport, id: string): ValidationCheck | undefined {
  return report.checks.find(check => check.id === id);
}

function validationSummary(report: ValidationReport): string {
  const summary = report.checks.map(check => `${check.id}:${check.status}`).join(', ');
  return summary.length > 0 ? summary : `validation:${report.status}`;
}

function graphToLedgerStatus(status: GraphContext['status']): LedgerStatus {
  if (status === 'available') return 'available';
  if (status === 'partial') return 'partial';
  return 'blocked';
}

function validationToLedgerStatus(status: ValidationReport['status']): LedgerStatus {
  if (status === 'passed') return 'available';
  if (status === 'warning') return 'partial';
  return 'blocked';
}

function validationCheckToLedgerStatus(check: ValidationCheck | undefined): LedgerStatus {
  if (!check) return 'unknown';
  if (check.status === 'passed') return 'available';
  if (check.status === 'warning') return 'partial';
  return 'blocked';
}

function statusToConfidence(status: LedgerStatus): LedgerConfidence {
  if (status === 'unknown') return 'unknown';
  if (status === 'not used' || status === 'deferred' || status === 'forbidden') return 'declared';
  return 'observed';
}

function sourceTypeFromConfidence(confidence: LedgerConfidence): LedgerEvidence['sourceType'] {
  if (confidence === 'observed') return 'command';
  if (confidence === 'declared') return 'file';
  if (confidence === 'inferred') return 'static';
  return 'unknown';
}

function hasScripts(packageScripts: Record<string, string>, scriptNames: string[]): boolean {
  return scriptNames.every(scriptName => packageScripts[scriptName] !== undefined);
}

function toLastVerified(timestamp: string | undefined): string {
  return timestamp?.slice(0, 10) ?? 'unknown';
}

function compareById<T extends { id: string }>(left: T, right: T): number {
  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return 0;
}

function renderSummaryMarkdown(summary: LedgerSummary): string {
  return [
    '## Summary',
    '',
    `Total: ${summary.total}`,
    '',
    '| Status | Count |',
    '|---|---|',
    ...ledgerStatusOrder.map(status => `| ${status} | ${summary.counts[status]} |`),
  ].join('\n');
}

function redactAndRequire(value: string, field: string): string {
  const redacted = redactText(value);
  if (redacted.trim().length === 0) {
    throw new Error(`Ledger field ${field} must be a non-empty string.`);
  }
  return redacted;
}

function redactText(value: string): string {
  return redactSecrets(value);
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|');
}
