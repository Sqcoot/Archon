import { createHash } from 'crypto';
import { constants } from 'fs';
import { access, readdir, readFile } from 'fs/promises';
import { delimiter, join, relative, resolve, sep } from 'path';
import { writeFileNoFollow } from './security';
import { withAcoSpan } from './telemetry';
import type { AcoSpanAttributes } from './telemetry';
import type { ArchivedPolicyDecision, PolicyDecision, PolicyFinding } from './types';

const POLICY_DIR = resolve(import.meta.dir, '..', 'policies', 'prompt-package');
const POLICY_QUERY = 'data.archon.context_orchestrator.prompt_package.decision';
const POLICY_PACKAGE = 'archon.context_orchestrator.prompt_package';
const POLICY_INPUT_PATH = 'prompt-package.json';
const OPA_COMMAND_TIMEOUT_MS = 10_000;

export class PolicyDecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicyDecisionError';
  }
}

export interface CreateArchivedPolicyDecisionOptions {
  inputPath: string;
  policyDir?: string;
}

export interface WriteArchivedPolicyDecisionOptions extends CreateArchivedPolicyDecisionOptions {
  archivePath: string;
  outputPath: string;
}

export async function evaluatePromptPackagePolicy(
  inputPath: string,
  policyDir = POLICY_DIR
): Promise<PolicyDecision> {
  const result = await runCommand([
    'opa',
    'eval',
    '--format',
    'json',
    '--bundle',
    policyDir,
    '--input',
    inputPath,
    POLICY_QUERY,
  ]);

  if (result.exitCode !== 0) {
    throw new PolicyDecisionError(
      `OPA prompt-package policy evaluation failed (${result.exitCode}): ${result.stderr || result.stdout}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    throw new PolicyDecisionError(
      `OPA prompt-package policy output was not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const value = extractOpaDecisionValue(parsed);
  return assertPolicyDecision(value);
}

export async function createArchivedPolicyDecision(
  options: CreateArchivedPolicyDecisionOptions
): Promise<ArchivedPolicyDecision> {
  const policyDir = options.policyDir ?? POLICY_DIR;
  const [inputBytes, rawDecision, policyHash, opaVersion] = await Promise.all([
    readFile(options.inputPath),
    evaluatePromptPackagePolicy(options.inputPath, policyDir),
    hashPolicyFiles(policyDir),
    readOpaVersion(),
  ]);
  const normalized = normalizePolicyDecision(rawDecision);

  return {
    schema_version: 'aco.policy-decision.v1',
    input: {
      path: POLICY_INPUT_PATH,
      sha256: sha256(inputBytes),
    },
    policy: {
      package: POLICY_PACKAGE,
      version: rawDecision.policy_version,
      sha256: policyHash,
    },
    opa: {
      available: true,
      version: opaVersion,
    },
    decision: {
      allow: rawDecision.allow,
      deny: normalized.deny,
      warn: normalized.warn,
    },
    counts: {
      deny: normalized.deny.length,
      warn: normalized.warn.length,
    },
    codes: {
      deny: uniqueSorted(normalized.deny.map(finding => finding.code)),
      warn: uniqueSorted(normalized.warn.map(finding => finding.code)),
    },
    duplicates_suppressed: normalized.duplicatesSuppressed,
  };
}

export async function writeArchivedPolicyDecision(
  options: WriteArchivedPolicyDecisionOptions
): Promise<ArchivedPolicyDecision> {
  return withAcoSpan(
    'archon.aco.policy.archive',
    {
      'archon.aco.operation': 'policy.archive',
      'archon.aco.policy.gate': 'prompt-package',
    },
    async span => {
      const decision = await createArchivedPolicyDecision(options);
      span.setAttributes(toPolicyArchiveSpanAttributes(decision));
      await writeFileNoFollow(
        options.archivePath,
        options.outputPath,
        stringifyArchivedPolicyDecision(decision)
      );
      return decision;
    }
  );
}

export function stringifyArchivedPolicyDecision(decision: ArchivedPolicyDecision): string {
  return `${JSON.stringify(decision, null, 2)}\n`;
}

function toPolicyArchiveSpanAttributes(decision: ArchivedPolicyDecision): AcoSpanAttributes {
  return {
    'archon.aco.policy.allowed': decision.decision.allow,
    'archon.aco.policy.deny.count': decision.counts.deny,
    'archon.aco.policy.warn.count': decision.counts.warn,
    'archon.aco.policy.duplicates_suppressed.count': decision.duplicates_suppressed,
    'archon.aco.policy.version': decision.policy.version,
    'archon.aco.opa.available': decision.opa.available,
    'archon.aco.opa.version': decision.opa.version,
  };
}

function extractOpaDecisionValue(parsed: unknown): unknown {
  if (!isRecord(parsed)) {
    throw new PolicyDecisionError('OPA prompt-package policy output was not an object.');
  }
  const result = parsed.result;
  if (!Array.isArray(result)) {
    throw new PolicyDecisionError(
      'OPA prompt-package policy output did not include a result array.'
    );
  }
  const expression = result[0];
  if (!isRecord(expression)) {
    throw new PolicyDecisionError(
      'OPA prompt-package policy output did not include a result expression.'
    );
  }
  const expressions = expression.expressions;
  if (!Array.isArray(expressions)) {
    throw new PolicyDecisionError('OPA prompt-package policy output did not include expressions.');
  }
  const firstExpression = expressions[0];
  if (!isRecord(firstExpression)) {
    throw new PolicyDecisionError(
      'OPA prompt-package policy output did not include expression value.'
    );
  }
  return firstExpression.value;
}

function assertPolicyDecision(value: unknown): PolicyDecision {
  if (!isRecord(value)) {
    throw new PolicyDecisionError('OPA prompt-package policy decision was not an object.');
  }
  if (typeof value.allow !== 'boolean') {
    throw new PolicyDecisionError('OPA prompt-package policy decision is missing boolean allow.');
  }
  if (!Array.isArray(value.deny) || !Array.isArray(value.warn)) {
    throw new PolicyDecisionError(
      'OPA prompt-package policy decision must include deny and warn arrays.'
    );
  }
  if (typeof value.policy_version !== 'string' || value.policy_version.length === 0) {
    throw new PolicyDecisionError('OPA prompt-package policy decision is missing policy_version.');
  }

  return {
    allow: value.allow,
    deny: value.deny.map((finding, index) => assertPolicyFinding(finding, 'deny', index)),
    warn: value.warn.map((finding, index) => assertPolicyFinding(finding, 'warn', index)),
    policy_version: value.policy_version,
  };
}

function assertPolicyFinding(
  value: unknown,
  expectedSeverity: 'deny' | 'warn',
  index: number
): PolicyFinding {
  if (!isRecord(value)) {
    throw new PolicyDecisionError(`${expectedSeverity}[${index}] was not an object.`);
  }
  if (typeof value.code !== 'string' || value.code.length === 0) {
    throw new PolicyDecisionError(`${expectedSeverity}[${index}] is missing code.`);
  }
  if (typeof value.message !== 'string' || value.message.length === 0) {
    throw new PolicyDecisionError(`${expectedSeverity}[${index}] is missing message.`);
  }
  if (value.severity !== expectedSeverity) {
    throw new PolicyDecisionError(
      `${expectedSeverity}[${index}] must use severity ${expectedSeverity}.`
    );
  }
  if (value.path !== undefined && typeof value.path !== 'string') {
    throw new PolicyDecisionError(`${expectedSeverity}[${index}] has non-string path.`);
  }

  const finding: PolicyFinding = {
    code: value.code,
    message: value.message,
    severity: expectedSeverity,
  };
  if (typeof value.path === 'string' && value.path.length > 0) {
    finding.path = value.path;
  }
  return finding;
}

function normalizePolicyDecision(decision: PolicyDecision): {
  deny: PolicyFinding[];
  warn: PolicyFinding[];
  duplicatesSuppressed: number;
} {
  const original = [...decision.deny, ...decision.warn];
  const normalized = dedupeAndSortFindings(original);
  return {
    deny: normalized.filter(finding => finding.severity === 'deny'),
    warn: normalized.filter(finding => finding.severity === 'warn'),
    duplicatesSuppressed: original.length - normalized.length,
  };
}

function dedupeAndSortFindings(findings: PolicyFinding[]): PolicyFinding[] {
  const unique = new Map<string, PolicyFinding>();
  for (const finding of findings) {
    unique.set(findingKey(finding), finding);
  }
  return [...unique.values()].sort(compareFindings);
}

function findingKey(finding: PolicyFinding): string {
  return [finding.severity, finding.code, finding.path ?? '', finding.message].join('\u0000');
}

function compareFindings(left: PolicyFinding, right: PolicyFinding): number {
  return (
    left.severity.localeCompare(right.severity) ||
    left.code.localeCompare(right.code) ||
    (left.path ?? '').localeCompare(right.path ?? '') ||
    left.message.localeCompare(right.message)
  );
}

async function hashPolicyFiles(policyDir: string): Promise<string> {
  const files = await listRegoFiles(policyDir);
  const hash = createHash('sha256');
  for (const file of files) {
    const relativePath = toPosixPath(relative(policyDir, file));
    hash.update(relativePath);
    hash.update('\0');
    hash.update(await readFile(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function listRegoFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === 'fixtures') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listRegoFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith('.rego')) {
      files.push(path);
    }
  }
  return files.sort((left, right) => toPosixPath(left).localeCompare(toPosixPath(right)));
}

async function readOpaVersion(): Promise<string | null> {
  try {
    const result = await runCommand(['opa', 'version']);
    if (result.exitCode !== 0) return null;
    const versionLine = result.stdout
      .split('\n')
      .map(line => line.trim())
      .find(line => line.startsWith('Version:'));
    return versionLine?.replace(/^Version:\s*/, '') || null;
  } catch {
    return null;
  }
}

async function runCommand(command: string[]): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const executable = command[0];
  if (executable === undefined || !(await isExecutableAvailable(executable))) {
    throw new PolicyDecisionError(
      'Open Policy Agent CLI `opa` is required for ACO policy admission. Install OPA or ensure CI sets it up with the pinned open-policy-agent/setup-opa action.'
    );
  }

  let proc: ReturnType<typeof Bun.spawn> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    proc = Bun.spawn(command, {
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    });
    const commandResult: Promise<[string, string, number]> = Promise.all([
      new Response(proc.stdout as ReadableStream<Uint8Array>).text(),
      new Response(proc.stderr as ReadableStream<Uint8Array>).text(),
      proc.exited,
    ]);
    const timeoutResult = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        proc?.kill();
        reject(
          new PolicyDecisionError(
            `OPA command timed out after ${String(OPA_COMMAND_TIMEOUT_MS)}ms.`
          )
        );
      }, OPA_COMMAND_TIMEOUT_MS);
    });
    const [stdout, stderr, exitCode] = await Promise.race([commandResult, timeoutResult]);
    return { exitCode, stdout, stderr };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new PolicyDecisionError(
        'Open Policy Agent CLI `opa` is required for ACO policy admission. Install OPA or ensure CI sets it up with the pinned open-policy-agent/setup-opa action.'
      );
    }
    throw error;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function isExecutableAvailable(command: string): Promise<boolean> {
  if (command.includes('/')) {
    return canExecute(command);
  }

  const searchPath = process.env.PATH ?? '';
  if (searchPath.length === 0) return false;

  for (const directory of searchPath.split(delimiter)) {
    if (directory.length === 0) continue;
    if (await canExecute(join(directory, command))) return true;
  }
  return false;
}

async function canExecute(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function toPosixPath(path: string): string {
  return path.split(sep).join('/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
