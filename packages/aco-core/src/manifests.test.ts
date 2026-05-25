import { describe, expect, test } from 'bun:test';
import {
  compileReferenceSurfacePlan,
  parseManifestRecord,
  parseReferenceSurfacePlan,
  referenceSurfaceCompatibilityGate,
  validateMigrationOrderPlan,
} from './index';
import type { ReferenceSurfacePlan } from './index';

describe('reference surface manifest projection', () => {
  test('compiles current fixture into stable typed manifests and bootloaded registries', async () => {
    const plan = await loadReferencePlan();
    const compiled = compileReferenceSurfacePlan(plan);

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) throw new Error(compiled.issues.join('\n'));

    expect(compiled.value.commandManifests).toHaveLength(12);
    expect(compiled.value.capabilityManifests).toHaveLength(17);
    expect(compiled.value.workflowManifests).toHaveLength(2);
    expect(compiled.value.surfaceManifests).toHaveLength(14);
    expect(compiled.value.gateManifests).toHaveLength(1);
    expect(compiled.value.records).toHaveLength(46);
    expect(compiled.value.registries.commands.bootloaded).toBe(true);
    expect(compiled.value.registries.workflows.bootloaded).toBe(true);
    expect(
      compiled.value.registries.commands.get('command.archon-aco-status-cwd-repo-json')
    ).toMatchObject({
      mutates: 'read-only',
      approvalRequired: false,
      compatibility: 'preserve',
    });
    expect(
      compiled.value.registries.commands.get('command.archon-context-compile-prompt')
    ).toMatchObject({
      mutates: 'writes-artifacts',
      approvalRequired: false,
    });
    expect(compiled.value.registries.commands.get('command.bun-run-research-graph')).toMatchObject({
      mutates: 'writes-graph-cache',
      approvalRequired: true,
    });
    expect(compiled.value.registries.workflows.get('workflow.context-orchestrate')?.workflow).toBe(
      'context-orchestrate'
    );
    expect(() =>
      compiled.value.registries.commands.register({
        kind: 'command-manifest',
        id: 'command.extra',
        command: 'extra',
        surface: 'test',
        purpose: 'test',
        mutates: 'read-only',
        approvalRequired: false,
        owner: 'test',
        compatibility: 'preserve',
        evidence: [
          {
            id: 'evidence.extra',
            source: 'test',
            summary: 'test',
            confidence: 'high',
            freshness: 'fresh',
          },
        ],
      })
    ).toThrow('immutable after bootload');

    for (const record of compiled.value.records) {
      expect(parseManifestRecord(record).ok).toBe(true);
    }
  });

  test('fails closed on unsupported compatibility values and duplicate ids', async () => {
    const badCompatibility = await loadReferencePlan();
    badCompatibility.commands[0] = {
      ...badCompatibility.commands[0],
      compatibility: 'maybe-preserve',
    };
    const compatibilityResult = compileReferenceSurfacePlan(badCompatibility);
    expect(compatibilityResult.ok).toBe(false);
    if (!compatibilityResult.ok) {
      expect(compatibilityResult.issues.join('\n')).toContain('unsupported compatibility claim');
    }

    const duplicate = await loadReferencePlan();
    duplicate.commands = [duplicate.commands[0], ...duplicate.commands];
    const duplicateResult = compileReferenceSurfacePlan(duplicate);
    expect(duplicateResult.ok).toBe(false);
    if (!duplicateResult.ok) {
      expect(duplicateResult.issues.join('\n')).toContain('duplicate manifest id');
    }
  });
});

describe('reference surface compatibility gate', () => {
  test('passes current fixture through normalized manifests', async () => {
    const plan = await loadReferencePlan();
    const result = await referenceSurfaceCompatibilityGate.run(plan);

    expect(result.status).toBe('passed');
    if (result.status === 'passed') {
      expect(result.value.manifestCounts).toEqual({
        commands: 12,
        surfaces: 14,
        capabilities: 17,
        workflows: 2,
        gates: 1,
      });
      expect(result.value.requiredSurfaces).toEqual(
        expect.arrayContaining([
          '/aco:bootstrap-codex',
          'archon aco status',
          'all archon context commands',
          'context-orchestrate',
          'archon-aco-adversarial-loop',
        ])
      );
    }
  });

  test('fails when required context command is missing', async () => {
    const plan = await loadReferencePlan();
    plan.commands = plan.commands.filter(
      command => !command.command.startsWith('archon context ledgers')
    );

    const result = await referenceSurfaceCompatibilityGate.run(plan);

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.errors.join('\n')).toContain('missing archon context ledgers command surface');
    }
  });

  test('fails when workflow capability omits required workflow surface', async () => {
    const plan = await loadReferencePlan();
    plan.capabilities = plan.capabilities.map(capability =>
      capability.id === 'workflows'
        ? { ...capability, currentSurface: 'context-orchestrate' }
        : capability
    );

    const result = await referenceSurfaceCompatibilityGate.run(plan);

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.errors.join('\n')).toContain(
        'missing archon-aco-adversarial-loop workflow surface'
      );
    }
  });

  test('fails when high-risk mutation drops approval', async () => {
    const plan = await loadReferencePlan();
    plan.commands[0] = { ...plan.commands[0], mutates: 'destructive', approvalRequired: 'no' };

    const result = await referenceSurfaceCompatibilityGate.run(plan);

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.errors.join('\n')).toContain('requires approval for destructive');
    }
  });

  test('fails when duplicate ids or evidence labels are malformed', async () => {
    const duplicate = await loadReferencePlan();
    duplicate.commands = [duplicate.commands[0], ...duplicate.commands];
    const duplicateResult = await referenceSurfaceCompatibilityGate.run(duplicate);
    expect(duplicateResult.status).toBe('failed');
    if (duplicateResult.status === 'failed') {
      expect(duplicateResult.errors.join('\n')).toContain('duplicate manifest id');
    }

    const missingEvidence = await loadReferencePlan();
    missingEvidence.generatedFrom = [];
    const evidenceResult = await referenceSurfaceCompatibilityGate.run(missingEvidence);
    expect(evidenceResult.status).toBe('failed');
    if (evidenceResult.status === 'failed') {
      expect(evidenceResult.errors.join('\n')).toContain('generatedFrom evidence labels');
    }
  });
});

describe('migration order fixture', () => {
  test('validates S2 manifest gate and S3 aco-ledgers ordering', async () => {
    const plan = await loadMigrationOrder();
    const parsed = validateMigrationOrderPlan(plan);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.issues.join('\n'));

    expect(parsed.value.phases.find(phase => phase.id === 'S2')?.ownerPackage).toBe(
      '@archon/aco-core'
    );
    expect(parsed.value.phases.find(phase => phase.id === 'S3')?.ownerPackage).toBe(
      '@archon/aco-ledgers'
    );
    expect(parsed.value.preservedSurfaces.map(surface => surface.surface)).toEqual(
      expect.arrayContaining([
        '/aco:bootstrap-codex',
        'archon aco status',
        'archon context ledgers',
        'context-orchestrate',
        'archon-aco-adversarial-loop',
      ])
    );
    expect(
      parsed.value.preservedSurfaces.find(surface => surface.surface === 'archon context ledgers')
        ?.migrationPhase
    ).toBe('S3');
  });

  test('rejects malformed migration ordering without S3', async () => {
    const plan = await loadMigrationOrder();
    const parsed = validateMigrationOrderPlan({
      ...plan,
      phases: plan.phases.filter(phase => phase.id !== 'S3'),
    });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.issues.join('\n')).toContain('migration order must include S3');
    }
  });
});

async function loadReferencePlan(): Promise<ReferenceSurfacePlan> {
  const fixture: unknown = await Bun.file(
    new URL('../../../tests/fixtures/aco/reference-surface-plan.json', import.meta.url)
  ).json();
  const parsed = parseReferenceSurfacePlan(fixture);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
  return structuredClone(parsed.value);
}

async function loadMigrationOrder(): Promise<unknown> {
  return Bun.file(
    new URL('../../../tests/fixtures/aco/migration-order.json', import.meta.url)
  ).json();
}
