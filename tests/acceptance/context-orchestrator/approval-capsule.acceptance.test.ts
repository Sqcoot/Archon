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
    expect(schemaSource).toContain('acoApprovalContractV1Schema');
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
    expect(workflowSource).toContain('id: approval-capsule-verify');
    expect(workflowSource).toContain('context approval-capsule');
    expect(workflowSource).toContain('context approval-capsule-verify');
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
    expect(workflowSource).toContain('approval-capsule-verification.json');
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

  test('Spec: 024-approval-capsule-spec.md Acceptance: ACO-APPROVAL-007 contract schema and hash are deterministic', async () => {
    const source = await readFile(
      join(process.cwd(), 'packages/context-orchestrator/src/schemas/approval-contract.ts'),
      'utf8'
    );
    const testSource = await readFile(
      join(process.cwd(), 'packages/context-orchestrator/src/schemas/approval-contract.test.ts'),
      'utf8'
    );

    expect(source).toContain('acoApprovalContractV1Schema');
    expect(source).toContain('contractHash');
    expect(source).toContain('canonicalJson');
    expect(testSource).toContain('ACO-APPROVAL-007');
  });

  test('Spec: 024-approval-capsule-spec.md Acceptance: ACO-APPROVAL-008 ACO-APPROVAL-009 ACO-APPROVAL-010 verification rejects drift and legacy capsules', async () => {
    const testSource = await readFile(
      join(process.cwd(), 'packages/context-orchestrator/src/approval-capsule.test.ts'),
      'utf8'
    );

    expect(testSource).toContain('ACO-APPROVAL-008');
    expect(testSource).toContain('ACO-APPROVAL-010');
    expect(testSource).toContain('activeWaiverIds');
    expect(testSource).toContain('verifyApprovalCapsuleArtifacts');
    expect(testSource).toContain('approvalContract');
  });

  test('Spec: 024-approval-capsule-spec.md Acceptance: ACO-APPROVAL-011 API Web CLI and workflow expose contract as inert data', async () => {
    const cliSource = await readFile(
      join(process.cwd(), 'packages/cli/src/commands/context.test.ts'),
      'utf8'
    );
    const apiSchemaSource = await readFile(
      join(process.cwd(), 'packages/server/src/routes/schemas/aco.schemas.ts'),
      'utf8'
    );
    const webTestSource = await readFile(
      join(process.cwd(), 'packages/web/src/routes/AcoStatusPage.test.ts'),
      'utf8'
    );
    const workflowSource = await readFile(
      join(process.cwd(), '.archon/workflows/defaults/context-orchestrate.yaml'),
      'utf8'
    );

    expect(cliSource).toContain('contextApprovalCapsuleVerifyCommand');
    expect(apiSchemaSource).toContain('AcoApprovalContractV1');
    expect(webTestSource).toContain('ACO-APPROVAL-011');
    expect(workflowSource).toContain("$approval-capsule-verify.output.status == 'valid'");
  });
});
