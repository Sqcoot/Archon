import { REQUIRED_BMAD_CONTRACT_ARTIFACTS, REQUIRED_BMAD_ROLE_IDS } from './constants';
import {
  bmadAdversarialReviewSchema,
  bmadContractArtifactBundleSchema,
  bmadEvaluatorVerdictSchema,
  bmadRoleContractSchema,
  bmadRoleRegistrySchema,
  bmadUncertaintyRouterPacketSchema,
} from './schemas';
import type { BmadRoleRegistry } from './schemas';

const unsafeWriteFragments = [
  'product source',
  'runtime mutation',
  'credentials',
  'credential',
  'config mutation',
  'server route',
  'web route',
  'provider sdk',
  'graph cache',
  'remote',
] as const;

export function checkRoleContract(input: unknown): readonly string[] {
  const parsed = bmadRoleContractSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map(issue => `invalid role contract: ${issue.message}`);
  }

  const contract = parsed.data;
  const errors: string[] = [];
  if (contract.runtimeKind !== 'workflow-artifact-contract') {
    errors.push(`${contract.id} must be a workflow artifact contract`);
  }
  if (contract.nativeRuntimeSupport === 'proven' && contract.nativeRuntimeProof.length === 0) {
    errors.push(`${contract.id} claims native runtime support without proof metadata`);
  }
  if (contract.id === 'generator' && contract.certification !== 'not-certified-by-generator') {
    errors.push('generator certification must be not-certified-by-generator');
  }
  if (contract.id === 'evaluator') {
    if (contract.certification !== 'goal-completion-evaluator-only') {
      errors.push('evaluator certification must be goal-completion-evaluator-only');
    }
    if (!contract.canClaimGoalCompletion) {
      errors.push('evaluator role must be able to claim goal completion when evidence passes');
    }
    if (contract.completionClaimPolicy !== 'evaluator-only') {
      errors.push('evaluator completion policy must be evaluator-only');
    }
  } else {
    if (contract.canClaimGoalCompletion) {
      errors.push(`${contract.id} is not evaluator and cannot claim goal completion`);
    }
    if (contract.completionClaimPolicy === 'evaluator-only') {
      errors.push(`${contract.id} is not evaluator and cannot use evaluator-only policy`);
    }
  }
  for (const write of contract.writes) {
    const normalized = write.toLowerCase();
    if (unsafeWriteFragments.some(fragment => normalized.includes(fragment))) {
      errors.push(`${contract.id} has unsafe write permission: ${write}`);
    }
  }
  return errors;
}

export function checkRoleRegistry(input: unknown): readonly string[] {
  const parsed = bmadRoleRegistrySchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map(issue => `invalid role registry: ${issue.message}`);
  }

  const registry = parsed.data;
  const errors: string[] = [];
  const roleIds = registry.roles.map(role => role.id);
  const uniqueRoleIds = new Set(roleIds);
  if (uniqueRoleIds.size !== roleIds.length) {
    errors.push('duplicate role ids are not allowed');
  }
  for (const required of REQUIRED_BMAD_ROLE_IDS) {
    if (!uniqueRoleIds.has(required)) {
      errors.push(`missing required BMAD role ${required}`);
    }
  }
  for (const role of registry.roles) {
    errors.push(...checkRoleContract(role));
  }
  return errors;
}

export function checkRouterPacket(input: unknown): readonly string[] {
  const parsed = bmadUncertaintyRouterPacketSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map(issue => `invalid router packet: ${issue.message}`);
  }

  const packet = parsed.data;
  const errors: string[] = [];
  const optionIds = packet.options.map(option => option.id);
  const uniqueOptionIds = new Set(optionIds);
  if (uniqueOptionIds.size !== optionIds.length) {
    errors.push('duplicate router option ids are not allowed');
  }
  if (packet.selectedOption !== null && !uniqueOptionIds.has(packet.selectedOption)) {
    errors.push(`selected option ${packet.selectedOption} is not present in router options`);
  }
  if (packet.escalationReasons.length > 0 && packet.rejectedAlternatives.length === 0) {
    errors.push('router packets with escalation reasons must preserve rejected alternatives');
  }
  return errors;
}

export function checkEvaluatorVerdict(input: unknown, registryInput: unknown): readonly string[] {
  const parsedVerdict = bmadEvaluatorVerdictSchema.safeParse(input);
  if (!parsedVerdict.success) {
    return parsedVerdict.error.issues.map(issue => `invalid evaluator verdict: ${issue.message}`);
  }
  const parsedRegistry = bmadRoleRegistrySchema.safeParse(registryInput);
  if (!parsedRegistry.success) {
    return parsedRegistry.error.issues.map(issue => `invalid role registry: ${issue.message}`);
  }

  const verdict = parsedVerdict.data;
  const registry = parsedRegistry.data;
  const evaluatorRole = registry.roles.find(role => role.id === verdict.evaluatorRoleId);
  const errors: string[] = [];
  if (evaluatorRole === undefined) {
    errors.push(`missing evaluator role ${verdict.evaluatorRoleId}`);
  } else if (verdict.goalCompletion.canClaimComplete) {
    if (evaluatorRole.id !== 'evaluator') {
      errors.push('only evaluator role can claim goal completion');
    }
    if (!evaluatorRole.canClaimGoalCompletion) {
      errors.push('verdict role lacks completion authority');
    }
    if (evaluatorRole.certification !== 'goal-completion-evaluator-only') {
      errors.push('completion claims require goal-completion-evaluator-only certification');
    }
    if (verdict.verdict !== 'complete') {
      errors.push('canClaimComplete true requires complete verdict');
    }
  }
  if (verdict.verdict === 'complete' && !verdict.goalCompletion.canClaimComplete) {
    errors.push('complete verdict must explicitly claim completion');
  }
  return errors;
}

export function checkAdversarialReview(input: unknown): readonly string[] {
  const parsed = bmadAdversarialReviewSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map(issue => `invalid adversarial review: ${issue.message}`);
  }

  return [
    ...checkRoleRegistry(parsed.data.roleRegistry),
    ...checkRouterPacket(parsed.data.routerPacket),
    ...checkEvaluatorVerdict(parsed.data.evaluatorVerdict, parsed.data.roleRegistry),
  ];
}

export function checkBmadContractArtifactBundle(input: unknown): readonly string[] {
  const parsed = bmadContractArtifactBundleSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map(issue => `invalid artifact bundle: ${issue.message}`);
  }

  const bundle = parsed.data;
  const errors: string[] = [
    ...checkRoleRegistry(bundle.roleRegistry),
    ...checkRouterPacket(bundle.routerPacket),
    ...checkEvaluatorVerdict(bundle.evaluatorVerdict, bundle.roleRegistry),
  ];
  const artifactNames = bundle.artifacts.map(artifact => artifact.name);
  const uniqueArtifactNames = new Set(artifactNames);
  if (uniqueArtifactNames.size !== artifactNames.length) {
    errors.push('duplicate BMAD contract artifact names are not allowed');
  }
  for (const required of REQUIRED_BMAD_CONTRACT_ARTIFACTS) {
    if (!uniqueArtifactNames.has(required)) {
      errors.push(`missing required BMAD contract artifact ${required}`);
    }
  }
  for (const artifact of bundle.artifacts) {
    if (artifact.content.trim().length === 0) {
      errors.push(`${artifact.name} must have non-empty content`);
    }
  }
  return errors;
}

export function findRole(
  registry: BmadRoleRegistry,
  id: string
): BmadRoleRegistry['roles'][number] | undefined {
  return registry.roles.find(role => role.id === id);
}
