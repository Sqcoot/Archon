import { describe, expect, test } from 'bun:test';
import {
  ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION,
  acoAdversarialEvaluatorVerdictSchema,
  acoAdversarialGeneratorReportSchema,
  exampleAcoAdversarialFinding,
  exampleAcoAdversarialGoalCompletion,
  exampleAcoContextRefs,
} from './schemas/adversarial-contract-loop';

const baseEvaluatorVerdict = {
  schemaVersion: ACO_ADVERSARIAL_CONTRACT_LOOP_SCHEMA_VERSION,
  sprintId: 'sprint-001',
  round: 1,
  verdict: 'blocked_by_evidence',
  originalObjective: 'Complete ACO Context Orchestrator readiness relative to STAB-002 branches',
  goalCompletion: exampleAcoAdversarialGoalCompletion,
  contractPath: 'contracts/sprint-001.contract.json',
  generatorReportPath: 'attempts/sprint-001-round-001.generator-report.json',
  scores: { 'criterion-traceability-001': 8 },
  findings: [exampleAcoAdversarialFinding],
  evidence: ['ACO status readiness=needs_approval'],
  nextDecisionKind: 'blocked_by_evidence',
  acoContextRefs: exampleAcoContextRefs,
} as const;

describe('ACO adversarial contract loop schemas', () => {
  test('Evaluator verdict requires original objective and goal completion evidence', () => {
    const parsed = acoAdversarialEvaluatorVerdictSchema.parse(baseEvaluatorVerdict);

    expect(parsed.originalObjective).toContain('Complete ACO Context Orchestrator');
    expect(parsed.goalCompletion.canClaimComplete).toBe(false);
    expect(parsed.goalCompletion.blockers).toContain('graph-waiver.bmad-plugins-marketplace');

    const missingGoalCompletion = {
      ...baseEvaluatorVerdict,
      goalCompletion: undefined,
    };
    expect(acoAdversarialEvaluatorVerdictSchema.safeParse(missingGoalCompletion).success).toBe(
      false
    );
  });

  test('Evaluator cannot pass unless original goal completion is claimable', () => {
    expect(
      acoAdversarialEvaluatorVerdictSchema.safeParse({
        ...baseEvaluatorVerdict,
        verdict: 'passed',
      }).success
    ).toBe(false);

    expect(
      acoAdversarialEvaluatorVerdictSchema.safeParse({
        ...baseEvaluatorVerdict,
        verdict: 'passed',
        goalCompletion: {
          status: 'complete',
          canClaimComplete: true,
          rationale: 'All ACO gates, validation, source disposition, and branch state are closed.',
          checkedEvidence: ['status.json', 'ledgers.json', 'compile-result.json', 'git status'],
          blockers: [],
          requiredNextAction: 'No retry required.',
        },
        findings: [],
        evidence: ['bun run validate passed', 'git status clean'],
        nextDecisionKind: 'ready_for_implementation',
      }).success
    ).toBe(true);

    expect(
      acoAdversarialEvaluatorVerdictSchema.safeParse({
        ...baseEvaluatorVerdict,
        verdict: 'failed_contract',
        goalCompletion: {
          status: 'complete',
          canClaimComplete: true,
          rationale: 'Contradictory complete status with failed verdict.',
          checkedEvidence: ['status.json'],
          blockers: [],
          requiredNextAction: 'No retry required.',
        },
      }).success
    ).toBe(false);
  });

  test('Generator report cannot certify readiness or pass/fail', () => {
    const generatorReport = {
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
      certification: 'passed',
      acoContextRefs: exampleAcoContextRefs,
    };

    expect(acoAdversarialGeneratorReportSchema.safeParse(generatorReport).success).toBe(false);
    expect(
      acoAdversarialGeneratorReportSchema.safeParse({
        ...generatorReport,
        certification: 'not-certified-by-generator',
      }).success
    ).toBe(true);
  });
});
