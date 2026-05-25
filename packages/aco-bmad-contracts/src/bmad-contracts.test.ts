import { describe, expect, test } from 'bun:test';
import {
  REQUIRED_BMAD_CONTRACT_ARTIFACTS,
  REQUIRED_BMAD_ROLE_IDS,
  bmadEscalationReasonValues,
  bmadRoleContractFixtureGate,
  buildBmadContractArtifacts,
  buildEvaluatorVerdict,
  buildRoleContract,
  buildRoleRegistry,
  buildRouterPacket,
  checkEvaluatorVerdict,
  defaultBmadRoleContracts,
  parseBmadContractArtifactBundle,
} from './index';
import type { BmadContractArtifactBundle, BmadRoleContract } from './index';

const GOLDEN_FILE_NAMES = {
  'bmad-role-catalog.json': 'bmad-role-catalog.expected.json',
  'generator-role-contract.yaml': 'generator-role-contract.expected.yaml',
  'evaluator-role-contract.yaml': 'evaluator-role-contract.expected.yaml',
  'uncertainty-router-packet.yaml': 'uncertainty-router-packet.expected.yaml',
  'evaluator-verdict.json': 'evaluator-verdict.expected.json',
  'adversarial-loop-summary.md': 'adversarial-loop-summary.expected.md',
} as const;

describe('BMAD role contract artifacts', () => {
  test('renders all required artifacts deterministically against goldens', async () => {
    const bundle = buildBmadContractArtifacts();

    expect(bundle.ok).toBe(true);
    if (!bundle.ok) throw new Error(bundle.issues.join('\n'));
    expect(bundle.value.artifacts.map(artifact => artifact.name)).toEqual([
      ...REQUIRED_BMAD_CONTRACT_ARTIFACTS,
    ]);

    for (const artifact of bundle.value.artifacts) {
      const expected = await loadGolden(GOLDEN_FILE_NAMES[artifact.name]);
      if (artifact.name.endsWith('.json')) {
        expect(JSON.parse(artifact.content)).toEqual(JSON.parse(expected));
      } else {
        expect(artifact.content).toBe(expected);
      }
      expect(artifact.content).not.toContain('generatedAt');
      expect(artifact.content).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    }

    const secondRender = buildBmadContractArtifacts();
    expect(secondRender.ok).toBe(true);
    if (!secondRender.ok) throw new Error(secondRender.issues.join('\n'));
    expect(secondRender.value).toEqual(bundle.value);
  });

  test('preserves role catalog and certification boundaries from readonly evidence', () => {
    const registry = buildRoleRegistry();

    expect(registry.ok).toBe(true);
    if (!registry.ok) throw new Error(registry.issues.join('\n'));
    expect(registry.value.roles.map(role => role.id)).toEqual([...REQUIRED_BMAD_ROLE_IDS]);
    expect(
      registry.value.roles.every(role => role.runtimeKind === 'workflow-artifact-contract')
    ).toBe(true);
    expect(registry.value.roles.every(role => role.nativeRuntimeSupport === 'unknown')).toBe(true);

    const generator = requiredRole(registry.value.roles, 'generator');
    const evaluator = requiredRole(registry.value.roles, 'evaluator');
    expect(generator.certification).toBe('not-certified-by-generator');
    expect(generator.canClaimGoalCompletion).toBe(false);
    expect(evaluator.certification).toBe('goal-completion-evaluator-only');
    expect(evaluator.canClaimGoalCompletion).toBe(true);
  });

  test('fails closed on malformed and unsafe role contracts', () => {
    const generator = requiredRole(defaultBmadRoleContracts(), 'generator');

    expect(buildRoleContract({ ...generator, certification: 'gate-result' }).ok).toBe(false);
    expect(buildRoleContract({ ...generator, nativeRuntimeSupport: 'proven' }).ok).toBe(false);
    expect(buildRoleContract({ ...generator, writes: ['product source'] }).ok).toBe(false);
    expect(
      buildRoleContract({
        ...generator,
        canClaimGoalCompletion: true,
        completionClaimPolicy: 'evaluator-only',
      }).ok
    ).toBe(false);

    const missingReads: Record<string, unknown> = { ...generator };
    delete missingReads.reads;
    expect(buildRoleContract(missingReads).ok).toBe(false);
  });

  test('fails closed on evaluator completion authority violations', () => {
    const registry = buildRoleRegistry();
    const verdict = buildEvaluatorVerdict();
    expect(registry.ok).toBe(true);
    expect(verdict.ok).toBe(true);
    if (!registry.ok) throw new Error(registry.issues.join('\n'));
    if (!verdict.ok) throw new Error(verdict.issues.join('\n'));

    expect(
      checkEvaluatorVerdict(
        {
          ...verdict.value,
          evaluatorRoleId: 'generator',
          verdict: 'complete',
          goalCompletion: {
            ...verdict.value.goalCompletion,
            canClaimComplete: true,
          },
        },
        registry.value
      ).join('\n')
    ).toContain('only evaluator role can claim goal completion');

    expect(
      checkEvaluatorVerdict(
        {
          ...verdict.value,
          verdict: 'complete',
          goalCompletion: {
            ...verdict.value.goalCompletion,
            canClaimComplete: false,
          },
        },
        registry.value
      ).join('\n')
    ).toContain('complete verdict must explicitly claim completion');

    const missingGoalCompletion: Record<string, unknown> = { ...verdict.value };
    delete missingGoalCompletion.goalCompletion;
    expect(checkEvaluatorVerdict(missingGoalCompletion, registry.value).join('\n')).toContain(
      'invalid evaluator verdict'
    );
  });

  test('fails closed on incomplete router packets and preserves escalation reasons', () => {
    const packet = buildRouterPacket();

    expect(packet.ok).toBe(true);
    if (!packet.ok) throw new Error(packet.issues.join('\n'));
    expect(packet.value.escalationReasons).toEqual([...bmadEscalationReasonValues]);

    const withoutRejected = buildRouterPacket({
      ...packet.value,
      rejectedAlternatives: [],
    });
    expect(withoutRejected.ok).toBe(false);

    const missingSelectedOption = buildRouterPacket({
      ...packet.value,
      selectedOption: 'Z',
    });
    expect(missingSelectedOption.ok).toBe(false);

    const missingOwner: Record<string, unknown> = { ...packet.value };
    delete missingOwner.owner;
    expect(buildRouterPacket(missingOwner).ok).toBe(false);
  });

  test('fixture gate passes defaults and fails on duplicate artifacts', async () => {
    const result = await bmadRoleContractFixtureGate.run(undefined);

    expect(bmadRoleContractFixtureGate.mutates).toBe('read-only');
    expect(result.status).toBe('passed');
    if (result.status !== 'passed') throw new Error('fixture gate did not pass');
    expect(result.value.roleIds).toEqual([...REQUIRED_BMAD_ROLE_IDS]);
    expect(result.value.artifactNames).toEqual([...REQUIRED_BMAD_CONTRACT_ARTIFACTS]);
    expect(result.value.escalationReasons).toEqual([...bmadEscalationReasonValues]);

    const bundle = buildBmadContractArtifacts();
    expect(bundle.ok).toBe(true);
    if (!bundle.ok) throw new Error(bundle.issues.join('\n'));

    const duplicateBundle: BmadContractArtifactBundle = {
      ...bundle.value,
      artifacts: bundle.value.artifacts.map((artifact, index) =>
        index === 1
          ? { ...artifact, name: bundle.value.artifacts[0]?.name ?? artifact.name }
          : artifact
      ),
    };
    expect(parseBmadContractArtifactBundle(duplicateBundle).ok).toBe(false);
    const duplicateResult = await bmadRoleContractFixtureGate.run(duplicateBundle);
    expect(duplicateResult.status).toBe('failed');
    if (duplicateResult.status !== 'failed') throw new Error('expected duplicate artifact failure');
    expect(duplicateResult.errors.join('\n')).toContain('duplicate BMAD contract artifact');
  });
});

function requiredRole(roles: readonly BmadRoleContract[], id: string): BmadRoleContract {
  const role = roles.find(item => item.id === id);
  if (role === undefined) throw new Error(`missing role ${id}`);
  return role;
}

async function loadGolden(fileName: string): Promise<string> {
  const root = new URL('../../../tests/fixtures/aco/bmad-contracts/', import.meta.url);
  return Bun.file(new URL(fileName, root)).text();
}
