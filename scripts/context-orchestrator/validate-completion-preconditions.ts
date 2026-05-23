import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export const COMPLETION_PRECONDITIONS_SCHEMA_VERSION = 'aco.completion-preconditions.v1' as const;

export type CompletionPreconditionsState = 'ready' | 'blocked' | 'needs_decision' | 'unknown';
export type CompletionPreconditionsSeverity = 'blocker' | 'decision' | 'warning';
export type CompletionPreconditionsCode =
  | 'detached_head'
  | 'invalid_branch_name'
  | 'dirty_worktree'
  | 'missing_upstream'
  | 'branch_behind_upstream'
  | 'branch_ahead_upstream'
  | 'git_inspection_failed';

export interface CompletionPreconditionsFinding {
  code: CompletionPreconditionsCode;
  severity: CompletionPreconditionsSeverity;
  message: string;
  evidence?: string;
}

export interface CompletionPreconditionsReason {
  code: CompletionPreconditionsCode;
  severity: CompletionPreconditionsSeverity;
  count: number;
  message: string;
}

export interface CompletionPreconditionsEvidence {
  kind: 'git' | 'finding';
  summary: string;
}

export interface CompletionPreconditionsReport {
  schemaVersion: typeof COMPLETION_PRECONDITIONS_SCHEMA_VERSION;
  state: CompletionPreconditionsState;
  summary: string;
  reasons: CompletionPreconditionsReason[];
  blockers: CompletionPreconditionsFinding[];
  warnings: CompletionPreconditionsFinding[];
  evidence: CompletionPreconditionsEvidence[];
  nextRecommendedAction: string;
  checkedAt?: string;
}

export interface GitPreconditionSnapshot {
  branch: string;
  porcelainStatus: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  inspectionErrors?: string[];
}

export interface CompletionPreconditionsOptions {
  cwd: string;
  timestamp?: string;
  snapshot?: GitPreconditionSnapshot;
}

const safeBranchPattern = /^[A-Za-z0-9._/-]+$/;
const unsafeShellPattern = /[\s;&|$`"'(){}<>\\[\]*?!#\n\r\t]/;
const allowedPrefixes = [
  'archon/',
  'codex/',
  'stabilization/',
  'feature/',
  'feat/',
  'fix/',
  'bugfix/',
  'chore/',
  'docs/',
  'refactor/',
  'test/',
  'hotfix/',
  'release/',
];
const allowedExact = new Set(['main', 'dev', 'develop']);

export async function evaluateCompletionPreconditions(
  options: CompletionPreconditionsOptions
): Promise<CompletionPreconditionsReport> {
  const snapshot = options.snapshot ?? collectGitSnapshot(options.cwd);
  const findings = inspectSnapshot(snapshot);
  const blockers = findings.filter(finding => finding.severity === 'blocker');
  const decisions = findings.filter(finding => finding.severity === 'decision');
  const warnings = findings.filter(finding => finding.severity === 'warning');
  const unknownWarnings = warnings.filter(finding => finding.code !== 'branch_ahead_upstream');
  const state: CompletionPreconditionsState =
    blockers.length > 0
      ? 'blocked'
      : decisions.length > 0
        ? 'needs_decision'
        : unknownWarnings.length > 0
          ? 'unknown'
          : 'ready';

  return {
    schemaVersion: COMPLETION_PRECONDITIONS_SCHEMA_VERSION,
    state,
    summary: summaryFor(state, blockers.length, decisions.length, warnings.length),
    reasons: summarizeReasons(findings),
    blockers: [...blockers, ...decisions],
    warnings,
    evidence: evidenceFor(snapshot, findings),
    nextRecommendedAction: nextActionFor(state),
    checkedAt: options.timestamp,
  };
}

export function renderCompletionPreconditionsReport(report: CompletionPreconditionsReport): string {
  return [
    '# ACO Completion Preconditions Gate',
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

function collectGitSnapshot(cwd: string): GitPreconditionSnapshot {
  const root = resolve(cwd);
  const inspectionErrors: string[] = [];
  const branchResult = git(root, ['branch', '--show-current']);
  const statusResult = git(root, ['status', '--porcelain']);
  const upstreamResult = git(root, [
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{upstream}',
  ]);

  if (!branchResult.ok) inspectionErrors.push(`branch: ${branchResult.stderr}`);
  if (!statusResult.ok) inspectionErrors.push(`status: ${statusResult.stderr}`);

  const snapshot: GitPreconditionSnapshot = {
    branch: branchResult.stdout.trim(),
    porcelainStatus: statusResult.stdout,
    inspectionErrors,
  };

  if (upstreamResult.ok && upstreamResult.stdout.trim().length > 0) {
    snapshot.upstream = upstreamResult.stdout.trim();
    const countsResult = git(root, [
      'rev-list',
      '--left-right',
      '--count',
      `${snapshot.upstream}...HEAD`,
    ]);
    if (countsResult.ok) {
      const [behindRaw, aheadRaw] = countsResult.stdout.trim().split(/\s+/);
      const behind = Number(behindRaw);
      const ahead = Number(aheadRaw);
      if (Number.isFinite(behind)) snapshot.behind = behind;
      if (Number.isFinite(ahead)) snapshot.ahead = ahead;
    } else {
      inspectionErrors.push(`upstream comparison: ${countsResult.stderr}`);
    }
  }

  return snapshot;
}

function inspectSnapshot(snapshot: GitPreconditionSnapshot): CompletionPreconditionsFinding[] {
  const findings: CompletionPreconditionsFinding[] = [];

  for (const error of snapshot.inspectionErrors ?? []) {
    findings.push(finding('git_inspection_failed', 'warning', error));
  }

  if (snapshot.branch.trim().length === 0) {
    findings.push(finding('detached_head', 'blocker', 'Current checkout is detached.'));
  } else {
    for (const error of validateBranchName(snapshot.branch)) {
      findings.push(finding('invalid_branch_name', 'blocker', error));
    }
  }

  if (snapshot.porcelainStatus.trim().length > 0) {
    findings.push(
      finding(
        'dirty_worktree',
        'blocker',
        'Working tree has uncommitted or untracked changes.',
        summarizePorcelain(snapshot.porcelainStatus)
      )
    );
  }

  if (snapshot.upstream === undefined) {
    findings.push(
      finding(
        'missing_upstream',
        'warning',
        'No upstream branch is configured, so push/merge status cannot be inferred.'
      )
    );
  } else {
    if ((snapshot.behind ?? 0) > 0) {
      findings.push(
        finding(
          'branch_behind_upstream',
          'decision',
          `Branch is ${String(snapshot.behind)} commit(s) behind ${snapshot.upstream}.`
        )
      );
    }
    if ((snapshot.ahead ?? 0) > 0) {
      findings.push(
        finding(
          'branch_ahead_upstream',
          'warning',
          `Branch is ${String(snapshot.ahead)} commit(s) ahead of ${snapshot.upstream}.`
        )
      );
    }
  }

  return findings;
}

function validateBranchName(branchName: string): string[] {
  const errors: string[] = [];

  if (branchName !== branchName.trim()) {
    errors.push('Branch name has leading or trailing whitespace.');
  }
  if (unsafeShellPattern.test(branchName)) {
    errors.push('Branch name contains whitespace or shell metacharacters.');
  }
  if (!safeBranchPattern.test(branchName)) {
    errors.push('Branch name must use only letters, numbers, dot, underscore, slash, and dash.');
  }
  if (branchName.startsWith('-')) {
    errors.push('Branch name must not start with a dash.');
  }
  if (branchName.startsWith('/') || branchName.endsWith('/')) {
    errors.push('Branch name must not start or end with slash.');
  }
  if (branchName.includes('//')) {
    errors.push('Branch name must not contain consecutive slashes.');
  }
  if (branchName.includes('..')) {
    errors.push('Branch name must not contain consecutive dots.');
  }
  if (branchName.includes('@{')) {
    errors.push('Branch name must not contain @{.');
  }
  if (branchName.endsWith('.lock')) {
    errors.push('Branch name must not end with .lock.');
  }
  if (branchName.split('/').some(part => part === '.' || part === '..' || part.length === 0)) {
    errors.push('Branch path components must not be empty, dot, or dot-dot.');
  }

  const hasKnownPrefix =
    allowedExact.has(branchName) || allowedPrefixes.some(prefix => branchName.startsWith(prefix));
  if (!hasKnownPrefix) {
    errors.push(`Branch must use a documented prefix: ${allowedPrefixes.join(', ')}.`);
  }

  return errors;
}

function git(cwd: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    return { ok: true, stdout, stderr: '' };
  } catch (error) {
    const failure = error as { stdout?: Buffer; stderr?: Buffer; message?: string };
    return {
      ok: false,
      stdout: failure.stdout?.toString() ?? '',
      stderr: failure.stderr?.toString().trim() ?? failure.message ?? 'unknown git error',
    };
  }
}

function finding(
  code: CompletionPreconditionsCode,
  severity: CompletionPreconditionsSeverity,
  message: string,
  evidence?: string
): CompletionPreconditionsFinding {
  return { code, severity, message, evidence };
}

function summarizePorcelain(status: string): string {
  return status
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)
    .slice(0, 10)
    .join('\n');
}

function summarizeReasons(
  findings: CompletionPreconditionsFinding[]
): CompletionPreconditionsReason[] {
  const byKey = new Map<string, CompletionPreconditionsReason>();
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

function evidenceFor(
  snapshot: GitPreconditionSnapshot,
  findings: CompletionPreconditionsFinding[]
): CompletionPreconditionsEvidence[] {
  const upstream = snapshot.upstream ?? '<none>';
  return [
    {
      kind: 'git',
      summary: `branch=${snapshot.branch || '<detached>'}; upstream=${upstream}; ahead=${String(snapshot.ahead ?? 0)}; behind=${String(snapshot.behind ?? 0)}; dirty=${String(snapshot.porcelainStatus.trim().length > 0)}`,
    },
    ...findings.map(item => ({
      kind: 'finding' as const,
      summary: `${item.code}: ${item.message}`,
    })),
  ];
}

function summaryFor(
  state: CompletionPreconditionsState,
  blockerCount: number,
  decisionCount: number,
  warningCount: number
): string {
  if (state === 'ready') return 'Completion preconditions are satisfied.';
  return `Completion preconditions found ${String(blockerCount)} blocker(s), ${String(decisionCount)} decision item(s), and ${String(warningCount)} warning(s).`;
}

function nextActionFor(state: CompletionPreconditionsState): string {
  switch (state) {
    case 'ready':
      return 'Proceed to final validation, push, PR, or completion flow as appropriate.';
    case 'blocked':
      return 'Resolve blockers such as detached HEAD, invalid branch names, or dirty worktree before completing.';
    case 'needs_decision':
      return 'Update from upstream, choose an explicit merge strategy, or record the decision before completing.';
    case 'unknown':
      return 'Configure upstream or confirm push/merge status before claiming completion readiness.';
  }
}

function renderReasons(reasons: CompletionPreconditionsReason[]): string[] {
  if (reasons.length === 0) return ['- none'];
  return reasons.map(
    reason => `- ${reason.code} (${reason.severity}, ${String(reason.count)}): ${reason.message}`
  );
}

function renderFindings(findings: CompletionPreconditionsFinding[]): string[] {
  if (findings.length === 0) return ['- none'];
  return findings.map(item => {
    const evidence = item.evidence === undefined ? '' : ` - ${item.evidence}`;
    return `- ${item.code} (${item.severity}): ${item.message}${evidence}`;
  });
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
  const report = await evaluateCompletionPreconditions({
    cwd: options.cwd,
    timestamp: options.timestamp,
  });
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderCompletionPreconditionsReport(report));
  }
  return report.state === 'ready' ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ACO completion preconditions failed: ${message}`);
    process.exitCode = 1;
  }
}
