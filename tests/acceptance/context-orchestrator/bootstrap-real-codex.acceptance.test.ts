import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  acoBootstrapEvents,
  buildAcoCodexHookManifestTemplate,
  buildAcoCodexHookTemplates,
  buildCapabilitySnapshot,
  runAcoCodexHook,
  runRealCodexHookSmoke,
} from '../../../packages/context-orchestrator/src/index';

const timestamp = '2026-05-24T12:00:00.000Z';

describe('ACO real Codex bootstrap and hook acceptance', () => {
  test('Spec: 025-aco-codex-real-bootstrap-cleanup-hooks.md Acceptance: ACO-CODEX-REAL-001 ACO-CODEX-REAL-002 ACO-CODEX-REAL-005 ACO-CODEX-REAL-009 real Codex clean-room smoke is explicit success or blocked evidence', async () => {
    const result = await runRealCodexHookSmoke({
      cwd: process.cwd(),
      enabled: process.env.RUN_REAL_CODEX === '1',
      timestamp,
      timeoutMs: 60_000,
    });

    expect(['passed', 'blocked']).toContain(result.status);
    expect(result.preflight.codexPath.status).not.toBe('unknown');
    expect(result.preflight.version.status).not.toBe('unknown');
    expect(result.preflight.execHelp.status).not.toBe('unknown');
    expect(result.preflight.featuresList.status).not.toBe('unknown');
    expect(result.preflight.loginStatus.status).not.toBe('unknown');
    expect(JSON.stringify(result)).not.toMatch(
      /(OPENAI_API_KEY|ANTHROPIC_API_KEY|sk-(proj|ant|live|test)-[A-Za-z0-9_-]{10,})/
    );
    expect(Object.keys(result.domainEvidence).sort()).toEqual(
      [
        'commands',
        'workflows',
        'artifacts',
        'tools',
        'adapters',
        'gates',
        'manifests',
        'mcp-tools',
        'context7-docs',
        'bmad',
        'subagents-roles',
        'research-agentic-search',
        'context-bootload',
        'hooks',
        'plugins',
        'ledgers',
        'graph-graphify',
        'providers-future',
      ].sort()
    );
    expect(result.domainEvidence['mcp-tools'].behaviorProof.join('\n')).toContain(
      'runtimeStateRead=false'
    );
    expect(result.domainEvidence['context7-docs'].behaviorProof.join('\n')).toContain(
      'openai-docs-mcp:Codex MCP configuration'
    );
    expect(result.domainEvidence.bmad.behaviorProof.join('\n')).toContain(
      'agent role=bmad-agent-dev'
    );
    expect(result.domainEvidence['subagents-roles'].behaviorProof.join('\n')).toContain(
      'SubagentStart emits roleScope'
    );
    expect(result.domainEvidence['research-agentic-search'].behaviorProof.join('\n')).toContain(
      'readOnly=true'
    );
    expect(result.graphifyProof.graphifyExecuted).toBe(false);
    expect(result.graphifyProof.deniedModes).toEqual(
      expect.arrayContaining(['live-working-copy', 'research:graph', 'refresh-graph'])
    );
    expect(result.hookDiscoveryProof.map(proof => proof.sourceLayer)).toEqual(
      expect.arrayContaining([
        'temp CODEX_HOME config.toml inline [hooks]',
        'temp CODEX_HOME config.toml disabled hooks',
        'temp repo .codex/hooks.json',
        'managed requirements.toml hooks',
        'requirements.toml disabled hooks',
        'plugin hooks/hooks.json',
        'plugin.json hooks entries',
      ])
    );

    if (process.env.RUN_REAL_CODEX === '1') {
      if (result.status === 'passed') {
        expect(result.eventsObserved).toEqual(
          expect.arrayContaining([
            'SessionStart',
            'UserPromptSubmit',
            'PreToolUse',
            'PermissionRequest',
            'PostToolUse',
            'Stop',
          ])
        );
        expect(result.cleanupRuns.every(run => run.status === 'passed')).toBe(true);
        expect(result.residueProof.every(proof => proof.remainingAcoOwnedPaths.length === 0)).toBe(
          true
        );
      } else {
        expect(result.blockers.join('\n')).toMatch(
          /temp CODEX_HOME|PermissionRequest real hook proof blocked|codex exec hook smoke failed/
        );
      }
    } else {
      expect(result.status).toBe('blocked');
      expect(result.blockers.join('\n')).toContain('RUN_REAL_CODEX=1');
    }
  }, 180_000);

  test('Spec: 025-aco-codex-real-bootstrap-cleanup-hooks.md Acceptance: ACO-CODEX-REAL-006 all ten ACO lifecycle events pass hook-runner simulation', async () => {
    const cwd = await writeRealFixture();

    for (const event of acoBootstrapEvents) {
      const result = await runAcoCodexHook({
        cwd,
        input: {
          session_id: 'session-fixture',
          turn_id: 'turn-fixture',
          cwd,
          hook_event_name: event,
          model: 'gpt-5',
          permission_mode: 'never',
          source: 'startup',
          prompt: 'Simulate ACO hook event.',
          tool_name: 'Bash',
          tool_input: { command: "printf 'ok\\n'" },
          tool_response: { output: 'ok\n', exit_code: 0 },
          tool_use_id: 'tool-fixture',
          stop_hook_active: false,
          last_assistant_message: 'done',
        },
        timestamp,
        runId: `hook-${event}`,
        maxBytes: 4_000,
      });

      expect(result.event).toBe(event);
      expect(result.output).toBeDefined();
      expect(JSON.stringify(result.output)).not.toMatch(/sk-[A-Za-z0-9_-]{10,}/);
      if (['PreCompact', 'PostCompact', 'SubagentStart', 'SubagentStop'].includes(event)) {
        expect(result.releaseSupport).toBe('simulated');
      } else {
        expect(result.releaseSupport).toBe('codex-0.128.0-command-hook');
      }
    }

    const templates = buildAcoCodexHookTemplates(
      'bun scripts/context-orchestrator/aco-codex-hook-runner.ts'
    );
    expect(templates.map(template => template.event).sort()).toEqual(
      [...acoBootstrapEvents].sort()
    );
    expect(
      templates
        .filter(template => template.support === 'simulated')
        .map(template => template.event)
        .sort()
    ).toEqual(['PostCompact', 'PreCompact', 'SubagentStart', 'SubagentStop']);
    const manifest = buildAcoCodexHookManifestTemplate({ command: 'aco-hook-runner' });
    expect(Object.keys(manifest.activeHooksJson.hooks).sort()).toEqual([
      'PermissionRequest',
      'PostToolUse',
      'PreToolUse',
      'SessionStart',
      'Stop',
      'UserPromptSubmit',
    ]);
    expect(manifest.inertTemplates).toHaveLength(10);
    expect(manifest.activeHooksJson.hooks.PreToolUse?.[0]?.matcher).toContain('apply_patch');
    expect(manifest.activeHooksJson.hooks.PermissionRequest?.[0]?.matcher).toContain('mcp__.*');
    expect(templates.find(template => template.event === 'SessionStart')?.matcher).toContain(
      'compact'
    );
    expect(templates.find(template => template.event === 'PreCompact')?.matcher).toBe(
      'manual|auto'
    );
    expect(templates.find(template => template.event === 'PostCompact')?.matcher).toBe(
      'manual|auto'
    );
    expect(templates.find(template => template.event === 'SubagentStart')?.matcher).toBe(
      'agent_type'
    );
    expect(templates.find(template => template.event === 'SubagentStop')?.matcher).toBe(
      'agent_type'
    );
    expect(templates.find(template => template.event === 'UserPromptSubmit')?.matcher).toBeNull();
    expect(templates.find(template => template.event === 'Stop')?.matcher).toBeNull();
  });

  test('Spec: 025-aco-codex-real-bootstrap-cleanup-hooks.md Acceptance: ACO-CODEX-REAL-007 and ACO-CODEX-REAL-008 capability domains are exhaustive and evidence-backed', async () => {
    const cwd = await writeRealFixture();
    const snapshot = await buildCapabilitySnapshot({
      cwd,
      prompt: 'Use MCP, Context7, BMAD, subagents, roles, hooks, graph, providers.',
      timestamp,
    });
    const expectedDomains = [
      'commands',
      'workflows',
      'artifacts',
      'tools',
      'adapters',
      'gates',
      'manifests',
      'mcp-tools',
      'context7-docs',
      'bmad',
      'subagents-roles',
      'research-agentic-search',
      'context-bootload',
      'hooks',
      'plugins',
      'ledgers',
      'graph-graphify',
      'providers-future',
    ];

    expect(snapshot.domains.map(domain => domain.id).sort()).toEqual(expectedDomains.sort());
    for (const domain of snapshot.domains) {
      expect(['available', 'unknown', 'blocked', 'deferred']).toContain(domain.status);
      expect(domain.evidence.length).toBeGreaterThan(0);
      expect(domain.summary).toBeTruthy();
    }
    expect(
      snapshot.domains.find(domain => domain.id === 'mcp-tools')?.evidence.join('\n')
    ).toContain('MCP');
    expect(
      snapshot.domains.find(domain => domain.id === 'context7-docs')?.evidence.join('\n')
    ).toContain('Context7');
    expect(snapshot.domains.find(domain => domain.id === 'bmad')?.evidence.join('\n')).toContain(
      'BMAD'
    );
  });
});

async function writeRealFixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'aco-real-fixture-'));
  await mkdir(join(cwd, '.archon/commands/defaults'), { recursive: true });
  await mkdir(join(cwd, '.archon/workflows/defaults'), { recursive: true });
  await mkdir(join(cwd, '.archon/capabilities'), { recursive: true });
  await mkdir(join(cwd, '.archon/artifacts/context-orchestrator/fixture'), { recursive: true });
  await mkdir(join(cwd, 'docs/context-orchestrator/research'), { recursive: true });
  await mkdir(join(cwd, 'packages/providers/src/future'), { recursive: true });
  await mkdir(join(cwd, 'packages/providers/src/mcp'), { recursive: true });
  await mkdir(join(cwd, '_bmad/_config'), { recursive: true });

  await writeFile(join(cwd, 'package.json'), '{"scripts":{"aco:test:acceptance":"bun test"}}\n');
  await writeFile(join(cwd, '.archon/commands/defaults/aco-bootstrap-codex.md'), '# Bootstrap\n');
  await writeFile(
    join(cwd, '.archon/workflows/defaults/context-orchestrate.yaml'),
    'name: context-orchestrate\n'
  );
  await writeFile(
    join(cwd, '.archon/artifacts/context-orchestrator/fixture/commands-ledger.json'),
    '{"schemaVersion":"aco.ledger-bundle.v1"}\n'
  );
  await writeFile(
    join(cwd, '.archon/capabilities/fixture.json'),
    `${JSON.stringify({
      providers: [{ id: 'provider.future-fixture', label: 'Future Fixture' }],
      plugins: [{ id: 'plugin.fixture', label: 'Plugin Fixture' }],
      mcpServers: [{ id: 'mcp.fixture', label: 'MCP Fixture' }],
      artifacts: [{ id: 'artifact.fixture', label: 'Artifact Fixture' }],
      commands: [{ id: 'cmd.fixture', label: 'Command Fixture' }],
      workflows: [{ id: 'workflow.fixture', label: 'Workflow Fixture' }],
      ledgers: [{ id: 'ledger.fixture', label: 'Ledger Fixture' }],
    })}\n`
  );
  await writeFile(
    join(cwd, 'docs/context-orchestrator/research/upstream-manifest.json'),
    '{"repositories":[{"name":"fixture","graphStatus":"complete","nodes":1,"edges":0}]}\n'
  );
  await writeFile(
    join(cwd, 'packages/providers/src/future/capabilities.ts'),
    'export const capabilities = {};\n'
  );
  await writeFile(join(cwd, 'packages/providers/src/mcp/config.ts'), 'export const mcp = {};\n');
  await writeFile(
    join(cwd, '_bmad/_config/skill-manifest.csv'),
    'canonicalId,name,description,module,path\n"bmad-agent-dev","bmad-agent-dev","Developer role","bmm","_bmad/dev/SKILL.md"\n'
  );

  return cwd;
}
