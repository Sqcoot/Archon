import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { validateContextOrchestrator } from '@archon/context-orchestrator';

const specDir = join(process.cwd(), 'docs/context-orchestrator/specs');
const traceabilityManifestPath = join(specDir, 'traceability', 'aco-traceability.json');
const requiredSections = [
  '## Purpose',
  '## Scope',
  '## Non-Goals',
  '## Generic Behavior',
  '## Archon-Specific Behavior',
  '## Inputs',
  '## Outputs',
  '## Known Unknowns',
  '## Evidence References',
  '## Acceptance Scenarios',
  '## Failure Behavior',
  '## Security Constraints',
  '## Open Questions',
];

const specs = [
  '000-product-charter.md',
  '001-domain-glossary.md',
  '002-capability-model.md',
  '003-evidence-model.md',
  '004-graph-context-spec.md',
  '005-documentation-resolution-spec.md',
  '006-bmad-routing-spec.md',
  '007-caveman-policy-spec.md',
  '008-prompt-package-spec.md',
  '009-archive-artifact-spec.md',
  '010-codex-readiness-spec.md',
  '011-command-contract.md',
  '012-cli-contract.md',
  '014-workflow-contracts.md',
  '015-security-threat-model.md',
  '016-acceptance-test-plan.md',
  '017-implementation-discovery-protocol.md',
  '018-release-readiness-spec.md',
  '019-observability-and-events-spec.md',
  '020-package-scripts-and-research-corpus-spec.md',
  '021-opa-prompt-package-policy-spec.md',
  '022-sdd-atdd-traceability-gate-spec.md',
  '023-decision-dossier-gate-spec.md',
  '024-approval-capsule-spec.md',
];

interface TraceabilityManifest {
  requirements: Array<{
    evidence: Array<{
      markers: string[];
    }>;
  }>;
}

describe('ACO spec acceptance', () => {
  test('Spec: 016-acceptance-test-plan.md Acceptance: ACO-SPECS-001 required specs are sectioned', async () => {
    for (const spec of specs) {
      const content = await readFile(join(specDir, spec), 'utf8');
      for (const section of requiredSections) {
        expect(content).toContain(section);
      }
    }
  });

  test('Spec: 022-sdd-atdd-traceability-gate-spec.md Acceptance: ACO-TRACE-001 manifest links ACO-POLICY-001 ACO-POLICY-002 ACO-POLICY-003 ACO-POLICY-DECISION-001 ACO-POLICY-DECISION-002 ACO-POLICY-DECISION-003', async () => {
    const report = await runTraceability(['--json']);
    expect(report.status).toBe('passed');
    expect(report.errors).toHaveLength(0);
  });

  test('Spec: 022-sdd-atdd-traceability-gate-spec.md Acceptance: ACO-TRACE-002 temp manifest missing marker fails without mutating committed manifest', async () => {
    const manifest = JSON.parse(
      await readFile(traceabilityManifestPath, 'utf8')
    ) as TraceabilityManifest;
    manifest.requirements[0].evidence[0].markers = ['__missing_trace_marker__'];
    const tempDir = await mkdtemp(join(tmpdir(), 'aco-traceability-'));
    const tempManifestPath = join(tempDir, 'aco-traceability.json');
    await writeFile(tempManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    const report = await runTraceability(['--json', '--manifest', tempManifestPath], 1);
    expect(report.status).toBe('failed');
    expect(
      report.errors.some(
        error =>
          error.requirement_id === 'ACO-POLICY-001' && error.marker === '__missing_trace_marker__'
      )
    ).toBe(true);
  });

  test('Spec: 022-sdd-atdd-traceability-gate-spec.md Acceptance: ACO-TRACE-003 aggregate validation reports traceability check', async () => {
    const report = await validateContextOrchestrator({ cwd: process.cwd() });
    const traceabilityCheck = report.checks.find(check => check.id === 'aco-traceability');
    const acceptanceCheck = report.checks.find(check => check.id === 'aco-acceptance');
    expect(traceabilityCheck?.status).toBe('passed');
    expect(acceptanceCheck?.status).toBe('passed');
  });

  test('Spec: 008-prompt-package-spec.md Acceptance: AC-LEDGER-001 AC-LEDGER-002 AC-LEDGER-003 AC-LEDGER-005 AC-LEDGER-006 AC-LEDGER-007 AC-LEDGER-008 AC-CONFIDENCE-001 AC-CONFIDENCE-002 AC-CONFIDENCE-003 AC-CONFIDENCE-004 AC-CONFIDENCE-005 AC-CONFIDENCE-006 AC-ACO-STATUS-001 AC-ACO-STATUS-002 AC-ACO-STATUS-003 AC-ACO-STATUS-004 AC-ACO-STATUS-005 AC-ACO-STATUS-006 AC-ACO-STATUS-007 AC-P1-SLASH AC-P1-CLI AC-P1-API AC-P1-WEB AC-P3-WF AC-P3-PR AC-P2-DEMO AC-NONREG AC-FORBIDDEN-GRAPH-001 ACO-CODEX-003 ACO-EVENTS-001 ledger confidence requirements are traceable', async () => {
    const matrix = await readFile(
      join(process.cwd(), 'docs/context-orchestrator/specs/spec-traceability-matrix.md'),
      'utf8'
    );
    for (const marker of [
      'AC-LEDGER-001',
      'AC-LEDGER-002',
      'AC-LEDGER-003',
      'AC-LEDGER-005',
      'AC-LEDGER-006',
      'AC-LEDGER-007',
      'AC-LEDGER-008',
      'AC-CONFIDENCE-001',
      'AC-CONFIDENCE-002',
      'AC-CONFIDENCE-003',
      'AC-CONFIDENCE-004',
      'AC-CONFIDENCE-005',
      'AC-CONFIDENCE-006',
      'AC-ACO-STATUS-001',
      'AC-ACO-STATUS-002',
      'AC-ACO-STATUS-003',
      'AC-ACO-STATUS-004',
      'AC-ACO-STATUS-005',
      'AC-ACO-STATUS-006',
      'AC-ACO-STATUS-007',
      'AC-P1-SLASH',
      'AC-P1-CLI',
      'AC-P1-API',
      'AC-P1-WEB',
      'AC-P3-WF',
      'AC-P3-PR',
      'AC-P2-DEMO',
      'AC-NONREG',
      'AC-FORBIDDEN-GRAPH-001',
      'AC-GWCL-001',
      'AC-GWCL-002',
      'AC-GWCL-003',
      'AC-GWCL-004',
      'AC-GWCL-005',
      'AC-GWCL-006',
      'ACO-CODEX-003',
      'ACO-EVENTS-001',
      'AC-DOSSIER-001',
      'AC-DOSSIER-002',
      'AC-DOSSIER-003',
      'AC-DOSSIER-004',
      'AC-DOSSIER-005',
      'AC-DOSSIER-006',
      'AC-DOSSIER-007',
      'ACO-APPROVAL-001',
      'ACO-APPROVAL-002',
      'ACO-APPROVAL-003',
      'ACO-APPROVAL-004',
      'ACO-APPROVAL-005',
      'ACO-APPROVAL-006',
    ]) {
      expect(matrix).toContain(marker);
    }
  });
});

async function runTraceability(
  args: string[],
  expectedExitCode = 0
): Promise<{
  status: 'passed' | 'failed';
  errors: Array<{ requirement_id?: string; marker?: string }>;
}> {
  const proc = Bun.spawn(
    [process.execPath, 'scripts/context-orchestrator/validate-traceability.ts', ...args],
    {
      cwd: process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    }
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  expect(stderr).toBe('');
  expect(exitCode).toBe(expectedExitCode);
  return JSON.parse(stdout) as {
    status: 'passed' | 'failed';
    errors: Array<{ requirement_id?: string; marker?: string }>;
  };
}
