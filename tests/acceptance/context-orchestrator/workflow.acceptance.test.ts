import { describe, expect, test } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';
import {
  ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION,
  acoAdversarialEvaluatorVerdictSchema,
  acoAdversarialGeneratorReportSchema,
  exampleAcoAdversarialFinding,
  exampleAcoAdversarialGoalCompletion,
  exampleAcoContextRefs,
} from '@archon/context-orchestrator';

interface WorkflowValidationReport {
  results: Array<{ workflowName: string; valid: boolean; issues: unknown[] }>;
  summary: { total: number; valid: number; errors: number; warnings: number };
}

describe('ACO workflow acceptance', () => {
  test('Spec: 014-workflow-contracts.md Acceptance: AC-P3-WF context-orchestrate workflow validates before use', async () => {
    const workflowSource = await readFile(
      join(process.cwd(), '.archon/workflows/defaults/context-orchestrate.yaml'),
      'utf8'
    );

    for (const evidence of [
      'name: context-orchestrate',
      'bun run cli context status --cwd "$PWD" --json "$ARGUMENTS"',
      'bun run cli context ledgers --cwd "$PWD" --json "$ARGUMENTS"',
      'bun run cli context compile',
      '--archive-root "$ARTIFACTS_DIR/context-orchestrator"',
      'graph-validation-gate',
      'graph-validation-gate.json',
      'approval-capsule',
      'context approval-capsule',
      'approval-capsule.md',
      'Intent:',
      'Evidence blockers:',
      'Evidence resolution required:',
      'approval:',
      'final-summary',
    ]) {
      expect(workflowSource).toContain(evidence);
    }

    const report = await validateWorkflow('context-orchestrate');
    const contextOrchestrate = report.results.find(
      result => result.workflowName === 'context-orchestrate'
    );
    expect(report.summary).toMatchObject({ total: 1, valid: 1, errors: 0, warnings: 0 });
    expect(contextOrchestrate?.valid).toBe(true);
    expect(contextOrchestrate?.issues).toEqual([]);
  });

  test('Spec: 014-workflow-contracts.md Acceptance: ACO-ADV-007 Evaluator judges original goal completion', async () => {
    const workflowSource = await readFile(
      join(process.cwd(), '.archon/workflows/defaults/archon-aco-adversarial-loop.yaml'),
      'utf8'
    );

    for (const evidence of [
      'name: archon-aco-adversarial-loop',
      'certification: "not-certified-by-generator"',
      'Do not edit product source, run shell commands, or certify',
      'Can we honestly claim the original goal is done?',
      'originalObjective',
      'goalCompletion.status',
      'goalCompletion.canClaimComplete',
      'contract scoring alone is',
      'Use `passed` only when `goalCompletion.status` is `complete`',
      'retryInstruction: complete ? "No retry required." : goalCompletion.requiredNextAction',
      'Can claim complete:',
      'Required next action:',
    ]) {
      expect(workflowSource).toContain(evidence);
    }

    expect(
      acoAdversarialEvaluatorVerdictSchema.safeParse({
        schemaVersion: ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION,
        sprintId: 'sprint-001',
        round: 1,
        verdict: 'passed',
        originalObjective:
          'Complete ACO Context Orchestrator readiness relative to STAB-002 branches',
        goalCompletion: exampleAcoAdversarialGoalCompletion,
        contractPath: 'contracts/sprint-001.contract.json',
        generatorReportPath: 'attempts/sprint-001-round-001.generator-report.json',
        scores: { 'criterion-traceability-001': 9 },
        findings: [],
        evidence: ['contract criteria passed'],
        nextDecisionKind: 'blocked_by_evidence',
        acoContextRefs: exampleAcoContextRefs,
      }).success
    ).toBe(false);

    expect(
      acoAdversarialGeneratorReportSchema.safeParse({
        schemaVersion: ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION,
        sprintId: 'sprint-001',
        round: 1,
        contractPath: 'contracts/sprint-001.contract.json',
        previousFeedbackPath: null,
        story: {
          schemaVersion: ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION,
          storyId: 'story-001',
          title: 'Correct evaluator completion semantics',
          contractId: 'sprint-001',
          acceptanceCriteria: ['Evaluator owns final goal-completion verdict.'],
          acoContextRefs: exampleAcoContextRefs,
        },
        changedFiles: ['.archon/workflows/defaults/archon-aco-adversarial-loop.yaml'],
        validationCommands: ['bun run cli validate workflows archon-aco-adversarial-loop --json'],
        certification: 'ready',
        acoContextRefs: exampleAcoContextRefs,
      }).success
    ).toBe(false);

    acoAdversarialEvaluatorVerdictSchema.parse({
      schemaVersion: ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION,
      sprintId: 'sprint-001',
      round: 1,
      verdict: 'blocked_by_evidence',
      originalObjective:
        'Complete ACO Context Orchestrator readiness relative to STAB-002 branches',
      goalCompletion: exampleAcoAdversarialGoalCompletion,
      contractPath: 'contracts/sprint-001.contract.json',
      generatorReportPath: 'attempts/sprint-001-round-001.generator-report.json',
      scores: { 'criterion-traceability-001': 8 },
      findings: [exampleAcoAdversarialFinding],
      evidence: ['ACO status readiness=needs_approval'],
      nextDecisionKind: 'blocked_by_evidence',
      acoContextRefs: exampleAcoContextRefs,
    });

    const report = await validateWorkflow('archon-aco-adversarial-loop');
    const adversarialLoop = report.results.find(
      result => result.workflowName === 'archon-aco-adversarial-loop'
    );
    expect(report.summary).toMatchObject({ total: 1, valid: 1, errors: 0, warnings: 0 });
    expect(adversarialLoop?.valid).toBe(true);
    expect(adversarialLoop?.issues).toEqual([]);
  });
});

async function validateWorkflow(workflowName: string): Promise<WorkflowValidationReport> {
  const result = await runBun(
    ['run', 'cli', 'validate', 'workflows', workflowName, '--json'],
    20_000
  );
  expect(result.exitCode, result.stderr).toBe(0);
  const jsonLine = result.stdout
    .trim()
    .split(/\r?\n/)
    .reverse()
    .find(line => line.startsWith('{') && line.includes('"results"'));
  expect(jsonLine).toBeDefined();
  return JSON.parse(jsonLine ?? '{}') as WorkflowValidationReport;
}

async function runBun(
  args: string[],
  timeoutMs: number
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const proc = Bun.spawn([process.execPath, ...args], {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  });
  try {
    const commandResult = Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    const timeoutResult = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        proc.kill();
        reject(new Error(`bun ${args.join(' ')} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    const [stdout, stderr, exitCode] = await Promise.race([commandResult, timeoutResult]);
    return { stdout, stderr, exitCode };
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
