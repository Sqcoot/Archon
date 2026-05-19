import { describe, expect, test } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';
import {
  acoAdversarialEvaluatorVerdictSchema,
  acoAdversarialExplicitApprovalRecordSchema,
  acoAdversarialFeedbackArtifactSchema,
  acoAdversarialFindingSchema,
  acoAdversarialGeneratorReportSchema,
  acoAdversarialReadinessInputSchema,
  acoAdversarialRunStateSchema,
  acoAdversarialSprintContractSchema,
  exampleAcoAdversarialFinding,
  exampleAcoAdversarialReadinessInput,
  exampleAcoContextRefs,
} from '@archon/context-orchestrator';

const workflowPath = join(
  process.cwd(),
  '.archon/workflows/defaults/archon-aco-adversarial-loop.yaml'
);
const legacyWorkflowPath = join(
  process.cwd(),
  '.archon/workflows/defaults/archon-adversarial-dev.yaml'
);
const specPath = join(
  process.cwd(),
  'docs/context-orchestrator/specs/028-adversarial-contract-loop-spec.md'
);

interface WorkflowValidationReport {
  results: Array<{ workflowName: string; valid: boolean; issues: unknown[] }>;
  summary: { total: number; valid: number; errors: number; warnings: number };
}

describe('ACO adversarial contract loop acceptance', () => {
  test('ACO-ADV-001 new workflow exists and validates before use', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    expect(workflow).toContain('name: archon-aco-adversarial-loop');
    expect(workflow).toContain('bun run cli context status --cwd "$PWD" --json "$ARGUMENTS"');
    expect(workflow).toContain('bun run cli context ledgers --cwd "$PWD" --json "$ARGUMENTS"');
    expect(workflow).toContain('bun run cli context compile');
    expect(workflow).toContain('$ARTIFACTS_DIR/context-orchestrator');

    const report = await validateWorkflow();
    const result = report.results.find(item => item.workflowName === 'archon-aco-adversarial-loop');
    expect(report.summary).toMatchObject({ total: 1, valid: 1, errors: 0, warnings: 0 });
    expect(result?.valid).toBe(true);
    expect(result?.issues).toEqual([]);
  });

  test('ACO-ADV-002 existing adversarial-dev workflow remains separate', async () => {
    const legacy = await readFile(legacyWorkflowPath, 'utf8');
    const next = await readFile(workflowPath, 'utf8');

    expect(legacy).toContain('name: archon-adversarial-dev');
    expect(legacy).toContain('provider: claude');
    expect(legacy).toContain('build a complete application from scratch');
    expect(legacy).not.toContain('archon-aco-adversarial-loop');
    expect(next).toContain('name: archon-aco-adversarial-loop');
  });

  test('ACO-ADV-003 workflow is provider-neutral and avoids inherited app-generation prompts', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    expect(workflow).not.toMatch(/^provider:\s*claude\s*$/m);
    expect(workflow).not.toContain('Claude');
    expect(workflow).not.toContain('Build a complete application from scratch');
    expect(workflow).not.toContain('GAN-inspired');
    expect(workflow).toMatch(/provider is inherited\s+from caller or config/);
  });

  test('ACO-ADV-004 Generator is gated by readiness and explicit approval record', async () => {
    const workflow = await readFile(workflowPath, 'utf8');
    const approvalRecordNode = extractNode(workflow, 'explicit-approval-record');
    const initializeNode = extractNode(workflow, 'initialize-loop-artifacts');
    const generatorNode = extractNode(workflow, 'generator');

    expect(approvalRecordNode).toContain('explicit-approval-record.json');
    expect(approvalRecordNode).toContain('readinessInputHash');
    expect(approvalRecordNode).toContain('verification.status === "valid"');
    expect(initializeNode).toContain(
      'when: "$explicit-approval-record.output.generatorAllowed == \'true\'"'
    );
    expect(generatorNode).toContain('explicit-approval-record.json');
    expect(generatorNode).toContain('certification: "not-certified-by-generator"');
  });

  test('ACO-ADV-005 workflow consumes ACO artifacts without graph maintenance commands', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    expect(workflow).toContain('readiness-gate');
    expect(workflow).toContain('graph-waiver.bmad-plugins-marketplace');
    expect(workflow).toContain('graph-waiver.bmad-sample-data');
    for (const forbidden of [
      'research:graph',
      'graph-upstreams',
      'waiver removal',
      'graph refresh',
      'graphStatus =',
    ]) {
      expect(workflow).not.toContain(forbidden);
    }
  });

  test('ACO-ADV-006 contract exists before Generator phase', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    expect(workflow.indexOf('id: contract')).toBeLessThan(workflow.indexOf('id: generator'));
    expect(extractNode(workflow, 'contract')).toContain('sprint-001.contract.json');
    expect(extractNode(workflow, 'contract')).toContain('observable proof');
    expect(extractNode(workflow, 'generator')).toContain('contracts/sprint-001.contract.json');
  });

  test('ACO-ADV-007 schemas require evidence-bound verdict findings', () => {
    const finding = acoAdversarialFindingSchema.parse(exampleAcoAdversarialFinding);
    expect(finding.acoContextRefs).toHaveLength(1);

    acoAdversarialEvaluatorVerdictSchema.parse({
      schemaVersion: 'aco.adversarial-contract-loop.v1',
      sprintId: 'sprint-001',
      round: 1,
      verdict: 'failed_contract',
      contractPath: 'contracts/sprint-001.contract.json',
      generatorReportPath: 'attempts/sprint-001-round-001.generator-report.json',
      scores: { 'criterion-traceability-001': 5 },
      findings: [finding],
      evidence: ['bun run validate exited 1'],
      nextDecisionKind: 'needs_correct_course',
      acoContextRefs: exampleAcoContextRefs,
    });
  });

  test('ACO-ADV-008 schemas cover readiness, approval, contract, attempt, feedback, state, and handoff refs', async () => {
    acoAdversarialReadinessInputSchema.parse(exampleAcoAdversarialReadinessInput);
    acoAdversarialExplicitApprovalRecordSchema.parse({
      schemaVersion: 'aco.adversarial-contract-loop.v1',
      status: 'approved',
      readinessInputHash: 'a'.repeat(64),
      approvalContractId: 'aco.approval-contract.v1:abc123',
      approvalContractHash: 'b'.repeat(64),
      waiverIds: ['graph-waiver.bmad-plugins-marketplace', 'graph-waiver.bmad-sample-data'],
      recordedAt: '2026-05-19T00:00:00.000Z',
      acoContextRefs: exampleAcoContextRefs,
    });
    acoAdversarialSprintContractSchema.parse({
      schemaVersion: 'aco.adversarial-contract-loop.v1',
      sprintId: 'sprint-001',
      objective: 'Integrate contracted loop.',
      criteria: [
        {
          id: 'criterion-traceability-001',
          description: 'All artifacts cite ACO context refs.',
          observableProof: 'Open JSON artifacts and inspect acoContextRefs arrays.',
          threshold: 7,
          acoContextRefs: exampleAcoContextRefs,
        },
      ],
      acoContextRefs: exampleAcoContextRefs,
    });
    const report = acoAdversarialGeneratorReportSchema.parse({
      schemaVersion: 'aco.adversarial-contract-loop.v1',
      sprintId: 'sprint-001',
      round: 1,
      contractPath: 'contracts/sprint-001.contract.json',
      previousFeedbackPath: null,
      story: {
        schemaVersion: 'aco.adversarial-contract-loop.v1',
        storyId: 'story-001',
        title: 'Add contracted loop workflow',
        contractId: 'sprint-001',
        acceptanceCriteria: ['Workflow validates.'],
        acoContextRefs: exampleAcoContextRefs,
      },
      changedFiles: ['.archon/workflows/defaults/archon-aco-adversarial-loop.yaml'],
      validationCommands: ['bun run cli validate workflows archon-aco-adversarial-loop'],
      certification: 'not-certified-by-generator',
      acoContextRefs: exampleAcoContextRefs,
    });
    acoAdversarialFeedbackArtifactSchema.parse({
      schemaVersion: 'aco.adversarial-contract-loop.v1',
      sprintId: report.sprintId,
      round: report.round,
      verdictPath: 'verdicts/sprint-001-round-001.evaluator-verdict.json',
      actionableFindings: [exampleAcoAdversarialFinding],
      retryInstruction: 'Address every actionable finding.',
      acoContextRefs: exampleAcoContextRefs,
    });
    acoAdversarialRunStateSchema.parse({
      schemaVersion: 'aco.adversarial-contract-loop.v1',
      phase: 'handoff',
      sprintId: 'sprint-001',
      round: 1,
      status: 'running',
      approvalRecordPath: 'explicit-approval-record.json',
      nextDecisionKind: 'approval_required',
      acoContextRefs: exampleAcoContextRefs,
    });
    await expect(readFile(specPath, 'utf8')).resolves.toContain('ACO-ADV-008');
  });
});

function extractNode(workflow: string, id: string): string {
  const start = workflow.indexOf(`- id: ${id}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = workflow.indexOf('\n  - id:', start + 1);
  return workflow.slice(start, next >= 0 ? next : workflow.length);
}

async function validateWorkflow(): Promise<WorkflowValidationReport> {
  const proc = Bun.spawn(
    ['bun', 'run', 'cli', 'validate', 'workflows', 'archon-aco-adversarial-loop', '--json'],
    {
      cwd: process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    }
  );
  const [stdout, , exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  expect(exitCode).toBe(0);
  const jsonLine = stdout
    .trim()
    .split(/\r?\n/)
    .reverse()
    .find(line => line.startsWith('{') && line.includes('"results"'));
  expect(jsonLine).toBeDefined();
  return JSON.parse(jsonLine ?? '{}') as WorkflowValidationReport;
}
