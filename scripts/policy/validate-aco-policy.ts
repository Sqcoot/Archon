import { readdir, writeFile } from 'fs/promises';
import { basename, join, resolve } from 'path';
import {
  createArchivedPolicyDecision,
  stringifyArchivedPolicyDecision,
  type ArchivedPolicyDecision,
} from '@archon/context-orchestrator';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');
const POLICY_DIR = join(REPO_ROOT, 'packages/context-orchestrator/policies/prompt-package');
const FIXTURES_DIR = join(POLICY_DIR, 'fixtures');

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
    const decision = await createArchivedPolicyDecision({ inputPath });
    printDecision(inputPath, decision);

    const outputIndex = args.indexOf('--output');
    if (outputIndex >= 0 && args[outputIndex + 1]) {
      await writeFile(
        resolve(args[outputIndex + 1]),
        stringifyArchivedPolicyDecision(decision),
        'utf8'
      );
    }

    if (!decision.decision.allow) {
      process.exitCode = 1;
    }
    return;
  }

  console.error('Usage: bun scripts/policy/validate-aco-policy.ts --fixtures');
  console.error(
    '   or: bun scripts/policy/validate-aco-policy.ts --input <prompt-package.json> [--output <policy-decision.json>]'
  );
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
    const decision = await createArchivedPolicyDecision({ inputPath: fixturePath });
    const expectation = fixtureExpectations[fixtureFile];
    const actualDenyCodes = decision.codes.deny;
    const actualWarnCodes = decision.codes.warn;
    const expectedDenyCodes = uniqueSorted(expectation.denyCodes);
    const expectedWarnCodes = uniqueSorted(expectation.warnCodes);

    printDecision(fixturePath, decision);

    if (decision.decision.allow !== expectation.allow) {
      failures.push(
        `${fixtureFile}: expected allow=${expectation.allow}, received allow=${decision.decision.allow}`
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

function printDecision(inputPath: string, decision: ArchivedPolicyDecision): void {
  console.log(
    [
      `${basename(inputPath)}: allow=${decision.decision.allow}`,
      `policy_version=${decision.policy.version}`,
      `deny=${decision.codes.deny.join(',') || 'none'}`,
      `warn=${decision.codes.warn.join(',') || 'none'}`,
      `duplicates_suppressed=${decision.duplicates_suppressed}`,
    ].join(' ')
  );
  for (const finding of [...decision.decision.deny, ...decision.decision.warn]) {
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

await main();
