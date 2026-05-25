import { describe, expect, test } from 'bun:test';
import { parseCodexConfig } from './config';

describe('parseCodexConfig', () => {
  test('parses stable and experimental Codex feature flags', () => {
    expect(
      parseCodexConfig({
        features: {
          multi_agent: true,
          multiAgentV2: true,
          enable_fanout: true,
        },
      }).features
    ).toEqual({
      multiAgent: true,
      multiAgentV2: true,
      enableFanout: true,
    });
  });

  test('parses agent and fanout runtime limits', () => {
    expect(
      parseCodexConfig({
        agents: {
          max_threads: 3,
          maxDepth: 2,
          job_max_runtime_seconds: 120,
          interrupt_message: false,
          strict: false,
        },
        fanout: {
          enabled: true,
          maxConcurrency: 2,
          strict: true,
        },
      })
    ).toMatchObject({
      agents: {
        maxThreads: 3,
        maxDepth: 2,
        jobMaxRuntimeSeconds: 120,
        interruptMessage: false,
        strict: false,
      },
      fanout: {
        enabled: true,
        maxConcurrency: 2,
        strict: true,
      },
    });
  });

  test('throws for invalid numeric runtime limits', () => {
    expect(() =>
      parseCodexConfig({
        agents: { max_threads: 0 },
      })
    ).toThrow('Invalid Codex agents.maxThreads');

    expect(() =>
      parseCodexConfig({
        fanout: { max_concurrency: 1.5 },
      })
    ).toThrow('Invalid Codex fanout.maxConcurrency');
  });
});
