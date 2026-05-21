import { describe, expect, test } from 'bun:test';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { parseWorkflow } from '../../../packages/workflows/src/loader';

const root = process.cwd();
const workflowPath = join(root, '.archon/workflows/defaults/archon-ai-layer-bootstrap.yaml');
const commandDir = join(root, '.archon/commands/defaults');
const commandNames = [
  'ai-layer-branch-gate',
  'ai-layer-goal',
  'ai-layer-preflight',
  'ai-layer-sdd-atdd-audit',
  'ai-layer-audit',
  'ai-layer-study-reference',
  'ai-layer-study-helpline-lsp',
  'ai-layer-map-codebase',
  'ai-layer-design-lsp-navigation',
  'ai-layer-design',
  'ai-layer-implement',
  'ai-layer-validate',
  'ai-layer-validate-lsp-navigation',
  'ai-layer-review',
  'ai-layer-completion-audit',
  'ai-layer-endgoal-gate',
  'ai-layer-stop-gate',
];

describe('AI Layer Bootstrap acceptance', () => {
  test('Spec: 030-ai-layer-bootstrap-spec.md Acceptance: AI-LAYER-001 workflow is artifact-first and gated', async () => {
    const workflow = await readFile(workflowPath, 'utf8');
    const parsed = parseWorkflow(workflow, 'archon-ai-layer-bootstrap.yaml');
    expect(parsed.error).toBeNull();
    expect(parsed.workflow?.name).toBe('archon-ai-layer-bootstrap');

    const nodes = parsed.workflow?.nodes ?? [];
    expect(nodes.map(node => node.id)).toEqual([
      'branch-gate',
      'define-goal',
      'preflight',
      'sdd-atdd-audit',
      'audit-ai-layer',
      'study-reference',
      'study-helpline-lsp',
      'map-codebase',
      'design-lsp-navigation',
      'design-ai-layer',
      'apply-or-propose',
      'validate-ai-layer',
      'validate-lsp-navigation',
      'review-ai-layer',
      'completion-audit',
      'endgoal-gate',
      'stop-gate',
    ]);
    expect(workflow).toContain('$ARTIFACTS_DIR/ai-layer');
    expect(workflow).toContain('ai-layer-completion-audit');
    expect(workflow).toContain('ai-layer-endgoal-gate');
    expect(workflow).toContain('ai-layer-stop-gate');
  });

  test('Spec: 030-ai-layer-bootstrap-spec.md Acceptance: AI-LAYER-002 commands have goal checks and artifact handoff', async () => {
    for (const name of commandNames) {
      const content = await readFile(join(commandDir, `${name}.md`), 'utf8');
      expect(content).toContain('Goal Check');
      expect(content).toContain('$ARTIFACTS_DIR/ai-layer');
      expect(content).toContain('status');
      expect(content).toContain('artifacts written');
      expect(content).toContain('next recommended node');
    }
  });

  test('Spec: 030-ai-layer-bootstrap-spec.md Acceptance: AI-LAYER-003 instructions are layered and symbol-first', async () => {
    const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
    const claude = await readFile(join(root, 'CLAUDE.md'), 'utf8');
    const map = await readFile(join(root, 'CODEBASE_MAP.md'), 'utf8');
    const packageDirs = await readdir(join(root, 'packages'));

    expect(agents.length).toBeLessThan(16000);
    expect(claude.length).toBeLessThan(8000);
    expect(agents).toContain('Prefer symbol/type navigation');
    expect(claude).toContain('Prefer symbol/type navigation');
    expect(map).toContain('TypeScript Navigation');

    for (const dir of packageDirs) {
      const packagePath = join(root, 'packages', dir);
      if (!(await stat(packagePath)).isDirectory()) continue;
      try {
        await stat(join(packagePath, 'package.json'));
      } catch {
        continue;
      }
      await readFile(join(packagePath, 'AGENTS.md'), 'utf8');
      await readFile(join(packagePath, 'CLAUDE.md'), 'utf8');
    }
  });

  test('Spec: 030-ai-layer-bootstrap-spec.md Acceptance: AI-LAYER-004 committed skills and explorers support Claude and Codex', async () => {
    const claudeSkill = await readFile(join(root, '.claude/skills/scoped-tests/SKILL.md'), 'utf8');
    const claudeExplorer = await readFile(
      join(root, '.claude/agents/ai-layer-explorer.md'),
      'utf8'
    );
    const codexExplorer = await readFile(
      join(root, '.codex/agents/ai-layer-explorer.toml'),
      'utf8'
    );

    expect(claudeSkill).toContain('name: scoped-tests');
    expect(claudeSkill).toContain('description:');
    expect(claudeExplorer).toContain('tools: Read, Grep, Glob');
    expect(codexExplorer).toContain('name = "ai-layer-explorer"');
    expect(codexExplorer).toContain('developer_instructions =');
  });

  test('Spec: 030-ai-layer-bootstrap-spec.md Acceptance: AI-LAYER-005 TypeScript navigation is validated without pyright', async () => {
    const script = await readFile(join(root, 'scripts/validate-ts-navigation.ts'), 'utf8');
    const packageJson = await readFile(join(root, 'package.json'), 'utf8');

    expect(script).toContain('createLanguageService');
    expect(script).toContain('getDefinitionAtPosition');
    expect(script).toContain('findReferences');
    expect(script).not.toContain('pyright-langserver');
    expect(packageJson).not.toContain('"pyright"');
    expect(packageJson).toContain('"validate:ts-navigation"');
  });

  test('Spec: 030-ai-layer-bootstrap-spec.md Acceptance: AI-LAYER-006 risky hook and MCP config remains proposed or deferred', async () => {
    const workflow = await readFile(workflowPath, 'utf8');
    expect(workflow).toContain('proposed');
    expect(workflow).toContain('mcp');
    expect(workflow).not.toContain('.codex/config.toml');
    expect(workflow).not.toContain('.claude/settings.json');
  });
});
