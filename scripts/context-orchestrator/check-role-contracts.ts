import { readFile } from 'fs/promises';
import { resolve } from 'path';

type RoleContractStatus = 'passed' | 'failed';

interface RoleContractCheck {
  id: string;
  status: RoleContractStatus;
  file: string;
  markers: string[];
  forbidden: string[];
  missing: string[];
  forbiddenFound: string[];
}

interface RoleContractReport {
  status: RoleContractStatus;
  checks: RoleContractCheck[];
  errors: string[];
}

interface RoleContractDefinition {
  id: string;
  file: string;
  markers: readonly string[];
  forbidden?: readonly string[];
}

interface CliOptions {
  root: string;
  json: boolean;
}

const ROLE_CONTRACTS: readonly RoleContractDefinition[] = [
  {
    id: 'workflow-role-nodes',
    file: '.archon/workflows/defaults/archon-aco-adversarial-loop.yaml',
    markers: [
      'ACO-ADV-006 Coordinator/Triage role.',
      'ACO-ADV-006 Skill Curator role.',
      'ACO-ADV-006 BMAD Reviewer role.',
      'ACO-ADV-006 Agentic Search role.',
      'ACO-ADV-006 Planner role.',
      'ACO-ADV-006 Contract role.',
      'ACO-ADV-004 ACO-ADV-006 Generator role.',
      'ACO-ADV-006 QA/Verifier role.',
      'ACO-ADV-007 Evaluator role.',
      'Feedback/Handoff',
    ],
  },
  {
    id: 'workflow-role-boundaries',
    file: '.archon/workflows/defaults/archon-aco-adversarial-loop.yaml',
    markers: [
      'ACO role contracts remain workflow artifact/node contracts, not automatic Codex subagents.',
      'Codex generated agents require explicit node-level agents; tool restrictions remain unsupported.',
      'Reject unsupported runtime claims explicitly.',
      'role boundaries are contractual workflow artifact',
      'BMAD Reviewer is advisory only',
      'certify final readiness.',
      'certification: "not-certified-by-generator"',
      'Can we honestly claim the original goal is done?',
      'Goal completion:',
      'Can claim complete:',
    ],
    forbidden: ['allowed_tools:', 'agents:'],
  },
  {
    id: 'codex-provider-capability-boundary',
    file: 'packages/providers/src/codex/capabilities.ts',
    markers: ['agents: true', 'toolRestrictions: false'],
  },
  {
    id: 'claude-provider-capability-boundary',
    file: 'packages/providers/src/claude/capabilities.ts',
    markers: ['agents: true', 'toolRestrictions: true'],
  },
  {
    id: 'workflow-provider-override-boundary',
    file: 'packages/workflows/src/executor.ts',
    markers: [
      'providerOverride ?? workflow.provider ?? config.assistant',
      'providerSource = providerOverride',
      "'cli override'",
    ],
  },
  {
    id: 'docs-role-contracts',
    file: 'docs/context-orchestrator/specs/014-workflow-contracts.md',
    markers: [
      'ACO-ADV-006',
      'Coordinator/Triage',
      'Agentic Search',
      'Planner',
      'Skill Curator',
      'Generator',
      'QA/Verifier',
      'BMAD Reviewer',
      'Feedback/Handoff',
      'ACO-ADV-007',
    ],
  },
  {
    id: 'schema-evaluator-generator-boundaries',
    file: 'packages/context-orchestrator/src/schemas/adversarial-contract-loop.ts',
    markers: [
      "certification: z.literal('not-certified-by-generator')",
      'originalObjective: z.string().min(1)',
      'goalCompletion: acoAdversarialGoalCompletionSchema',
      'verdict passed requires goalCompletion.status complete',
      'complete goalCompletion requires verdict passed',
    ],
  },
  {
    id: 'acceptance-role-contracts',
    file: 'tests/acceptance/context-orchestrator/workflow.acceptance.test.ts',
    markers: [
      'ACO-ADV-006 role contracts',
      'Coordinator/Triage',
      'Skill Curator',
      'BMAD Reviewer',
      'Agentic Search',
      'QA/Verifier',
      'not-certified-by-generator',
    ],
  },
  {
    id: 'package-role-contract-command',
    file: 'package.json',
    markers: ['"aco:role-contracts"'],
  },
  {
    id: 'traceability-role-contracts',
    file: 'docs/context-orchestrator/specs/traceability/aco-traceability.json',
    markers: ['ACO-ADV-006', 'aco:role-contracts', 'check-role-contracts.ts'],
  },
  {
    id: 'matrix-role-contracts',
    file: 'docs/context-orchestrator/specs/spec-traceability-matrix.md',
    markers: ['ACO-ADV-006', 'role contract'],
  },
];

function parseArgs(args: string[]): CliOptions {
  let root = process.cwd();
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--root' && args[index + 1]) {
      root = args[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return { root: resolve(root), json };
}

async function validateRoleContracts(root: string): Promise<RoleContractReport> {
  const checks: RoleContractCheck[] = [];
  const errors: string[] = [];

  for (const contract of ROLE_CONTRACTS) {
    const filePath = resolve(root, contract.file);
    let text = '';
    try {
      text = await readFile(filePath, 'utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${contract.file}: ${message}`);
    }

    const missing = contract.markers.filter(marker => !text.includes(marker));
    const forbiddenFound = (contract.forbidden ?? []).filter(marker => text.includes(marker));
    if (missing.length > 0) {
      errors.push(`${contract.file}: missing ${missing.join(', ')}`);
    }
    if (forbiddenFound.length > 0) {
      errors.push(`${contract.file}: found forbidden ${forbiddenFound.join(', ')}`);
    }

    checks.push({
      id: contract.id,
      status: missing.length === 0 && forbiddenFound.length === 0 ? 'passed' : 'failed',
      file: contract.file,
      markers: [...contract.markers],
      forbidden: [...(contract.forbidden ?? [])],
      missing,
      forbiddenFound,
    });
  }

  return {
    status: errors.length === 0 ? 'passed' : 'failed',
    checks,
    errors,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const report = await validateRoleContracts(options.root);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.status === 'passed') {
    console.log('ACO role-contract validation passed.');
  } else {
    console.error('ACO role-contract validation failed:');
    for (const error of report.errors) {
      console.error(`- ${error}`);
    }
  }

  if (report.status !== 'passed') {
    process.exitCode = 1;
  }
}

await main();
