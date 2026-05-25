import { describe, expect, test } from 'bun:test';
import {
  buildApprovalCapsule,
  buildContextStatus,
  compileContextPackage,
  defaultLedgerSummaries,
  renderApprovalCapsuleJson,
  renderApprovalCapsuleMarkdown,
  renderApprovalCapsuleVerificationJson,
  renderApprovalCapsuleVerificationMarkdown,
  renderCompiledContextPackageJson,
  renderCompiledContextPackageMarkdown,
  renderContextStatusJson,
  renderContextStatusMarkdown,
  serializeStableJson,
  verifyApprovalCapsule,
} from './index';
import {
  buildGraphArtifactMetadata,
  buildGraphWaiverClosure,
  graphEvidenceRef,
} from '@archon/aco-research';

const PROMPT = 'Implement S8 context contracts';

describe('ACO context contracts', () => {
  test('renders deterministic status, context package, capsule, and verification fixtures', async () => {
    const status = unwrap(buildContextStatus({ prompt: PROMPT }));
    const contextPackage = unwrap(compileContextPackage({ prompt: PROMPT }));
    const capsule = unwrap(buildApprovalCapsule({ contextPackage }));
    const verification = unwrap(
      verifyApprovalCapsule({ capsule, expectedContext: contextPackage, expectedPrompt: PROMPT })
    );

    expect(JSON.parse(renderContextStatusJson(status))).toEqual(
      await loadGoldenJson('status.expected.json')
    );
    expect(renderContextStatusMarkdown(status)).toBe(await loadGolden('status.expected.md'));
    expect(JSON.parse(renderCompiledContextPackageJson(contextPackage))).toEqual(
      await loadGoldenJson('context-package.expected.json')
    );
    expect(renderCompiledContextPackageMarkdown(contextPackage)).toBe(
      await loadGolden('context-package.expected.md')
    );
    expect(JSON.parse(renderApprovalCapsuleJson(capsule))).toEqual(
      await loadGoldenJson('approval-capsule.expected.json')
    );
    expect(renderApprovalCapsuleMarkdown(capsule)).toBe(
      await loadGolden('approval-capsule.expected.md')
    );
    expect(JSON.parse(renderApprovalCapsuleVerificationJson(verification))).toEqual(
      await loadGoldenJson('approval-capsule-verification-pass.expected.json')
    );
    expect(renderApprovalCapsuleVerificationMarkdown(verification)).toBe(
      await loadGolden('approval-capsule-verification-pass.expected.md')
    );
  });

  test('fails closed on missing prompt, malformed capsule, tampering, missing ledger, and stale graph evidence', async () => {
    expect(JSON.parse(serializeStableJson(compileContextPackage({ prompt: '' })))).toEqual(
      await loadGoldenJson('missing-prompt.expected.json')
    );

    const malformed = unwrap(verifyApprovalCapsule({ capsule: { kind: 'bad-capsule' } }));
    expect(JSON.parse(renderApprovalCapsuleVerificationJson(malformed))).toEqual(
      await loadGoldenJson('malformed-capsule.expected.json')
    );

    const contextPackage = unwrap(compileContextPackage({ prompt: PROMPT }));
    const capsule = unwrap(buildApprovalCapsule({ contextPackage }));
    const tampered = { ...capsule, checksum: '0'.repeat(64) };
    const tamperedVerification = unwrap(
      verifyApprovalCapsule({
        capsule: tampered,
        expectedContext: contextPackage,
        expectedPrompt: PROMPT,
      })
    );
    expect(JSON.parse(renderApprovalCapsuleVerificationJson(tamperedVerification))).toEqual(
      await loadGoldenJson('approval-capsule-verification-fail.expected.json')
    );

    const missingLedger = buildContextStatus({
      prompt: PROMPT,
      ledgerSummaries: defaultLedgerSummaries().filter(ledger => ledger.name !== 'command'),
    });
    expect(JSON.parse(serializeStableJson(missingLedger))).toEqual(
      await loadGoldenJson('missing-ledger.expected.json')
    );

    const graph = graphEvidenceRef('archon', 'complete');
    const staleClosure = unwrap(
      buildGraphWaiverClosure({
        required: true,
        graphRefs: [graph],
        artifacts: buildGraphArtifactMetadata([graph], 'stale'),
      })
    );
    const staleStatus = unwrap(buildContextStatus({ prompt: PROMPT, graphWaiver: staleClosure }));
    expect(JSON.parse(renderContextStatusJson(staleStatus))).toEqual(
      await loadGoldenJson('stale-graph-status.expected.json')
    );
  });

  test('fixture gate proves S8 context contract parity', async () => {
    const { acoContextFixtureGate } = await import('./index');
    const result = await acoContextFixtureGate.run(PROMPT);

    expect(acoContextFixtureGate.mutates).toBe('read-only');
    expect(result.status).toBe('passed');
    if (result.status !== 'passed') throw new Error('context fixture gate failed');
    expect(result.value.verification.status).toBe('passed');
    expect(result.value.approvalCapsule.approvalStatus).toBe('not-granted');
  });
});

async function loadGolden(fileName: string): Promise<string> {
  const root = new URL('../../../tests/fixtures/aco/context/', import.meta.url);
  return Bun.file(new URL(fileName, root)).text();
}

async function loadGoldenJson(fileName: string): Promise<unknown> {
  return JSON.parse(await loadGolden(fileName));
}

function unwrap<T>(
  result:
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly issues: readonly string[] }
): T {
  if (!result.ok) throw new Error(result.issues.join('; '));
  return result.value;
}
