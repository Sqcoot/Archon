import { describe, expect, test } from 'bun:test';
import {
  buildCodexFeatureConfigOverrides,
  buildCodexRuntimeConfigOverrides,
  mergeCodexConfigOverrides,
} from './config-overrides';

describe('Codex config overrides', () => {
  test('deep-merges MCP, feature, and agent override tables', () => {
    expect(
      mergeCodexConfigOverrides(
        {
          mcp_servers: {
            figma: { command: 'figma-mcp' },
          },
          agents: {
            max_threads: 2,
          },
        },
        {
          features: {
            multi_agent: true,
          },
          agents: {
            'brief-gen': { config_file: '/tmp/brief-gen.toml' },
          },
        }
      )
    ).toEqual({
      mcp_servers: {
        figma: { command: 'figma-mcp' },
      },
      features: {
        multi_agent: true,
      },
      agents: {
        max_threads: 2,
        'brief-gen': { config_file: '/tmp/brief-gen.toml' },
      },
    });
  });

  test('builds feature overrides without enabling experimental flags by default', () => {
    expect(buildCodexFeatureConfigOverrides({}, { forceMultiAgent: true })).toEqual({
      features: { multi_agent: true },
    });

    expect(
      buildCodexFeatureConfigOverrides({
        features: {
          multiAgentV2: true,
          enableFanout: true,
        },
      })
    ).toEqual({
      features: {
        multi_agent_v2: true,
        enable_fanout: true,
      },
    });
  });

  test('builds supported spawned-agent runtime limits', () => {
    expect(
      buildCodexRuntimeConfigOverrides({
        agents: {
          maxThreads: 3,
          maxDepth: 2,
          jobMaxRuntimeSeconds: 60,
          interruptMessage: false,
        },
        fanout: {
          enabled: true,
          maxConcurrency: 3,
        },
      })
    ).toEqual({
      agents: {
        max_threads: 3,
        max_depth: 2,
        job_max_runtime_seconds: 60,
        interrupt_message: false,
      },
    });
  });
});
