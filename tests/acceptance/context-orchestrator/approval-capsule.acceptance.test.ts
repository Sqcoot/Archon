import { describe, expect, test } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('ACO approval capsule acceptance', () => {
  test('Spec: 024-approval-capsule-spec.md Acceptance: ACO-APPROVAL-001 schema validates required fields and version', async () => {
    const schemaSource = await readFile(
      join(process.cwd(), 'packages/context-orchestrator/src/schemas/approval-capsule.ts'),
      'utf8'
    );

    expect(schemaSource).toContain('approvalCapsuleSchema');
    expect(schemaSource).toContain('aco.approval-capsule.v1');
    expect(schemaSource).toContain('approvalCommands');
    expect(schemaSource).toContain('willRun');
  });

  test('Spec: 024-approval-capsule-spec.md Acceptance: ACO-APPROVAL-002 CLI renders read-only capsule output', async () => {
    const cliSource = await readFile(
      join(process.cwd(), 'packages/cli/src/commands/context.test.ts'),
      'utf8'
    );

    expect(cliSource).toContain('ACO-APPROVAL-002');
    expect(cliSource).toContain('contextApprovalCapsuleCommand');
    expect(cliSource).toContain('aco-cli-approval-readonly');
  });

  test('Spec: 024-approval-capsule-spec.md Acceptance: ACO-APPROVAL-003 artifact mode writes fixed capsule files', async () => {
    const builderSource = await readFile(
      join(process.cwd(), 'packages/context-orchestrator/src/approval-capsule.ts'),
      'utf8'
    );

    expect(builderSource).toContain('writeApprovalCapsuleArtifacts');
    expect(builderSource).toContain('approval-capsule.json');
    expect(builderSource).toContain('approval-capsule.md');
    expect(builderSource).toContain('ACO compiled package for runId');
  });

  test('Spec: 024-approval-capsule-spec.md Acceptance: ACO-APPROVAL-004 workflow emits capsule after graph gate', async () => {
    const workflowSource = await readFile(
      join(process.cwd(), '.archon/workflows/defaults/context-orchestrate.yaml'),
      'utf8'
    );

    expect(workflowSource).toContain('id: approval-capsule');
    expect(workflowSource).toContain('context approval-capsule');
    expect(workflowSource).toContain('depends_on: [graph-validation-gate]');
    expect(workflowSource).toContain('capsuleRequired');
    expect(workflowSource).toContain(
      'when: "$graph-validation-gate.output.capsuleRequired == \'true\'"'
    );
    expect(workflowSource).toContain('Approval capsule: not generated for this graph state.');
  });

  test('Spec: 024-approval-capsule-spec.md Acceptance: ACO-APPROVAL-005 workflow handoff preserves Needs approval and references capsule', async () => {
    const workflowSource = await readFile(
      join(process.cwd(), '.archon/workflows/defaults/context-orchestrate.yaml'),
      'utf8'
    );

    expect(workflowSource).toContain('approval-capsule.md');
    expect(workflowSource).toContain('Needs approval');
    expect(workflowSource).toContain('preserves listed waivers for this run only');
  });

  test('Spec: 024-approval-capsule-spec.md Acceptance: ACO-APPROVAL-006 traceability covers waivers, refs, inert commands, and non-forbidden negative case', async () => {
    const testSource = await readFile(
      join(process.cwd(), 'packages/context-orchestrator/src/approval-capsule.test.ts'),
      'utf8'
    );

    expect(testSource).toContain('graph-waiver.bmad-plugins-marketplace');
    expect(testSource).toContain('graph-waiver.bmad-sample-data');
    expect(testSource).toContain('willRun === false');
    expect(testSource).toContain('ledgerRefs.some');
    expect(testSource).toContain('non-forbidden');
  });
});
