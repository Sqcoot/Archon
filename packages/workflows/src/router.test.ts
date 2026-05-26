import { describe, it, expect } from 'bun:test';
import {
  buildRouterPrompt,
  parseWorkflowInvocation,
  findWorkflow,
  resolveWorkflowName,
} from './router';
import type { WorkflowDefinition } from './schemas';
import type { RouterContext } from './router';

describe('Workflow Router', () => {
  // Sample workflows for testing
  const testWorkflows: WorkflowDefinition[] = [
    {
      name: 'fix-bug',
      description: 'Fix a bug in the codebase',
      nodes: [
        { id: 'analyze', command: 'analyze' },
        { id: 'fix', command: 'fix', depends_on: ['analyze'] },
      ],
    },
    {
      name: 'add-feature',
      description: 'Add a new feature',
      nodes: [
        { id: 'plan', command: 'plan' },
        { id: 'implement', command: 'implement', depends_on: ['plan'] },
      ],
    },
    {
      name: 'feature-development',
      description: 'Full feature development workflow',
      nodes: [
        { id: 'plan', command: 'plan' },
        { id: 'implement', command: 'implement', depends_on: ['plan'] },
        { id: 'create-pr', command: 'create-pr', depends_on: ['implement'] },
      ],
    },
  ];

  describe('buildRouterPrompt', () => {
    it('should return plain message when no workflows provided', () => {
      const result = buildRouterPrompt('Help me fix this bug', []);

      expect(result).toBe('Help me fix this bug');
    });

    it('should include workflow list when workflows are provided', () => {
      const result = buildRouterPrompt('Help me fix this bug', testWorkflows);

      expect(result).toContain('# Workflow Router');
      expect(result).toContain('Your job is to pick the best workflow');
      expect(result).toContain('## Available Workflows');
      expect(result).toContain('**fix-bug**');
      expect(result).toContain('Fix a bug in the codebase');
      expect(result).toContain('**add-feature**');
      expect(result).toContain('Add a new feature');
      expect(result).toContain('Help me fix this bug');
      expect(result).toContain('/invoke-workflow');
      expect(result).toContain('You MUST pick a workflow');
    });

    it('should include user message in request section', () => {
      const result = buildRouterPrompt('I want to add authentication', testWorkflows);

      expect(result).toContain('## User Request');
      expect(result).toContain('"I want to add authentication"');
    });

    it('should handle single workflow', () => {
      const singleWorkflow = [testWorkflows[0]];
      const result = buildRouterPrompt('Do something', singleWorkflow);

      expect(result).toContain('**fix-bug**');
      expect(result).toContain('Fix a bug in the codebase');
      expect(result.match(/\*\*fix-bug\*\*/g)).toHaveLength(1);
    });

    it('should handle empty user message', () => {
      const result = buildRouterPrompt('', testWorkflows);

      expect(result).toContain('## User Request');
      expect(result).toContain('""');
    });

    it('should handle user message with special characters', () => {
      const result = buildRouterPrompt('Fix the "bug" in `code` with $variables', testWorkflows);

      expect(result).toContain('Fix the "bug" in `code` with $variables');
    });

    it('should include tool-avoidance instruction', () => {
      const result = buildRouterPrompt('Help me fix this bug', testWorkflows);

      expect(result).toContain('Do NOT use any tools');
    });

    it('should format multi-line descriptions correctly', () => {
      const multiLineWorkflows: WorkflowDefinition[] = [
        {
          name: 'assist',
          description: `Use when: No other workflow matches.
Handles: Questions, debugging, exploration.
Capability: Full Claude Code agent.`,
          nodes: [{ id: 'assist', command: 'assist' }],
        },
      ];

      const result = buildRouterPrompt('What is this codebase?', multiLineWorkflows);

      expect(result).toContain('**assist**');
      expect(result).toContain('Use when: No other workflow matches.');
      expect(result).toContain('Handles: Questions, debugging, exploration.');
      expect(result).toContain('Capability: Full Claude Code agent.');
    });
  });

  describe('parseWorkflowInvocation', () => {
    it('should detect /invoke-workflow pattern at start', () => {
      const response = `/invoke-workflow feature-development
The user wants to add a new authentication system.`;

      const result = parseWorkflowInvocation(response, testWorkflows);

      expect(result.workflowName).toBe('feature-development');
      expect(result.remainingMessage).toContain('authentication system');
    });

    it('should return null workflow when no /invoke-workflow pattern', () => {
      const response = `I can help you with that. Let me explain how to add authentication.`;

      const result = parseWorkflowInvocation(response, testWorkflows);

      expect(result.workflowName).toBeNull();
      expect(result.remainingMessage).toBe(response);
    });

    it('should return null workflow with error when workflow name not found', () => {
      const response = `/invoke-workflow non-existent-workflow
Some intent here.`;

      const result = parseWorkflowInvocation(response, testWorkflows);

      expect(result.workflowName).toBeNull();
      expect(result.remainingMessage).toBe(response);
      expect(result.error).toContain('non-existent-workflow');
      expect(result.error).toContain('Available');
    });

    it('should extract remainingMessage from text after /invoke-workflow', () => {
      const response = `/invoke-workflow fix-bug
The user wants to fix issue X.
They mentioned it should work with Y.`;

      const result = parseWorkflowInvocation(response, testWorkflows);

      expect(result.workflowName).toBe('fix-bug');
      expect(result.remainingMessage).toContain('fix issue X');
      expect(result.remainingMessage).toContain('work with Y');
    });

    it('should handle /invoke-workflow with extra whitespace', () => {
      const response = `/invoke-workflow   fix-bug
Intent text here.`;

      const result = parseWorkflowInvocation(response, testWorkflows);

      expect(result.workflowName).toBe('fix-bug');
    });

    it('should handle /invoke-workflow with no text after', () => {
      const response = `/invoke-workflow add-feature`;

      const result = parseWorkflowInvocation(response, testWorkflows);

      expect(result.workflowName).toBe('add-feature');
      expect(result.remainingMessage).toBe('');
    });

    it('should be case-insensitive for command pattern', () => {
      const response = `/INVOKE-WORKFLOW fix-bug
Some text`;

      const result = parseWorkflowInvocation(response, testWorkflows);

      expect(result.workflowName).toBe('fix-bug');
    });

    it('should match /invoke-workflow at start of any line (multiline mode)', () => {
      // AI models sometimes add analysis before the command, so we use multiline mode
      // to match /invoke-workflow at the start of any line, not just the start of the message
      const response = `Some text before
/invoke-workflow fix-bug
Some text after`;

      const result = parseWorkflowInvocation(response, testWorkflows);

      expect(result.workflowName).toBe('fix-bug');
      expect(result.remainingMessage).toBe('Some text after');
    });

    it('should handle workflow name with hyphens', () => {
      const response = `/invoke-workflow feature-development
Intent here`;

      const result = parseWorkflowInvocation(response, testWorkflows);

      expect(result.workflowName).toBe('feature-development');
    });

    it('should handle empty response', () => {
      const result = parseWorkflowInvocation('', testWorkflows);

      expect(result.workflowName).toBeNull();
      expect(result.remainingMessage).toBe('');
    });

    it('should handle response with only whitespace', () => {
      const result = parseWorkflowInvocation('   \n\t  \n   ', testWorkflows);

      expect(result.workflowName).toBeNull();
    });

    it('should handle /invoke-workflow: without name', () => {
      const response = `/invoke-workflow
No name provided`;

      const result = parseWorkflowInvocation(response, testWorkflows);

      // Pattern requires a name after the command
      expect(result.workflowName).toBeNull();
    });

    it('should preserve full intent text including code blocks', () => {
      const response = `/invoke-workflow fix-bug
User wants to fix this code:
\`\`\`javascript
function broken() {
  return null;
}
\`\`\``;

      const result = parseWorkflowInvocation(response, testWorkflows);

      expect(result.workflowName).toBe('fix-bug');
      expect(result.remainingMessage).toContain('```javascript');
      expect(result.remainingMessage).toContain('function broken()');
    });

    it('rejects human-in-loop workflow invocations for autonomous original requests', () => {
      const workflows: WorkflowDefinition[] = [
        {
          name: 'safe-autonomous',
          description: 'Use when autonomous artifact-only execution is needed',
          mode: 'autonomous',
          lock_scope: 'artifact_only',
          nodes: [{ id: 'work', command: 'work' }],
        },
        {
          name: 'guided-approval',
          description: 'Use when a human approval gate is needed',
          mode: 'guided',
          nodes: [
            {
              id: 'approve',
              approval: {
                message: 'Approve?',
              },
            },
          ],
        },
      ];

      const result = parseWorkflowInvocation('/invoke-workflow guided-approval', workflows, {
        userMessage: 'continue autonomously without asking and produce the dossier',
      });

      expect(result.workflowName).toBeNull();
      expect(result.error).toContain('Autonomous request cannot invoke');
      expect(result.error).toContain('guided-approval');
    });
  });

  describe('findWorkflow', () => {
    it('should return workflow by name', () => {
      const workflow = findWorkflow('fix-bug', testWorkflows);

      expect(workflow).toBeDefined();
      expect(workflow?.name).toBe('fix-bug');
      expect(workflow?.description).toBe('Fix a bug in the codebase');
    });

    it('should return undefined for non-existent workflow', () => {
      const workflow = findWorkflow('does-not-exist', testWorkflows);

      expect(workflow).toBeUndefined();
    });

    it('should return undefined when workflows array is empty', () => {
      const workflow = findWorkflow('fix-bug', []);

      expect(workflow).toBeUndefined();
    });

    it('should be case-sensitive for workflow names', () => {
      const workflow = findWorkflow('Fix-Bug', testWorkflows);

      // Workflow names are case-sensitive
      expect(workflow).toBeUndefined();
    });
  });

  describe('resolveWorkflowName', () => {
    it('should return exact match', () => {
      const result = resolveWorkflowName('fix-bug', testWorkflows);
      expect(result?.name).toBe('fix-bug');
    });

    it('should return case-insensitive match', () => {
      const result = resolveWorkflowName('Fix-Bug', testWorkflows);
      expect(result?.name).toBe('fix-bug');
    });

    it('should return suffix match', () => {
      const workflows: WorkflowDefinition[] = [
        { name: 'archon-assist', description: 'General assistant', nodes: [] },
      ];
      const result = resolveWorkflowName('assist', workflows);
      expect(result?.name).toBe('archon-assist');
    });

    it('should return substring match', () => {
      const workflows: WorkflowDefinition[] = [
        { name: 'archon-smart-pr-review', description: 'Smart PR review', nodes: [] },
      ];
      const result = resolveWorkflowName('smart', workflows);
      expect(result?.name).toBe('archon-smart-pr-review');
    });

    it('should return undefined for no match', () => {
      const result = resolveWorkflowName('nonexistent', testWorkflows);
      expect(result).toBeUndefined();
    });

    it('should throw on ambiguous suffix match', () => {
      const workflows: WorkflowDefinition[] = [
        { name: 'archon-review', description: 'Review', nodes: [] },
        { name: 'custom-review', description: 'Custom review', nodes: [] },
      ];
      expect(() => resolveWorkflowName('review', workflows)).toThrow('Ambiguous workflow');
    });

    it('should throw on ambiguous substring match', () => {
      const workflows: WorkflowDefinition[] = [
        { name: 'alpha-one', description: 'One', nodes: [] },
        { name: 'alpha-two', description: 'Two', nodes: [] },
      ];
      // "alpha" is a substring of both but not a suffix of either (no "-alpha" ending)
      expect(() => resolveWorkflowName('alpha', workflows)).toThrow('Ambiguous workflow');
    });

    it('should prefer exact match over suffix match', () => {
      const workflows: WorkflowDefinition[] = [
        { name: 'assist', description: 'Short name', nodes: [] },
        { name: 'archon-assist', description: 'Long name', nodes: [] },
      ];
      const result = resolveWorkflowName('assist', workflows);
      expect(result?.name).toBe('assist');
    });

    it('should prefer suffix match over substring match', () => {
      const workflows: WorkflowDefinition[] = [
        { name: 'archon-assist', description: 'Suffix match', nodes: [] },
        { name: 'assist-helper', description: 'Substring match', nodes: [] },
      ];
      const result = resolveWorkflowName('assist', workflows);
      // "assist" is a suffix of "archon-assist" (ends with -assist)
      // and a substring of both, but suffix tier wins
      expect(result?.name).toBe('archon-assist');
    });
  });

  describe('error information', () => {
    it('should return error message for unknown workflow', () => {
      const response = '/invoke-workflow non-existent';
      const result = parseWorkflowInvocation(response, testWorkflows);

      expect(result.workflowName).toBeNull();
      expect(result.error).toContain('non-existent');
      expect(result.error).toContain('Available');
      expect(result.error).toContain('fix-bug');
    });

    it('should match workflow names case-insensitively', () => {
      const response = '/invoke-workflow Fix-Bug';
      const result = parseWorkflowInvocation(response, testWorkflows);

      expect(result.workflowName).toBe('fix-bug');
      expect(result.error).toBeUndefined();
    });

    it('should not have error when no /invoke-workflow pattern found', () => {
      const response = 'Just a normal message';
      const result = parseWorkflowInvocation(response, testWorkflows);

      expect(result.workflowName).toBeNull();
      expect(result.error).toBeUndefined();
    });

    it('should prefer exact match over case-insensitive match', () => {
      const response = '/invoke-workflow fix-bug';
      const result = parseWorkflowInvocation(response, testWorkflows);

      expect(result.workflowName).toBe('fix-bug');
      expect(result.error).toBeUndefined();
    });

    it('should include all available workflow names in error', () => {
      const response = '/invoke-workflow unknown';
      const result = parseWorkflowInvocation(response, testWorkflows);

      expect(result.error).toContain('fix-bug');
      expect(result.error).toContain('add-feature');
      expect(result.error).toContain('feature-development');
    });
  });

  describe('buildRouterPrompt with context', () => {
    it('should include context section when context provided', () => {
      const context: RouterContext = {
        platformType: 'github',
        isPullRequest: true,
        title: 'fix: add cloud deployment support',
        labels: ['bug', 'ci'],
      };
      const result = buildRouterPrompt('fix the ci failures', testWorkflows, context);

      expect(result).toContain('## Context');
      expect(result).toContain('Platform: github');
      expect(result).toContain('Type: Pull Request');
      expect(result).toContain('Title: fix: add cloud deployment support');
      expect(result).toContain('Labels: bug, ci');
    });

    it('should include thread history when provided', () => {
      const context: RouterContext = {
        platformType: 'slack',
        threadHistory: '[Bot]: Archon is on the case...\n<@user>: check the CI',
      };
      const result = buildRouterPrompt('what is happening?', testWorkflows, context);

      expect(result).toContain('## Context');
      expect(result).toContain('Thread History:');
      expect(result).toContain('Archon is on the case');
    });

    it('should work without context (backward compatible)', () => {
      const result = buildRouterPrompt('help me', testWorkflows);

      expect(result).toContain('## Available Workflows');
      expect(result).not.toContain('## Context');
    });

    it('should skip empty context', () => {
      const result = buildRouterPrompt('help me', testWorkflows, {});

      expect(result).not.toContain('## Context');
    });

    it('should show Issue type when isPullRequest is false', () => {
      const context: RouterContext = {
        platformType: 'github',
        isPullRequest: false,
        title: 'Bug: login fails',
      };
      const result = buildRouterPrompt('fix this', testWorkflows, context);

      expect(result).toContain('Type: Issue');
      expect(result).toContain('Title: Bug: login fails');
    });

    it('should use workflowType when isPullRequest is not set', () => {
      const context: RouterContext = {
        platformType: 'telegram',
        workflowType: 'task',
      };
      const result = buildRouterPrompt('do something', testWorkflows, context);

      expect(result).toContain('Type: task');
    });

    it('should only include platformType when that is all provided', () => {
      const context: RouterContext = {
        platformType: 'discord',
      };
      const result = buildRouterPrompt('help', testWorkflows, context);

      expect(result).toContain('## Context');
      expect(result).toContain('Platform: discord');
      expect(result).not.toContain('Type:');
      expect(result).not.toContain('Title:');
      expect(result).not.toContain('Labels:');
    });

    it('should include improved routing rules', () => {
      const result = buildRouterPrompt('fix ci', testWorkflows);

      expect(result).toContain('CI failures, test failures, build errors');
      expect(result).toContain('assist');
      expect(result).toContain('NOT for');
    });

    it('should prefer isPullRequest over workflowType when both are set', () => {
      const context: RouterContext = {
        platformType: 'github',
        isPullRequest: true,
        workflowType: 'issue', // Should be ignored in favor of isPullRequest
      };
      const result = buildRouterPrompt('test', testWorkflows, context);

      expect(result).toContain('Type: Pull Request');
      expect(result).not.toContain('Type: issue');
    });

    it('should not include labels line when labels array is empty', () => {
      const context: RouterContext = {
        platformType: 'github',
        labels: [], // Empty array
      };
      const result = buildRouterPrompt('test', testWorkflows, context);

      expect(result).toContain('## Context');
      expect(result).toContain('Platform: github');
      expect(result).not.toContain('Labels:');
    });

    it('should not include thread history when it is empty string', () => {
      const context: RouterContext = {
        platformType: 'slack',
        threadHistory: '', // Empty string, not undefined
      };
      const result = buildRouterPrompt('test', testWorkflows, context);

      expect(result).toContain('## Context');
      expect(result).toContain('Platform: slack');
      expect(result).not.toContain('Thread History:');
    });

    it('should handle all workflowType values correctly', () => {
      const types = ['issue', 'pr', 'review', 'thread', 'task'] as const;
      for (const type of types) {
        const context: RouterContext = {
          platformType: 'github',
          workflowType: type,
        };
        const result = buildRouterPrompt('test', testWorkflows, context);
        expect(result).toContain(`Type: ${type}`);
      }
    });

    it('omits approval-node workflows for autonomous requests even without mode metadata', () => {
      const result = buildRouterPrompt('run this autonomously with no approval prompts', [
        {
          name: 'safe-autonomous',
          description: 'Use when autonomous artifact-only execution is needed',
          mode: 'autonomous',
          lock_scope: 'artifact_only',
          nodes: [{ id: 'work', command: 'work' }],
        },
        {
          name: 'approval-without-mode',
          description: 'Use when a human approval gate is needed',
          nodes: [
            {
              id: 'approve',
              approval: {
                message: 'Approve?',
              },
            },
          ],
        },
      ]);

      expect(result).toContain('**safe-autonomous**');
      expect(result).not.toContain('**approval-without-mode**');
      expect(result).toContain('Omitted 1 human-in-loop/high-impact/source-mutating workflow');
    });

    it('does not treat negated approval-gate language as explicit human-loop consent', () => {
      const prompts = [
        'run ACO with no approval gate and produce the dossier',
        "continue without asking me; don't ask me for approvals",
      ];

      for (const prompt of prompts) {
        const result = buildRouterPrompt(prompt, [
          {
            name: 'safe-autonomous',
            description: 'Use when autonomous artifact-only execution is needed',
            mode: 'autonomous',
            lock_scope: 'artifact_only',
            nodes: [{ id: 'work', command: 'work' }],
          },
          {
            name: 'guided-approval',
            description: 'Use when a human approval gate is needed',
            mode: 'guided',
            nodes: [
              {
                id: 'approve',
                approval: {
                  message: 'Approve?',
                },
              },
            ],
          },
        ]);

        expect(result).toContain('**safe-autonomous**');
        expect(result).not.toContain('**guided-approval**');
        expect(result).toContain('Omitted 1 human-in-loop/high-impact/source-mutating workflow');
      }
    });

    it('omits external-side-effect workflows for autonomous requests even without mode metadata', () => {
      const result = buildRouterPrompt('run this autonomously with no approval prompts', [
        {
          name: 'safe-artifacts',
          description: 'Use when autonomous artifact-only execution is needed',
          mode: 'autonomous',
          lock_scope: 'artifact_only',
          nodes: [{ id: 'work', command: 'work' }],
        },
        {
          name: 'deploy-remote',
          description: 'Use when deployment mutates remote production systems',
          lock_scope: 'external_side_effect',
          nodes: [{ id: 'deploy', command: 'deploy' }],
        },
      ]);

      expect(result).toContain('**safe-artifacts**');
      expect(result).not.toContain('**deploy-remote**');
      expect(result).toContain('Omitted 1 human-in-loop/high-impact/source-mutating workflow');
    });

    it('omits checkout-mutation workflows for autonomous requests even when explicitly autonomous', () => {
      const result = buildRouterPrompt('continue autonomously without asking', [
        {
          name: 'marked-source-edit',
          description: 'Use when autonomous source edits are needed',
          mode: 'autonomous',
          lock_scope: 'checkout_mutation',
          nodes: [{ id: 'work', command: 'work' }],
        },
        {
          name: 'unmarked-source-edit',
          description: 'Use when source edits are needed',
          lock_scope: 'checkout_mutation',
          nodes: [{ id: 'edit', command: 'edit' }],
        },
      ]);

      expect(result).not.toContain('**marked-source-edit**');
      expect(result).not.toContain('**unmarked-source-edit**');
      expect(result).toContain('Omitted 2 human-in-loop/high-impact/source-mutating workflow');
    });

    it('omits legacy workflows without safe lock metadata unless mutates_checkout is false', () => {
      const result = buildRouterPrompt('continue autonomously without asking', [
        {
          name: 'legacy-default-mutating',
          description: 'Use when legacy workflow metadata has not declared a safe lock scope',
          nodes: [{ id: 'work', command: 'work' }],
        },
        {
          name: 'legacy-readonly',
          description: 'Use when legacy workflow explicitly disables checkout mutation',
          mutates_checkout: false,
          nodes: [{ id: 'inspect', command: 'inspect' }],
        },
      ]);

      expect(result).not.toContain('**legacy-default-mutating**');
      expect(result).toContain('**legacy-readonly**');
      expect(result).toContain('Omitted 1 human-in-loop/high-impact/source-mutating workflow');
    });

    it('fails closed when autonomous requests only match human-in-loop workflows', () => {
      const userMessage = 'continue without asking and produce the dossier';
      const result = buildRouterPrompt(userMessage, [
        {
          name: 'guided-approval',
          description: 'Use when guided execution with approval is needed',
          mode: 'guided',
          interactive: true,
          nodes: [{ id: 'work', command: 'work' }],
        },
        {
          name: 'deploy-remote',
          description: 'Use when deployment mutates remote production systems',
          lock_scope: 'external_side_effect',
          nodes: [{ id: 'deploy', command: 'deploy' }],
        },
      ]);

      expect(result).toBe(userMessage);
      expect(result).not.toContain('/invoke-workflow');
      expect(result).not.toContain('guided-approval');
      expect(result).not.toContain('deploy-remote');
    });
  });
});
