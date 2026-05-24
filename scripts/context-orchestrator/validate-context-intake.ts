import { readFile } from 'fs/promises';
import { join } from 'path';

export const CONTEXT_INTAKE_SCHEMA_VERSION = 'aco.context-intake.v1' as const;

export type ContextIntakeState = 'ready' | 'blocked' | 'needs_decision' | 'unknown';
export type ContextIntakeSeverity = 'blocker' | 'warning';
export type ContextIntakeCode =
  | 'developer_local_path'
  | 'branch_specific_assumption'
  | 'undeclared_private_tool'
  | 'provider_specific_default'
  | 'tracked_runtime_or_user_local_artifact'
  | 'static_runtime_readiness_claim'
  | 'generated_artifact_without_lifecycle'
  | 'readiness_claim_without_evidence'
  | 'scan_incomplete';

export interface ContextIntakeFinding {
  code: ContextIntakeCode;
  severity: ContextIntakeSeverity;
  path: string;
  line: number;
  excerpt: string;
  message: string;
}

export interface ContextIntakeReason {
  code: ContextIntakeCode;
  severity: ContextIntakeSeverity;
  count: number;
  message: string;
}

export interface ContextIntakeEvidence {
  kind: 'git_index' | 'finding';
  path?: string;
  line?: number;
  summary: string;
}

export interface ContextIntakeReport {
  schemaVersion: typeof CONTEXT_INTAKE_SCHEMA_VERSION;
  state: ContextIntakeState;
  summary: string;
  reasons: ContextIntakeReason[];
  blockers: ContextIntakeFinding[];
  warnings: ContextIntakeFinding[];
  evidence: ContextIntakeEvidence[];
  nextRecommendedAction: string;
  checkedAt?: string;
}

export interface ContextIntakeSurface {
  path: string;
  content: string;
}

export interface ContextIntakeOptions {
  cwd: string;
  timestamp?: string;
  surfaces?: ContextIntakeSurface[];
}

const reusableFiles = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'package.json',
  '.claude/settings.json',
  '.codex/hooks.json',
  '.mcp.json',
]);

const reusablePrefixes = [
  '.archon/commands/defaults/',
  '.archon/workflows/defaults/',
  '.claude/agents/',
  '.claude/commands/',
  '.claude/skills/',
  '.codex/',
  '.github/agents/',
  '.github/prompts/',
  '.github/workflows/',
  'docs/',
];

const textFilePattern = /\.(?:cjs|csv|js|json|md|mjs|sh|toml|ts|tsx|txt|yaml|yml)$/i;
const localPathPattern =
  /\/Users\/(?!<|YourName\b|runner\b)([A-Za-z0-9._-]+)(?:\/[^\s'"`)<\]}]*)?|\/home\/(?!<|appuser\b|deploy\b|runner\b|user\b|test\b|dev\b)([A-Za-z0-9._-]+)(?:\/[^\s'"`)<\]}]*)?/g;
const branchPattern =
  /(?<![.\w-])(?:codex|spike|stabilization|wip)\/[A-Za-z0-9._/-]+|\bstab-\d{3}\b|\/goal stabilize-aco-merge-ready\b/g;
const runtimeClaimPattern =
  /\b(?:Context7|ctx7|MCP|Graphify|OpenAI Docs|OpenAI docs|openai-docs-mcp)\s+(?:(?:is|are)\s+)?(?:ready|available|verified_available|installed)\b|\b(?:ready|available|verified_available|installed)\s*:\s*(?:Context7|ctx7|MCP|Graphify|OpenAI Docs|OpenAI docs|openai-docs-mcp)\b/i;
const readinessClaimPattern =
  /\b(?:Final recommendation|Readiness|merge-ready|production-ready|ready for merge)\b.{0,120}\b(?:ready|passed|complete|available|ready_with_approved_graph_waivers)\b/i;

export async function evaluateContextIntake(
  options: ContextIntakeOptions
): Promise<ContextIntakeReport> {
  const scan =
    options.surfaces === undefined
      ? await readTrackedReusableSurfaces(options.cwd)
      : { surfaces: options.surfaces, scanErrors: [] };
  const findings = scan.surfaces.flatMap(inspectSurface);

  for (const scanError of scan.scanErrors) {
    findings.push({
      code: 'scan_incomplete',
      severity: 'warning',
      path: scanError.path,
      line: 0,
      excerpt: excerpt(scanError.message),
      message: `${messageForCode('scan_incomplete')} ${scanError.message}`,
    });
  }

  const blockers = findings.filter(finding => finding.severity === 'blocker');
  const warnings = findings.filter(finding => finding.severity === 'warning');
  const state: ContextIntakeState =
    blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'unknown' : 'ready';

  return {
    schemaVersion: CONTEXT_INTAKE_SCHEMA_VERSION,
    state,
    summary: summaryFor(state, scan.surfaces.length, blockers.length, warnings.length),
    reasons: summarizeReasons(findings),
    blockers,
    warnings,
    evidence: evidenceFor(scan.surfaces.length, findings),
    nextRecommendedAction: nextActionFor(state),
    checkedAt: options.timestamp,
  };
}

export function renderContextIntakeReport(report: ContextIntakeReport): string {
  return [
    '# ACO Context Intake Gate',
    '',
    `State: ${report.state}`,
    `Summary: ${report.summary}`,
    `Next: ${report.nextRecommendedAction}`,
    '',
    '## Reasons',
    ...renderReasons(report.reasons),
    '',
    '## Blockers',
    ...renderFindings(report.blockers),
    '',
    '## Warnings',
    ...renderFindings(report.warnings),
  ].join('\n');
}

async function readTrackedReusableSurfaces(cwd: string): Promise<{
  surfaces: ContextIntakeSurface[];
  scanErrors: { path: string; message: string }[];
}> {
  const proc = Bun.spawn(['git', 'ls-files', '-z'], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    return {
      surfaces: [],
      scanErrors: [
        {
          path: '.',
          message: stderr.trim() || `git ls-files exited ${String(exitCode)}`,
        },
      ],
    };
  }

  const paths = stdout
    .split('\0')
    .map(normalizePath)
    .filter(path => path.length > 0 && isReusableSurface(path));
  const surfaces: ContextIntakeSurface[] = [];
  const scanErrors: { path: string; message: string }[] = [];

  for (const path of paths) {
    if (!textFilePattern.test(path)) {
      if (isTrackedRuntimeOrUserLocalArtifact(path)) surfaces.push({ path, content: '' });
      continue;
    }
    try {
      surfaces.push({ path, content: await readFile(join(cwd, path), 'utf8') });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      scanErrors.push({ path, message: `Could not read tracked context surface: ${message}` });
    }
  }

  return { surfaces, scanErrors };
}

function inspectSurface(surface: ContextIntakeSurface): ContextIntakeFinding[] {
  const path = normalizePath(surface.path);
  const lines = surface.content.split(/\r?\n/);
  const findings: ContextIntakeFinding[] = [];

  const trackedLocalFinding = trackedRuntimeOrUserLocalArtifactFinding(path);
  if (trackedLocalFinding !== null) findings.push(trackedLocalFinding);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const lineNumber = index + 1;
    const context = {
      path,
      line,
      lineNumber,
      window: lines.slice(Math.max(0, index - 4), index + 3).join('\n'),
    };

    if (matches(localPathPattern, line) && !isClearlyMarkedFixture(context)) {
      findings.push(finding(context, 'developer_local_path', 'blocker'));
    }
    if (matches(branchPattern, line) && !isClearlyMarkedFixture(context)) {
      findings.push(
        finding(
          context,
          'branch_specific_assumption',
          path.startsWith('.archon/') ? 'blocker' : 'warning'
        )
      );
    }
    if (usesPrivateToolByDefault(context)) {
      findings.push(finding(context, 'undeclared_private_tool', 'blocker'));
    }
    if (runtimeClaimPattern.test(line) && !hasRuntimeEvidence(context.window)) {
      findings.push(finding(context, 'static_runtime_readiness_claim', 'blocker'));
    }
    if (
      readinessClaimPattern.test(line) &&
      isReadinessClaimSurface(path) &&
      !isExpectedOrConditionalClaim(context) &&
      !hasReadinessEvidence(context.window)
    ) {
      findings.push(finding(context, 'readiness_claim_without_evidence', 'blocker'));
    }
  }

  const providerFinding = providerSpecificDefaultFinding(path, surface.content);
  if (providerFinding !== null) findings.push(providerFinding);

  const generatedFinding = generatedArtifactFinding(path, surface.content);
  if (generatedFinding !== null) findings.push(generatedFinding);

  return findings;
}

function providerSpecificDefaultFinding(
  path: string,
  content: string
): ContextIntakeFinding | null {
  if (
    path !== '.claude/settings.json' &&
    path !== '.codex/hooks.json' &&
    path !== '.mcp.json' &&
    !path.startsWith('.claude/hooks/') &&
    !path.startsWith('.codex/hooks/')
  ) {
    return null;
  }

  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!isProviderDefaultLine(line)) continue;

    return {
      code: 'provider_specific_default',
      severity: 'blocker',
      path,
      line: index + 1,
      excerpt: excerpt(line),
      message: messageForCode('provider_specific_default'),
    };
  }

  return null;
}

function generatedArtifactFinding(path: string, content: string): ContextIntakeFinding | null {
  if (!looksGenerated(path, content)) return null;
  if (hasLifecycle(content)) return null;

  return {
    code: 'generated_artifact_without_lifecycle',
    severity: 'blocker',
    path,
    line: 1,
    excerpt: excerpt(firstContentLine(content)),
    message: messageForCode('generated_artifact_without_lifecycle'),
  };
}

function usesPrivateToolByDefault(context: InspectionContext): boolean {
  if (!/\bkild\b/.test(context.line)) return false;
  if (/\b(?:must not|removed)\b/i.test(context.line)) return false;
  if (isRunnableCommandLine(context.line)) return isExecutableSurface(context.path);
  if (/\b(?:user-local|opt-in|optional|proposal|template|command -v)\b/i.test(context.line)) {
    return false;
  }
  return isExecutableSurface(context.path);
}

function finding(
  context: InspectionContext,
  code: ContextIntakeCode,
  severity: ContextIntakeSeverity
): ContextIntakeFinding {
  return {
    code,
    severity,
    path: context.path,
    line: context.lineNumber,
    excerpt: excerpt(context.line),
    message: messageForCode(code),
  };
}

function isReusableSurface(path: string): boolean {
  return (
    reusableFiles.has(path) ||
    reusablePrefixes.some(prefix => path.startsWith(prefix)) ||
    isTrackedRuntimeOrUserLocalArtifact(path)
  );
}

function trackedRuntimeOrUserLocalArtifactFinding(path: string): ContextIntakeFinding | null {
  if (!isTrackedRuntimeOrUserLocalArtifact(path)) return null;

  return {
    code: 'tracked_runtime_or_user_local_artifact',
    severity: 'blocker',
    path,
    line: 1,
    excerpt: excerpt(path),
    message: messageForCode('tracked_runtime_or_user_local_artifact'),
  };
}

function isTrackedRuntimeOrUserLocalArtifact(path: string): boolean {
  return (
    path === '_bmad/config.user.toml' ||
    /^_bmad\/custom\/[^/]+\.user\.toml$/u.test(path) ||
    path.startsWith('_bmad-output/') ||
    path.startsWith('.archon/mcp/') ||
    path === '.codex/auth.json' ||
    path === '.claude/settings.local.json' ||
    path === 'aco_codex_conversation_transfer.md'
  );
}

function isExecutableSurface(path: string): boolean {
  return (
    path.startsWith('.archon/commands/defaults/') ||
    path.startsWith('.archon/workflows/defaults/') ||
    path.startsWith('.claude/commands/') ||
    path === '.claude/settings.json' ||
    path === '.codex/hooks.json' ||
    path.startsWith('.claude/skills/')
  );
}

function isClearlyMarkedFixture(context: InspectionContext): boolean {
  const path = context.path.toLowerCase();
  const markedPath =
    path.includes('/fixtures/') ||
    path.includes('/fixture/') ||
    path.includes('/examples/') ||
    path.includes('/example/') ||
    path.includes('/tests/') ||
    path.includes('.test.');
  if (!markedPath) return false;
  return /\b(?:fixture|example|e\.g\.|mock|fake|test|redaction|rejection|path traversal)\b/i.test(
    context.window
  );
}

function isReadinessClaimSurface(path: string): boolean {
  return (
    path.startsWith('docs/') ||
    path.startsWith('.archon/commands/defaults/') ||
    path.startsWith('.claude/commands/') ||
    path.startsWith('.archon/workflows/defaults/')
  );
}

function isExpectedOrConditionalClaim(context: InspectionContext): boolean {
  return (
    /\bExpected\b/i.test(context.window) && /\b(?:if|when|should|expected)\b/i.test(context.line)
  );
}

function hasRuntimeEvidence(window: string): boolean {
  return (
    /\b(?:runtime verification|verificationSource|command output|checkedAt)\b/i.test(window) &&
    /\b(?:passed|failed|blocked|runtime|command|tool|verified_available|configured_but_not_reachable|not_configured|deferred_by_design|\d{4}-\d{2}-\d{2})\b/i.test(
      window
    )
  );
}

function hasReadinessEvidence(window: string): boolean {
  return (
    /\b(?:evidence|validation command|command result|tests run|gate result|blockers|reasons)\s*:/i.test(
      window
    ) &&
    /\b(?:bun run|npm run|pnpm|yarn|pytest|exit\s+[0-9]+|passed|failed|blocked|waiver)\b/i.test(
      window
    )
  );
}

function isProviderDefaultLine(line: string): boolean {
  return (
    /["'](?:hooks?|mcpServers|mcp|command|settings)["']\s*:/i.test(line) ||
    /^\s*(?:hooks?|mcpServers|mcp|command|settings)\s*=/i.test(line)
  );
}

function isRunnableCommandLine(line: string): boolean {
  return /["']command["']\s*:|^\s*command\s*=/i.test(line);
}

function looksGenerated(path: string, content: string): boolean {
  const name = path.split('/').at(-1) ?? path;
  return (
    path.startsWith('docs/') &&
    /\b(?:report|snapshot|inventory|matrix|scorecard|ledger)\b/i.test(name) &&
    /\b(?:Generated|Final recommendation|Validation|Checkpoint|Inventory|Scorecard)\b/i.test(
      content
    )
  );
}

function hasLifecycle(content: string): boolean {
  return (
    /\bconsumer\b/i.test(content) &&
    /\bsource input\b/i.test(content) &&
    /\bregeneration command\b/i.test(content) &&
    /\b(?:drift|removal) (?:policy|rule)\b/i.test(content) &&
    /\bowner surface\b/i.test(content)
  );
}

function summarizeReasons(findings: ContextIntakeFinding[]): ContextIntakeReason[] {
  const byKey = new Map<string, ContextIntakeReason>();
  for (const item of findings) {
    const key = `${item.code}:${item.severity}`;
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, {
        code: item.code,
        severity: item.severity,
        count: 1,
        message: item.message,
      });
    } else {
      existing.count += 1;
    }
  }
  return [...byKey.values()].sort((left, right) => left.code.localeCompare(right.code));
}

function evidenceFor(count: number, findings: ContextIntakeFinding[]): ContextIntakeEvidence[] {
  return [
    {
      kind: 'git_index',
      summary: `Scanned ${String(count)} tracked reusable context surface(s).`,
    },
    ...findings.slice(0, 20).map(item => ({
      kind: 'finding' as const,
      path: item.path,
      line: item.line,
      summary: `${item.code}: ${item.message}`,
    })),
  ];
}

function summaryFor(
  state: ContextIntakeState,
  surfaceCount: number,
  blockerCount: number,
  warningCount: number
): string {
  if (state === 'ready') {
    return `Scanned ${String(surfaceCount)} reusable context surface(s); no context intake findings.`;
  }
  return `Scanned ${String(surfaceCount)} reusable context surface(s); ${String(blockerCount)} blocker(s), ${String(warningCount)} warning(s).`;
}

function nextActionFor(state: ContextIntakeState): string {
  switch (state) {
    case 'ready':
      return 'Proceed to the next ACO stage and keep this gate in scoped validation.';
    case 'blocked':
      return 'Remove contaminated reusable context, add lifecycle metadata, or convert provider/private-tool defaults to explicit opt-in proposals.';
    case 'needs_decision':
      return 'Choose an owner or policy exception before proceeding.';
    case 'unknown':
      return 'Resolve warnings or scan gaps, then rerun the context intake gate.';
  }
}

function messageForCode(code: ContextIntakeCode): string {
  switch (code) {
    case 'developer_local_path':
      return 'Developer-local absolute path appears in committed reusable context.';
    case 'branch_specific_assumption':
      return 'Branch-specific assumption appears in committed reusable context.';
    case 'undeclared_private_tool':
      return 'Private/local tool is referenced as runnable without explicit opt-in capability.';
    case 'provider_specific_default':
      return 'Provider-specific hook/config default is committed without explicit opt-in.';
    case 'tracked_runtime_or_user_local_artifact':
      return 'Runtime, auth, MCP, or user-local artifact is tracked instead of remaining local.';
    case 'static_runtime_readiness_claim':
      return 'Runtime readiness is claimed from static text without verification evidence.';
    case 'generated_artifact_without_lifecycle':
      return 'Generated artifact lacks consumer, source input, regeneration command, drift/removal policy, or owner surface.';
    case 'readiness_claim_without_evidence':
      return 'Readiness claim lacks nearby evidence or gate reference.';
    case 'scan_incomplete':
      return 'Context intake scan could not inspect all required surfaces.';
  }
}

function renderReasons(reasons: ContextIntakeReason[]): string[] {
  if (reasons.length === 0) return ['- none'];
  return reasons.map(
    reason => `- ${reason.code} (${reason.severity}, ${String(reason.count)}): ${reason.message}`
  );
}

function renderFindings(findings: ContextIntakeFinding[]): string[] {
  if (findings.length === 0) return ['- none'];
  return findings.map(
    item => `- ${item.path}:${String(item.line)} ${item.code} (${item.severity}) - ${item.excerpt}`
  );
}

function matches(pattern: RegExp, text: string): boolean {
  pattern.lastIndex = 0;
  const found = pattern.test(text);
  pattern.lastIndex = 0;
  return found;
}

function firstContentLine(content: string): string {
  return content.split(/\r?\n/).find(line => line.trim().length > 0) ?? '';
}

function excerpt(line: string): string {
  const clean = line.trim().replace(/\s+/g, ' ');
  if (clean.length === 0) return '<empty>';
  return clean.length > 180 ? `${clean.slice(0, 177)}...` : clean;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

interface InspectionContext {
  path: string;
  line: string;
  lineNumber: number;
  window: string;
}

interface CliOptions {
  cwd: string;
  json: boolean;
  timestamp?: string;
}

function parseArgs(args: string[]): CliOptions {
  let cwd = process.cwd();
  let json = false;
  let timestamp: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--cwd' && args[index + 1] !== undefined) {
      cwd = args[index + 1] ?? cwd;
      index += 1;
    } else if (arg === '--timestamp' && args[index + 1] !== undefined) {
      timestamp = args[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return { cwd, json, timestamp };
}

async function main(args: string[]): Promise<number> {
  const options = parseArgs(args);
  const report = await evaluateContextIntake({
    cwd: options.cwd,
    timestamp: options.timestamp,
  });
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderContextIntakeReport(report));
  }
  return report.state === 'ready' ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ACO context intake failed: ${message}`);
    process.exitCode = 1;
  }
}
