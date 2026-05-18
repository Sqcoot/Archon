import { readdir } from 'fs/promises';
import { basename, join, resolve } from 'path';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');
const POLICY_DIR = join(REPO_ROOT, 'packages/context-orchestrator/policies/prompt-package');
const FIXTURES_DIR = join(POLICY_DIR, 'fixtures');
const QUERY = 'data.archon.context_orchestrator.prompt_package.decision';

interface PolicyFinding {
  code: string;
  message: string;
  path?: string;
  severity: 'deny' | 'warn';
}

interface PolicyDecision {
  allow: boolean;
  deny: PolicyFinding[];
  warn: PolicyFinding[];
  policy_version: string;
}

interface FixtureExpectation {
  allow: boolean;
  denyCodes: string[];
  warnCodes: string[];
}

const fixtureExpectations: Record<string, FixtureExpectation> = {
  'valid-minimal.json': {
    allow: true,
    denyCodes: [],
    warnCodes: [],
  },
  'invalid-missing-acceptance.json': {
    allow: false,
    denyCodes: ['ACO_POLICY_MISSING_ACCEPTANCE_EVIDENCE'],
    warnCodes: [],
  },
  'invalid-missing-security.json': {
    allow: false,
    denyCodes: ['ACO_POLICY_MISSING_SECURITY_EVIDENCE'],
    warnCodes: [],
  },
  'invalid-malformed-shape.json': {
    allow: false,
    denyCodes: [
      'ACO_POLICY_MALFORMED_INPUT',
      'ACO_POLICY_MISSING_METADATA',
      'ACO_POLICY_MISSING_REPRODUCIBILITY_LINKAGE',
    ],
    warnCodes: [],
  },
  'invalid-secret-like-value.json': {
    allow: false,
    denyCodes: ['ACO_POLICY_SECRET_LIKE_VALUE'],
    warnCodes: [],
  },
  'warn-unresolved-docs.json': {
    allow: true,
    denyCodes: [],
    warnCodes: ['ACO_POLICY_UNRESOLVED_DOCS'],
  },
  'warn-graph-waiver.json': {
    allow: true,
    denyCodes: [],
    warnCodes: ['ACO_POLICY_GRAPH_WAIVER'],
  },
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--fixtures')) {
    await validateFixtures();
    return;
  }

  const inputIndex = args.indexOf('--input');
  if (inputIndex >= 0 && args[inputIndex + 1]) {
    const inputPath = resolve(args[inputIndex + 1]);
    const decision = await evaluatePolicy(inputPath);
    printDecision(inputPath, decision);
    if (!decision.allow) {
      process.exitCode = 1;
    }
    return;
  }

  console.error('Usage: bun scripts/policy/validate-aco-policy.ts --fixtures');
  console.error('   or: bun scripts/policy/validate-aco-policy.ts --input <prompt-package.json>');
  process.exitCode = 1;
}

async function validateFixtures(): Promise<void> {
  const fixtureFiles = (await readdir(FIXTURES_DIR))
    .filter(file => file.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));
  const expectedFiles = Object.keys(fixtureExpectations).sort((left, right) =>
    left.localeCompare(right)
  );

  assertEqualArrays(fixtureFiles, expectedFiles, 'fixture file set');

  const failures: string[] = [];
  for (const fixtureFile of fixtureFiles) {
    const fixturePath = join(FIXTURES_DIR, fixtureFile);
    const decision = await evaluatePolicy(fixturePath);
    const expectation = fixtureExpectations[fixtureFile];
    const actualDenyCodes = uniqueSorted(decision.deny.map(finding => finding.code));
    const actualWarnCodes = uniqueSorted(decision.warn.map(finding => finding.code));
    const expectedDenyCodes = uniqueSorted(expectation.denyCodes);
    const expectedWarnCodes = uniqueSorted(expectation.warnCodes);

    printDecision(fixturePath, decision);

    if (decision.allow !== expectation.allow) {
      failures.push(
        `${fixtureFile}: expected allow=${expectation.allow}, received allow=${decision.allow}`
      );
    }
    if (!arraysEqual(actualDenyCodes, expectedDenyCodes)) {
      failures.push(
        `${fixtureFile}: expected deny codes ${expectedDenyCodes.join(', ') || 'none'}, received ${actualDenyCodes.join(', ') || 'none'}`
      );
    }
    if (!arraysEqual(actualWarnCodes, expectedWarnCodes)) {
      failures.push(
        `${fixtureFile}: expected warn codes ${expectedWarnCodes.join(', ') || 'none'}, received ${actualWarnCodes.join(', ') || 'none'}`
      );
    }
  }

  if (failures.length > 0) {
    console.error('ACO policy fixture validation failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('ACO policy fixtures matched expected decisions.');
}

async function evaluatePolicy(inputPath: string): Promise<PolicyDecision> {
  const result = await runCommand([
    'opa',
    'eval',
    '--format',
    'json',
    '--bundle',
    POLICY_DIR,
    '--input',
    inputPath,
    QUERY,
  ]);

  if (result.exitCode !== 0) {
    throw new Error(
      `opa eval failed for ${inputPath} (${result.exitCode}): ${result.stderr || result.stdout}`
    );
  }

  const parsed = JSON.parse(result.stdout) as {
    result?: { expressions?: { value?: unknown }[] }[];
  };
  const value = parsed.result?.[0]?.expressions?.[0]?.value;
  return assertPolicyDecision(value, inputPath);
}

async function runCommand(command: string[]): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  try {
    const proc = Bun.spawn(command, {
      cwd: REPO_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { exitCode, stdout, stderr };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(
        'Open Policy Agent CLI `opa` is required for ACO policy validation. Install OPA or ensure CI sets it up with the pinned open-policy-agent/setup-opa action.'
      );
    }
    throw error;
  }
}

function assertPolicyDecision(value: unknown, inputPath: string): PolicyDecision {
  if (!isRecord(value)) {
    throw new Error(`OPA decision for ${inputPath} was not an object.`);
  }
  if (typeof value.allow !== 'boolean') {
    throw new Error(`OPA decision for ${inputPath} is missing boolean allow.`);
  }
  if (!Array.isArray(value.deny) || !Array.isArray(value.warn)) {
    throw new Error(`OPA decision for ${inputPath} must include deny and warn arrays.`);
  }
  if (typeof value.policy_version !== 'string' || value.policy_version.length === 0) {
    throw new Error(`OPA decision for ${inputPath} is missing policy_version.`);
  }

  return {
    allow: value.allow,
    deny: value.deny.map((finding, index) =>
      assertPolicyFinding(finding, inputPath, 'deny', index)
    ),
    warn: value.warn.map((finding, index) =>
      assertPolicyFinding(finding, inputPath, 'warn', index)
    ),
    policy_version: value.policy_version,
  };
}

function assertPolicyFinding(
  value: unknown,
  inputPath: string,
  expectedSeverity: 'deny' | 'warn',
  index: number
): PolicyFinding {
  if (!isRecord(value)) {
    throw new Error(`${expectedSeverity}[${index}] for ${inputPath} was not an object.`);
  }
  if (typeof value.code !== 'string' || value.code.length === 0) {
    throw new Error(`${expectedSeverity}[${index}] for ${inputPath} is missing code.`);
  }
  if (typeof value.message !== 'string' || value.message.length === 0) {
    throw new Error(`${expectedSeverity}[${index}] for ${inputPath} is missing message.`);
  }
  if (value.severity !== expectedSeverity) {
    throw new Error(
      `${expectedSeverity}[${index}] for ${inputPath} must use severity ${expectedSeverity}.`
    );
  }
  if (value.path !== undefined && typeof value.path !== 'string') {
    throw new Error(`${expectedSeverity}[${index}] for ${inputPath} has non-string path.`);
  }

  return {
    code: value.code,
    message: value.message,
    path: value.path,
    severity: expectedSeverity,
  };
}

function printDecision(inputPath: string, decision: PolicyDecision): void {
  const denyCodes = uniqueSorted(decision.deny.map(finding => finding.code));
  const warnCodes = uniqueSorted(decision.warn.map(finding => finding.code));
  console.log(
    [
      `${basename(inputPath)}: allow=${decision.allow}`,
      `policy_version=${decision.policy_version}`,
      `deny=${denyCodes.join(',') || 'none'}`,
      `warn=${warnCodes.join(',') || 'none'}`,
    ].join(' ')
  );
  for (const finding of [...decision.deny, ...decision.warn]) {
    console.log(`  - ${finding.severity} ${finding.code}: ${finding.message}`);
  }
}

function assertEqualArrays(actual: string[], expected: string[], label: string): void {
  if (!arraysEqual(actual, expected)) {
    throw new Error(
      `Unexpected ${label}: expected ${expected.join(', ') || 'none'}, received ${actual.join(', ') || 'none'}`
    );
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

await main();
