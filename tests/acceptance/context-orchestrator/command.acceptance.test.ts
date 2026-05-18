import { describe, expect, test } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('ACO slash command acceptance', () => {
  test('Spec: 012-cli-contract.md Acceptance: AC-P1-SLASH slash command surface is executable', async () => {
    const [handlerSource, handlerTests] = await Promise.all([
      readFile(join(process.cwd(), 'packages/core/src/handlers/command-handler.ts'), 'utf8'),
      readFile(join(process.cwd(), 'packages/core/src/handlers/command-handler.test.ts'), 'utf8'),
    ]);

    for (const command of [
      '/context status',
      '/context route <request>',
      '/context ledgers',
      '/context compile <request>',
      '/context run <request>',
    ]) {
      expect(handlerSource).toContain(command);
    }

    expect(handlerSource).toContain('handleContextCommand');
    expect(handlerSource).toContain('context-orchestrate');
    expect(handlerSource).toContain("return handleWorkflowCommand(conversation, ['run'");

    for (const evidence of [
      'AC-P1-SLASH shows Context Orchestrator status',
      'AC-P1-SLASH routes a request',
      'AC-P1-SLASH returns ledger coverage',
      'AC-P1-SLASH compiles a context package',
      'AC-P1-SLASH runs bundled context-orchestrate workflow',
      'AC-P1-SLASH rejects missing project context',
    ]) {
      expect(handlerTests).toContain(evidence);
    }
  });
});
