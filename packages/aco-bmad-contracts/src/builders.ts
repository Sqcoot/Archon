import type { EvidenceRef, ParseResult } from '@archon/aco-core';
import type { REQUIRED_BMAD_ROLE_IDS } from './constants';
import {
  bmadAdversarialReviewSchema,
  bmadContractArtifactBundleSchema,
  bmadEvaluatorVerdictSchema,
  bmadRoleContractSchema,
  bmadRoleRegistrySchema,
  bmadUncertaintyRouterPacketSchema,
} from './schemas';
import type {
  BmadAdversarialReview,
  BmadContractArtifact,
  BmadContractArtifactBundle,
  BmadEvaluatorVerdict,
  BmadRoleCertification,
  BmadRoleContract,
  BmadRoleRegistry,
  BmadUncertaintyRouterPacket,
} from './schemas';
import {
  renderAdversarialLoopMarkdown,
  renderEvaluatorVerdictJson,
  renderRoleContractYaml,
  renderRoleRegistryJson,
  renderRouterPacketYaml,
} from './renderers';
import {
  checkAdversarialReview,
  checkBmadContractArtifactBundle,
  checkEvaluatorVerdict,
  checkRoleContract,
  checkRoleRegistry,
  checkRouterPacket,
} from './checks';

const ROLE_CONTRACTS_EVIDENCE = {
  id: 'evidence.bmad.role-contracts',
  source: 'architecture/bmad-role-contracts.md',
  summary: 'Readonly S5 evidence defines BMAD/ACO role boundaries and checker requirements',
  confidence: 'high',
  freshness: 'unknown',
} as const satisfies EvidenceRef;

const SUBAGENT_CATALOG_EVIDENCE = {
  id: 'evidence.bmad.subagent-role-catalog',
  source: 'architecture/subagents-role-contracts.yaml',
  summary: 'Readonly S5 evidence lists the required role catalog and certifications',
  confidence: 'high',
  freshness: 'unknown',
} as const satisfies EvidenceRef;

const ROUTER_EVIDENCE = {
  id: 'evidence.bmad.uncertainty-router',
  source: 'party-mode/uncertainty-router.md',
  summary: 'Readonly S5 evidence defines ambiguity routing and escalation triggers',
  confidence: 'high',
  freshness: 'unknown',
} as const satisfies EvidenceRef;

const ROUTER_TEMPLATE_EVIDENCE = {
  id: 'evidence.bmad.router-template',
  source: 'party-mode/router-output-template.yaml',
  summary: 'Readonly S5 evidence defines the router packet template fields',
  confidence: 'high',
  freshness: 'unknown',
} as const satisfies EvidenceRef;

const ROLE_SCHEMA_EVIDENCE = {
  id: 'evidence.bmad.role-contract-schema',
  source: 'schemas/role-contract.schema.json',
  summary: 'Readonly S5 evidence defines the role contract schema baseline',
  confidence: 'high',
  freshness: 'unknown',
} as const satisfies EvidenceRef;

const S4_BOUNDARY_EVIDENCE = {
  id: 'evidence.bmad.s4-contract-boundary',
  source: 'party-mode-output-s4-consensus/next_goal_4000chars.txt',
  summary: 'S4 established the pure package and contract-only runtime boundary pattern',
  confidence: 'high',
  freshness: 'unknown',
} as const satisfies EvidenceRef;

interface RoleSeed {
  readonly id: (typeof REQUIRED_BMAD_ROLE_IDS)[number];
  readonly role: string;
  readonly description: string;
  readonly reads: readonly string[];
  readonly writes: readonly string[];
  readonly prohibitedActions: readonly string[];
  readonly certification: BmadRoleCertification;
  readonly allowedTools: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly handoffInputs: readonly string[];
  readonly handoffOutputs: readonly string[];
  readonly canClaimGoalCompletion: boolean;
}

export function defaultBmadRoleContracts(): readonly BmadRoleContract[] {
  return roleSeeds().map(seed => createDefaultRoleContract(seed));
}

export function buildRoleContract(input: unknown): ParseResult<BmadRoleContract> {
  const parsed = bmadRoleContractSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }

  const issues = checkRoleContract(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function buildRoleRegistry(
  contracts: readonly BmadRoleContract[] = defaultBmadRoleContracts()
): ParseResult<BmadRoleRegistry> {
  const registry = {
    kind: 'aco-bmad-role-registry',
    schemaVersion: 'aco.role-contract-catalog.v1',
    roles: [...contracts],
    evidence: [ROLE_CONTRACTS_EVIDENCE, SUBAGENT_CATALOG_EVIDENCE],
  } as const;

  const parsed = bmadRoleRegistrySchema.safeParse(registry);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }

  const issues = checkRoleRegistry(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function buildRouterPacket(
  input: unknown = defaultRouterPacketInput()
): ParseResult<BmadUncertaintyRouterPacket> {
  const parsed = bmadUncertaintyRouterPacketSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }

  const issues = checkRouterPacket(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function buildEvaluatorVerdict(
  input: unknown = defaultEvaluatorVerdictInput(),
  registry: BmadRoleRegistry = buildDefaultRegistryOrThrow()
): ParseResult<BmadEvaluatorVerdict> {
  const parsed = bmadEvaluatorVerdictSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }

  const issues = checkEvaluatorVerdict(parsed.data, registry);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function buildAdversarialReview(input: {
  readonly id?: string;
  readonly objective: string;
  readonly roleRegistry: BmadRoleRegistry;
  readonly routerPacket: BmadUncertaintyRouterPacket;
  readonly evaluatorVerdict: BmadEvaluatorVerdict;
}): ParseResult<BmadAdversarialReview> {
  const review = {
    kind: 'aco-bmad-adversarial-review',
    schemaVersion: 'aco.adversarial-review.v1',
    id: input.id ?? 'aco.bmad-contracts.s5.review',
    objective: input.objective,
    roleRegistry: input.roleRegistry,
    routerPacket: input.routerPacket,
    evaluatorVerdict: input.evaluatorVerdict,
    evidence: [ROLE_CONTRACTS_EVIDENCE, ROUTER_EVIDENCE, S4_BOUNDARY_EVIDENCE],
  } as const;

  const parsed = bmadAdversarialReviewSchema.safeParse(review);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }

  const issues = checkAdversarialReview(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function parseBmadContractArtifactBundle(
  input: unknown
): ParseResult<BmadContractArtifactBundle> {
  const parsed = bmadContractArtifactBundleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }

  const issues = checkBmadContractArtifactBundle(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function buildBmadContractArtifacts(
  objective = 'Implement S5 BMAD/ACO role contracts and uncertainty router as pure artifacts.'
): ParseResult<BmadContractArtifactBundle> {
  const roleRegistry = buildRoleRegistry();
  if (!roleRegistry.ok) return roleRegistry;

  const routerPacket = buildRouterPacket();
  if (!routerPacket.ok) return routerPacket;

  const evaluatorVerdict = buildEvaluatorVerdict(
    defaultEvaluatorVerdictInput(),
    roleRegistry.value
  );
  if (!evaluatorVerdict.ok) return evaluatorVerdict;

  const adversarialReview = buildAdversarialReview({
    objective,
    roleRegistry: roleRegistry.value,
    routerPacket: routerPacket.value,
    evaluatorVerdict: evaluatorVerdict.value,
  });
  if (!adversarialReview.ok) return adversarialReview;

  const generatorRole = findRoleOrThrow(roleRegistry.value, 'generator');
  const evaluatorRole = findRoleOrThrow(roleRegistry.value, 'evaluator');
  const artifacts: readonly BmadContractArtifact[] = [
    {
      name: 'bmad-role-catalog.json',
      mediaType: 'application/json',
      schemaVersion: roleRegistry.value.schemaVersion,
      content: renderRoleRegistryJson(roleRegistry.value),
    },
    {
      name: 'generator-role-contract.yaml',
      mediaType: 'application/yaml',
      schemaVersion: generatorRole.schemaVersion,
      content: renderRoleContractYaml(generatorRole),
    },
    {
      name: 'evaluator-role-contract.yaml',
      mediaType: 'application/yaml',
      schemaVersion: evaluatorRole.schemaVersion,
      content: renderRoleContractYaml(evaluatorRole),
    },
    {
      name: 'uncertainty-router-packet.yaml',
      mediaType: 'application/yaml',
      schemaVersion: routerPacket.value.schemaVersion,
      content: renderRouterPacketYaml(routerPacket.value),
    },
    {
      name: 'evaluator-verdict.json',
      mediaType: 'application/json',
      schemaVersion: evaluatorVerdict.value.schemaVersion,
      content: renderEvaluatorVerdictJson(evaluatorVerdict.value),
    },
    {
      name: 'adversarial-loop-summary.md',
      mediaType: 'text/markdown',
      schemaVersion: adversarialReview.value.schemaVersion,
      content: renderAdversarialLoopMarkdown(adversarialReview.value),
    },
  ];

  const bundle = {
    kind: 'aco-bmad-contract-artifact-bundle',
    schemaVersion: 'aco.bmad-contract-artifacts.v1',
    artifacts,
    roleRegistry: roleRegistry.value,
    routerPacket: routerPacket.value,
    evaluatorVerdict: evaluatorVerdict.value,
    evidence: [
      ROLE_CONTRACTS_EVIDENCE,
      SUBAGENT_CATALOG_EVIDENCE,
      ROUTER_EVIDENCE,
      ROUTER_TEMPLATE_EVIDENCE,
      ROLE_SCHEMA_EVIDENCE,
    ],
  } as const;

  const parsed = bmadContractArtifactBundleSchema.safeParse(bundle);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }

  const issues = checkBmadContractArtifactBundle(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

function createDefaultRoleContract(seed: RoleSeed): BmadRoleContract {
  return bmadRoleContractSchema.parse({
    kind: 'aco-bmad-role-contract',
    schemaVersion: 'aco.role-contract.v1',
    id: seed.id,
    role: seed.role,
    description: seed.description,
    owner: 'aco-bmad-contracts',
    runtimeKind: 'workflow-artifact-contract',
    nativeRuntimeSupport: 'unknown',
    nativeRuntimeProof: [],
    reads: seed.reads,
    writes: seed.writes,
    prohibitedActions: seed.prohibitedActions,
    allowedTools: seed.allowedTools,
    requiredEvidence: seed.requiredEvidence,
    handoffInputs: seed.handoffInputs,
    handoffOutputs: seed.handoffOutputs,
    certification: seed.certification,
    completionClaimPolicy: seed.canClaimGoalCompletion
      ? 'evaluator-only'
      : 'cannot-claim-completion',
    canClaimGoalCompletion: seed.canClaimGoalCompletion,
    evidence: [ROLE_CONTRACTS_EVIDENCE, SUBAGENT_CATALOG_EVIDENCE],
  });
}

function roleSeeds(): readonly RoleSeed[] {
  return [
    {
      id: 'coordinator-triage',
      role: 'Coordinator/Triage',
      description: 'Classifies ambiguity, owning package, and routing needs.',
      reads: ['status', 'ledgers', 'compile'],
      writes: ['coordinator triage'],
      prohibitedActions: ['certify final readiness', 'claim goal completion'],
      certification: 'none',
      allowedTools: ['Read', 'Write'],
      requiredEvidence: ['status', 'ledgers', 'compile result'],
      handoffInputs: ['status', 'ledgers', 'compile'],
      handoffOutputs: ['coordinator triage'],
      canClaimGoalCompletion: false,
    },
    {
      id: 'skill-curator',
      role: 'Skill Curator',
      description: 'Evaluates skill and method applicability without claiming runtime support.',
      reads: ['status', 'ledgers', 'compile', 'triage'],
      writes: ['skill curator report'],
      prohibitedActions: ['certify runtime support', 'claim goal completion'],
      certification: 'none',
      allowedTools: ['Read', 'Write'],
      requiredEvidence: ['triage packet', 'skill evidence'],
      handoffInputs: ['status', 'ledgers', 'compile', 'triage'],
      handoffOutputs: ['skill curator report'],
      canClaimGoalCompletion: false,
    },
    {
      id: 'bmad-reviewer',
      role: 'BMAD Reviewer',
      description: 'Reviews role/process methodology and preserves gate authority boundaries.',
      reads: ['status', 'compile', 'triage'],
      writes: ['BMAD review'],
      prohibitedActions: ['override gates', 'claim goal completion'],
      certification: 'none',
      allowedTools: ['Read', 'Write'],
      requiredEvidence: ['compile result', 'triage packet'],
      handoffInputs: ['status', 'compile', 'triage'],
      handoffOutputs: ['BMAD review'],
      canClaimGoalCompletion: false,
    },
    {
      id: 'agentic-search',
      role: 'Agentic Search',
      description:
        'Produces search/evidence reports without certifying implementation correctness.',
      reads: ['status', 'ledgers', 'compile'],
      writes: ['search report'],
      prohibitedActions: ['certify implementation correctness', 'claim goal completion'],
      certification: 'none',
      allowedTools: ['Read', 'Write'],
      requiredEvidence: ['status', 'ledgers', 'compile result'],
      handoffInputs: ['status', 'ledgers', 'compile'],
      handoffOutputs: ['search report'],
      canClaimGoalCompletion: false,
    },
    {
      id: 'planner',
      role: 'Planner',
      description: 'Turns evidence into a plan or sprint plan without certifying completion.',
      reads: ['evidence', 'search', 'approval record'],
      writes: ['plan', 'sprint plan'],
      prohibitedActions: ['certify completion', 'claim goal completion'],
      certification: 'none',
      allowedTools: ['Read', 'Write'],
      requiredEvidence: ['evidence', 'search report', 'approval record'],
      handoffInputs: ['evidence', 'search', 'approval record'],
      handoffOutputs: ['plan', 'sprint plan'],
      canClaimGoalCompletion: false,
    },
    {
      id: 'contract',
      role: 'Contract',
      description: 'Creates sprint contracts from plan and compile artifacts.',
      reads: ['plan', 'compile'],
      writes: ['sprint contract'],
      prohibitedActions: ['certify completion', 'claim goal completion'],
      certification: 'artifact-complete',
      allowedTools: ['Read', 'Write'],
      requiredEvidence: ['plan', 'compile result'],
      handoffInputs: ['plan', 'compile'],
      handoffOutputs: ['sprint contract'],
      canClaimGoalCompletion: false,
    },
    {
      id: 'generator',
      role: 'Generator',
      description: 'Produces implementation reports but never certifies pass/fail or completion.',
      reads: ['contract', 'feedback', 'compile'],
      writes: ['generator report'],
      prohibitedActions: ['certify pass/fail', 'claim goal completion', 'self-certify correctness'],
      certification: 'not-certified-by-generator',
      allowedTools: ['Read', 'Write'],
      requiredEvidence: ['contract', 'feedback', 'compile result'],
      handoffInputs: ['contract', 'feedback', 'compile'],
      handoffOutputs: ['generator report'],
      canClaimGoalCompletion: false,
    },
    {
      id: 'qa-verifier',
      role: 'QA/Verifier',
      description:
        'Verifies against contract and generator report without claiming final readiness.',
      reads: ['contract', 'generator report'],
      writes: ['verifier report'],
      prohibitedActions: ['certify final readiness', 'claim goal completion'],
      certification: 'verifier-report-only',
      allowedTools: ['Read', 'Write'],
      requiredEvidence: ['contract', 'generator report', 'verification evidence'],
      handoffInputs: ['contract', 'generator report'],
      handoffOutputs: ['verifier report'],
      canClaimGoalCompletion: false,
    },
    {
      id: 'evaluator',
      role: 'Evaluator',
      description: 'Issues the only verdict that can claim goal completion when evidence passes.',
      reads: ['all evidence'],
      writes: ['verdict'],
      prohibitedActions: ['certify completion without original objective evidence'],
      certification: 'goal-completion-evaluator-only',
      allowedTools: ['Read', 'Write'],
      requiredEvidence: ['all evidence', 'verifier report', 'original objective'],
      handoffInputs: ['all evidence'],
      handoffOutputs: ['verdict'],
      canClaimGoalCompletion: true,
    },
  ];
}

function defaultRouterPacketInput(): BmadUncertaintyRouterPacket {
  return bmadUncertaintyRouterPacketSchema.parse({
    kind: 'uncertainty-router-packet',
    id: 'aco.bmad-contracts.s5.router.default',
    schemaVersion: 'aco.party-mode-uncertainty-router.v1',
    question: 'Should S5 claim native BMAD subagent enforcement?',
    context:
      'S5 preserves BMAD/ACO roles as workflow artifact contracts until provider runtime evidence proves native enforcement.',
    options: [
      {
        id: 'A',
        decision: 'Keep roles as workflow artifact contracts and route runtime uncertainty.',
        pros: ['Matches readonly S5 evidence', 'Avoids unsupported runtime claims'],
        cons: ['Defers live orchestration'],
      },
      {
        id: 'B',
        decision: 'Claim native subagent enforcement in S5.',
        pros: ['Would simplify future runtime language'],
        cons: ['No provider proof exists', 'Violates S5 boundary'],
      },
    ],
    rolesRequested: [
      'Coordinator/Triage',
      'Architect',
      'Maintainer',
      'Security/Gatekeeper',
      'Provider Specialist',
      'BMAD Reviewer',
      'QA/Evaluator',
    ],
    confidenceBefore: 'medium',
    selectedOption: 'A',
    confidenceAfter: 'high',
    requiredEvidence: ['provider runtime proof', 'role contract checker results'],
    rejectedAlternatives: ['B: native enforcement claim without proof'],
    owner: 'aco-bmad-contracts',
    expiresWhen: 'native provider runtime enforcement is proven by evidence',
    escalationReasons: [
      'unclear-ownership',
      'unproven-runtime-support',
      'mutation-safety',
      'stale-evidence',
      'branch-contest',
      'provider-hook-plugin-sdk-uncertainty',
      'compatibility-vs-cleanup',
      'gate-passes-original-goal-incomplete',
    ],
    notes: 'Escalate rather than guess when runtime or completion authority is unclear.',
    evidence: [ROUTER_EVIDENCE, ROUTER_TEMPLATE_EVIDENCE],
  });
}

function defaultEvaluatorVerdictInput(): BmadEvaluatorVerdict {
  return bmadEvaluatorVerdictSchema.parse({
    kind: 'aco-bmad-evaluator-verdict',
    schemaVersion: 'aco.evaluator-verdict.v1',
    id: 'aco.bmad-contracts.s5.evaluator-verdict.default',
    evaluatorRoleId: 'evaluator',
    verdict: 'incomplete',
    goalCompletion: {
      canClaimComplete: false,
      reason:
        'S5 contract artifacts can be validated, but implementation completion requires current objective evidence.',
      evidence: [ROLE_CONTRACTS_EVIDENCE],
    },
    remainingRisks: [
      'native provider subagent enforcement remains unproven',
      'future CLI/workflow wiring is outside S5',
    ],
    requiredFollowups: ['implement S5 package', 'run role-contract checker and regression tests'],
    evidence: [ROLE_CONTRACTS_EVIDENCE, S4_BOUNDARY_EVIDENCE],
  });
}

function buildDefaultRegistryOrThrow(): BmadRoleRegistry {
  const registry = buildRoleRegistry();
  if (!registry.ok) {
    throw new Error(registry.issues.join('\n'));
  }
  return registry.value;
}

function findRoleOrThrow(registry: BmadRoleRegistry, roleId: string): BmadRoleContract {
  const role = registry.roles.find(item => item.id === roleId);
  if (role === undefined) {
    throw new Error(`missing required role ${roleId}`);
  }
  return role;
}
