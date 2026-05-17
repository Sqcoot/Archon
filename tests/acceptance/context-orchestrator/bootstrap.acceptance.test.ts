import { describe, expect, test } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('ACO bootstrap acceptance', () => {
  test('Spec: 020-package-scripts-and-research-corpus-spec.md Acceptance: ACO-BOOTSTRAP-001 manifest covers every required repo', async () => {
    const manifestPath = join(
      process.cwd(),
      'docs/context-orchestrator/research/upstream-manifest.json'
    );
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      repositories: Array<Record<string, unknown>>;
    };
    expect(manifest.repositories).toHaveLength(13);
    for (const entry of manifest.repositories) {
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.url).toBe('string');
      expect(typeof entry.localPath).toBe('string');
      expect(typeof entry.role).toBe('string');
      expect(typeof entry.cloneStatus).toBe('string');
      expect(typeof entry.waiverRequired).toBe('boolean');
    }
  });

  test('Spec: 020-package-scripts-and-research-corpus-spec.md Acceptance: ACO-BOOTSTRAP-002 package scripts exist', async () => {
    const pkg = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['research:bootstrap']).toBe('bun scripts/research/bootstrap-upstreams.ts');
    expect(pkg.scripts['research:update-upstreams']).toBe(
      'bun scripts/research/bootstrap-upstreams.ts --fetch-only'
    );
    expect(pkg.scripts['research:graph']).toBe('bun scripts/research/graph-upstreams.ts');
    expect(pkg.scripts['research:merge-graphs']).toBe('bun scripts/research/merge-graphs.ts');
    expect(pkg.scripts['research:validate-corpus']).toBe(
      'bun scripts/research/validate-research-corpus.ts'
    );
  });
});
