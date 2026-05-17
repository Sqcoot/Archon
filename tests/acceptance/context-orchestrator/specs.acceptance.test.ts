import { describe, expect, test } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';

const specDir = join(process.cwd(), 'docs/context-orchestrator/specs');
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
];

describe('ACO spec acceptance', () => {
  test('Spec: 016-acceptance-test-plan.md Acceptance: ACO-SPECS-001 required specs are sectioned', async () => {
    for (const spec of specs) {
      const content = await readFile(join(specDir, spec), 'utf8');
      for (const section of requiredSections) {
        expect(content).toContain(section);
      }
    }
  });
});
