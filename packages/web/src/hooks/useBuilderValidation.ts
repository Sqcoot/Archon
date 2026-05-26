import { useState, useEffect, useRef } from 'react';
import type { DagFlowNode } from '@/components/workflows/DagNodeComponent';
import type { Edge } from '@xyflow/react';
import { hasCycle } from '@/lib/dag-layout';
import type { ProviderCapabilities, ProviderInfo } from '@/lib/api';
import type { WorkflowLockScope, WorkflowMode } from '@/lib/types';

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  nodeId?: string;
  field?: string;
  suggestion?: string;
  badBehaviour?: BadBehaviourLint;
}

export type BadBehaviourClassification = 'intentional' | 'warning-only' | 'bug';

export type BadBehaviourPattern =
  | 'ignored_control'
  | 'unsupported_control'
  | 'unsupported_ignored'
  | 'silent_behavior'
  | 'warning_only_control'
  | 'missing_control'
  | 'deferred_behavior'
  | 'denied_before_write'
  | 'best_effort_surface'
  | 'conflicting_metadata';

export interface BadBehaviourLint {
  pattern: BadBehaviourPattern;
  classification: BadBehaviourClassification;
  rationale: string;
}

export interface WorkflowRuntimeControlOptions {
  modelReasoningEffort?: unknown;
  webSearchMode?: unknown;
  additionalDirectories?: unknown;
}

const SEVERITY_ORDER: Record<ValidationIssue['severity'], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

const NON_AI_SAFETY_OUTPUT_CONTROL_FIELDS = [
  'output_format',
  'allowed_tools',
  'denied_tools',
  'hooks',
  'mcp',
  'skills',
  'agents',
  'sandbox',
  'maxBudgetUsd',
  'systemPrompt',
  'fallbackModel',
  'betas',
  'effort',
  'thinking',
] as const;

const HIGH_IMPACT_APPROVAL_CLASSES = new Set(['destructive', 'credential', 'remote', 'production']);

function getInstantIssues(
  workflowName: string,
  workflowDescription: string,
  nodes: DagFlowNode[],
  workflowProvider: string | undefined,
  providers: ProviderInfo[],
  workflowMode: WorkflowMode,
  lockScope: WorkflowLockScope,
  runtimeControls: WorkflowRuntimeControlOptions
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!workflowName.trim()) {
    issues.push({
      severity: 'error',
      message: 'Workflow name is required',
      field: 'name',
    });
  }

  if (!workflowDescription.trim()) {
    issues.push({
      severity: 'error',
      message: 'Workflow description is required',
      field: 'description',
    });
  }

  if (nodes.length === 0) {
    issues.push({
      severity: 'error',
      message: 'At least one node is required',
    });
  }

  if (
    workflowMode === 'autonomous' &&
    (lockScope === 'checkout_mutation' || lockScope === 'external_side_effect')
  ) {
    issues.push({
      severity: 'error',
      message: `Autonomous workflows cannot use lock_scope: ${lockScope}`,
      field: 'lock_scope',
      suggestion:
        'Use mode: guided or interactive_only for source-mutating or external-side-effect workflows, or reduce lock_scope to artifact_only/read_only.',
      badBehaviour: {
        pattern: 'conflicting_metadata',
        classification: 'bug',
        rationale: 'Autonomous routing metadata conflicts with a high-impact lock scope.',
      },
    });
  }

  for (const node of nodes) {
    const nodeType: string = node.data.nodeType;
    if (nodeType === 'bash' && !node.data.bashScript?.trim()) {
      issues.push({
        severity: 'error',
        message: `Node "${node.data.id}": bash script cannot be empty`,
        nodeId: node.data.id,
        field: 'bashScript',
        suggestion: 'Enter a bash script for this node',
      });
    }
    if (nodeType === 'prompt' && !node.data.promptText?.trim()) {
      issues.push({
        severity: 'error',
        message: `Node "${node.data.id}": prompt cannot be empty`,
        nodeId: node.data.id,
        field: 'promptText',
        suggestion: 'Enter a prompt for this node',
      });
    }
    if (workflowMode === 'autonomous' && nodeType === 'approval') {
      issues.push({
        severity: 'error',
        message: `Node "${node.data.id}": autonomous workflows cannot contain approval nodes`,
        nodeId: node.data.id,
        field: 'approval',
        suggestion:
          'Use mode: guided or interactive_only for human approval gates, or replace the approval with a deterministic safety check.',
        badBehaviour: {
          pattern: 'conflicting_metadata',
          classification: 'bug',
          rationale: 'Autonomous workflow metadata conflicts with a human-in-loop approval gate.',
        },
      });
    }
    if (nodeType === 'approval') {
      issues.push(...getApprovalGateIssues(node));
    }
    if (lockScope === 'external_side_effect' && nodeType !== 'approval') {
      issues.push({
        severity: 'warning',
        message: `Node "${node.data.id}": external_side_effect workflows should gate side-effecting work with explicit approval`,
        nodeId: node.data.id,
        field: 'lock_scope',
        suggestion:
          'Add an approval node before external side effects, or reduce lock_scope if this node only reads data or writes scoped artifacts.',
        badBehaviour: {
          pattern: 'warning_only_control',
          classification: 'warning-only',
          rationale:
            'External side effects are high-impact and should be paired with explicit approval gates.',
        },
      });
    }
    issues.push(
      ...getProviderCapabilityIssues(
        node,
        workflowProvider,
        providers,
        workflowMode,
        lockScope,
        runtimeControls
      )
    );
  }

  return issues;
}

function getProviderCapabilityIssues(
  node: DagFlowNode,
  workflowProvider: string | undefined,
  providers: ProviderInfo[],
  workflowMode: WorkflowMode,
  lockScope: WorkflowLockScope,
  runtimeControls: WorkflowRuntimeControlOptions
): ValidationIssue[] {
  const providerId = effectiveProviderId(node, workflowProvider);
  const issues: ValidationIssue[] = [];

  if (
    node.data.agents !== undefined &&
    typeof node.data.agents === 'object' &&
    !Array.isArray(node.data.agents) &&
    Object.prototype.hasOwnProperty.call(node.data.agents, 'dag-node-skills') &&
    Array.isArray(node.data.skills) &&
    node.data.skills.length > 0
  ) {
    issues.push({
      severity: 'error',
      message: `Node "${node.data.id}": reserved inline agent "dag-node-skills" conflicts with skills`,
      nodeId: node.data.id,
      field: 'agents.dag-node-skills',
      suggestion:
        'Rename the inline agent or remove skills; dag-node-skills is reserved for the generated skills wrapper.',
      badBehaviour: {
        pattern: 'silent_behavior',
        classification: 'bug',
        rationale:
          'A user-defined reserved agent would override the generated skills wrapper, making skills silently ineffective.',
      },
    });
  }

  if (!isAiExecutionNode(node)) {
    const ignoredControlFields = NON_AI_SAFETY_OUTPUT_CONTROL_FIELDS.filter(field =>
      hasMeaningfulNodeDataField(node, field)
    );
    if (ignoredControlFields.length > 0) {
      issues.push({
        severity: 'error',
        message: `Node "${node.data.id}": ${node.data.nodeType} nodes ignore safety/output control fields: ${ignoredControlFields.join(', ')}`,
        nodeId: node.data.id,
        field: ignoredControlFields.join(','),
        suggestion:
          'Move these controls to a prompt/AI node where the provider enforces them, or remove them so workflow behavior is explicit.',
        badBehaviour: {
          pattern: 'silent_behavior',
          classification: 'bug',
          rationale:
            'Safety/output/resource controls on this node type would silently disappear because the executor does not read them.',
        },
      });
    }
    return issues;
  }

  const capabilities = providerId
    ? providers.find(provider => provider.id === providerId)?.capabilities
    : undefined;
  if (!providerId || !capabilities) return issues;
  if (
    workflowMode === 'autonomous' &&
    lockScope !== undefined &&
    (lockScope === 'checkout_mutation' || lockScope === 'external_side_effect')
  ) {
    issues.push({
      severity: 'error',
      message: `Node "${node.data.id}": autonomous workflows cannot use lock_scope: ${lockScope}`,
      nodeId: node.data.id,
      field: 'lock_scope',
      suggestion:
        'Use mode: guided/interactive_only for source-mutating or external-side-effect workflows, or reduce lock_scope to artifact_only/read_only.',
      badBehaviour: {
        pattern: 'conflicting_metadata',
        classification: 'bug',
        rationale: 'Autonomous routing metadata conflicts with a high-impact lock scope.',
      },
    });
  }
  if (isAiExecutionNode(node) && providerId !== 'codex') {
    if (runtimeControls.modelReasoningEffort !== undefined) {
      issues.push({
        severity: 'warning',
        message: `Node "${node.data.id}": workflow-level modelReasoningEffort is Codex-specific and will be ignored by provider "${providerId}"`,
        nodeId: node.data.id,
        field: 'modelReasoningEffort',
        suggestion: 'Remove modelReasoningEffort or run this workflow node with provider: codex.',
        badBehaviour: {
          pattern: 'unsupported_ignored',
          classification: 'warning-only',
          rationale:
            'Codex model reasoning effort is an advisory model-control field for other providers; builder validation surfaces the ignored control before execution.',
        },
      });
    }
    if (runtimeControls.webSearchMode !== undefined) {
      issues.push({
        severity: 'error',
        message: `Node "${node.data.id}": workflow-level webSearchMode is Codex-specific and is not enforced by provider "${providerId}"`,
        nodeId: node.data.id,
        field: 'webSearchMode',
        suggestion: 'Remove webSearchMode or run this workflow node with provider: codex.',
        badBehaviour: {
          pattern: 'unsupported_control',
          classification: 'bug',
          rationale:
            'webSearchMode controls network/tool behavior and must fail closed when the selected provider does not enforce it.',
        },
      });
    }
    if (runtimeControls.additionalDirectories !== undefined) {
      issues.push({
        severity: 'error',
        message: `Node "${node.data.id}": workflow-level additionalDirectories is Codex-specific and is not enforced by provider "${providerId}"`,
        nodeId: node.data.id,
        field: 'additionalDirectories',
        suggestion: 'Remove additionalDirectories or run this workflow node with provider: codex.',
        badBehaviour: {
          pattern: 'unsupported_control',
          classification: 'bug',
          rationale:
            'additionalDirectories changes the provider filesystem boundary and must fail closed when the selected provider does not enforce it.',
        },
      });
    }
  }
  if (
    node.data.hooks !== undefined &&
    capabilities.hookCapabilities.workflowNodeHooks !== 'enforced'
  ) {
    issues.push({
      severity: 'error',
      message: `Node "${node.data.id}": provider "${providerId}" does not enforce workflow YAML hooks`,
      nodeId: node.data.id,
      field: 'hooks',
      suggestion:
        'Remove workflow YAML hooks, choose a provider with workflowNodeHooks=enforced, or use provider-native runtime hooks covered by bootloader/preflight artifacts.',
      badBehaviour: {
        pattern: 'unsupported_control',
        classification: 'bug',
        rationale:
          'Workflow YAML hooks are a safety/output control surface and must not be confused with provider-native runtime hooks.',
      },
    });
  }
  if (node.data.allowed_tools !== undefined && !capabilities.toolRestrictions) {
    issues.push(providerCapabilityIssue(node, 'allowed_tools', providerId, 'tool allowlists'));
  }
  if (node.data.denied_tools !== undefined && !capabilities.toolRestrictions) {
    issues.push(providerCapabilityIssue(node, 'denied_tools', providerId, 'tool denylists'));
  }
  if (node.data.mcp !== undefined && !capabilities.mcp) {
    issues.push(providerCapabilityIssue(node, 'mcp', providerId, 'MCP server configuration'));
  }
  if (Array.isArray(node.data.skills) && node.data.skills.length > 0 && !capabilities.skills) {
    issues.push(providerCapabilityIssue(node, 'skills', providerId, 'skill configuration'));
  }
  if (node.data.agents !== undefined && !capabilities.agents) {
    issues.push(providerCapabilityIssue(node, 'agents', providerId, 'inline agents'));
  }
  if (node.data.sandbox !== undefined && !capabilities.sandbox) {
    issues.push(providerCapabilityIssue(node, 'sandbox', providerId, 'sandbox settings'));
  }
  if (node.data.maxBudgetUsd !== undefined && !capabilities.costControl) {
    issues.push(providerCapabilityIssue(node, 'maxBudgetUsd', providerId, 'budget caps'));
  }
  if (node.data.systemPrompt !== undefined) {
    if (!capabilities.systemPrompt || capabilities.systemPromptMode === 'unsupported') {
      issues.push(
        providerCapabilityIssue(node, 'systemPrompt', providerId, 'system prompt controls')
      );
    } else if (
      capabilities.systemPromptMode === 'string_only' &&
      typeof node.data.systemPrompt !== 'string'
    ) {
      issues.push({
        severity: 'error',
        message: `Node "${node.data.id}": provider "${providerId}" supports only string systemPrompt values`,
        nodeId: node.data.id,
        field: 'systemPrompt',
        suggestion:
          'Use a string systemPrompt for this provider or choose a provider with full systemPrompt support.',
        badBehaviour: {
          pattern: 'unsupported_control',
          classification: 'bug',
          rationale:
            'Non-string systemPrompt values would be dropped or degraded by this provider instead of being fully enforced.',
        },
      });
    }
  }
  if (node.data.effort !== undefined && !capabilities.effortControl) {
    issues.push(advisoryProviderCapabilityIssue(node, 'effort', providerId, 'effort controls'));
  }
  if (node.data.thinking !== undefined && !capabilities.thinkingControl) {
    issues.push(advisoryProviderCapabilityIssue(node, 'thinking', providerId, 'thinking controls'));
  }
  if (Array.isArray(node.data.betas) && node.data.betas.length > 0 && !capabilities.betaFlags) {
    issues.push(advisoryProviderCapabilityIssue(node, 'betas', providerId, 'provider beta flags'));
  }
  if (node.data.fallbackModel !== undefined && !capabilities.fallbackModel) {
    issues.push(
      advisoryProviderCapabilityIssue(node, 'fallbackModel', providerId, 'model fallback')
    );
  }
  if (node.data.output_format !== undefined && !hasEnforcedStructuredOutput(capabilities)) {
    const mode = capabilities.structuredOutputMode;
    issues.push({
      severity: 'error',
      message:
        mode === 'best_effort'
          ? `Node "${node.data.id}": provider "${providerId}" supports output_format only as best effort`
          : `Node "${node.data.id}": provider "${providerId}" does not support output_format`,
      nodeId: node.data.id,
      field: 'output_format',
      suggestion: 'Remove output_format or choose a provider with enforced structured output.',
      badBehaviour: {
        pattern: mode === 'best_effort' ? 'best_effort_surface' : 'unsupported_control',
        classification: 'bug',
        rationale:
          mode === 'best_effort'
            ? 'Best-effort structured output is not true schema enforcement for workflow output controls.'
            : 'Unsupported output controls must fail closed instead of being ignored.',
      },
    });
  }
  return issues;
}

function effectiveProviderId(
  node: DagFlowNode,
  workflowProvider: string | undefined
): string | undefined {
  const nodeProvider = node.data.provider;
  if (typeof nodeProvider === 'string' && nodeProvider.trim().length > 0) return nodeProvider;
  return workflowProvider;
}

function isAiExecutionNode(node: DagFlowNode): boolean {
  return !['bash', 'script', 'approval', 'cancel', 'loop'].includes(node.data.nodeType);
}

function getApprovalGateIssues(node: DagFlowNode): ValidationIssue[] {
  const approval = approvalRecord(node);
  const mutationClass = stringField(
    approval.mutationClass ?? approval.mutation_class ?? approval.mutationClass
  );
  const highImpact =
    booleanField(approval.highImpact ?? approval.high_impact) === true ||
    (mutationClass !== undefined && HIGH_IMPACT_APPROVAL_CLASSES.has(mutationClass));
  const defaultScope = stringField(approval.defaultScope ?? approval.default_scope);
  const allowedScopes = arrayField(approval.allowedScopes ?? approval.allowed_scopes)
    .map(value => stringField(value))
    .filter((value): value is string => value !== undefined);
  const issues: ValidationIssue[] = [];

  if (highImpact) {
    if (stringField(approval.reason) === undefined) {
      issues.push({
        severity: 'error',
        message: `Node "${node.data.id}": high-impact approval is missing reason`,
        nodeId: node.data.id,
        field: 'approval.reason',
        suggestion:
          'Add approval.reason explaining why this destructive/credential/remote/production gate is required.',
        badBehaviour: {
          pattern: 'unsupported_control',
          classification: 'bug',
          rationale:
            'A high-impact approval gate without an explicit reason is not safe for human approval.',
        },
      });
    }
    if (stringField(approval.path) === undefined && stringField(approval.command) === undefined) {
      issues.push({
        severity: 'error',
        message: `Node "${node.data.id}": high-impact approval is missing path or command context`,
        nodeId: node.data.id,
        field: 'approval.path',
        suggestion:
          'Add approval.path and/or approval.command so reviewers see exactly what will be affected.',
        badBehaviour: {
          pattern: 'unsupported_control',
          classification: 'bug',
          rationale:
            'A high-impact approval gate without path or command context hides the affected surface from the reviewer.',
        },
      });
    }
  }

  if (defaultScope === 'run') {
    issues.push({
      severity: 'error',
      message: `Node "${node.data.id}": approval cannot default to approve-for-run`,
      nodeId: node.data.id,
      field: 'approval.default_scope',
      suggestion:
        'Use default_scope: once until run-scoped approval semantics are implemented end-to-end.',
      badBehaviour: {
        pattern: highImpact ? 'conflicting_metadata' : 'deferred_behavior',
        classification: 'bug',
        rationale: highImpact
          ? 'High-impact gates must not silently widen approval from one gate to the whole run.'
          : 'The metadata can describe approve-for-run, but runtime execution currently treats approvals as one-shot gates.',
      },
    });
  }

  if (allowedScopes.includes('run')) {
    issues.push({
      severity: 'error',
      message: `Node "${node.data.id}": approve-for-run is not implemented end-to-end`,
      nodeId: node.data.id,
      field: 'approval.allowed_scopes',
      suggestion:
        'Use allowed_scopes: [once] until run-scoped approval semantics are implemented end-to-end.',
      badBehaviour: {
        pattern: 'deferred_behavior',
        classification: 'bug',
        rationale: highImpact
          ? 'High-impact gates must remain one-shot, and run-scoped approval execution is not implemented end-to-end.'
          : 'The metadata can describe approve-for-run, but runtime execution currently treats approvals as one-shot gates.',
      },
    });
  }

  return issues;
}

function hasMeaningfulNodeDataField(node: DagFlowNode, field: string): boolean {
  const value = (node.data as unknown as Record<string, unknown>)[field];
  if (value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function approvalRecord(node: DagFlowNode): Record<string, unknown> {
  const data = node.data as unknown as Record<string, unknown>;
  const approval = data.approval;
  if (approval && typeof approval === 'object' && !Array.isArray(approval)) {
    return { ...data, ...(approval as Record<string, unknown>) };
  }
  return data;
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function booleanField(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function arrayField(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function hasEnforcedStructuredOutput(capabilities: ProviderCapabilities): boolean {
  return capabilities.structuredOutput && capabilities.structuredOutputMode === 'enforced';
}

function providerCapabilityIssue(
  node: DagFlowNode,
  field: string,
  providerId: string,
  control: string
): ValidationIssue {
  return {
    severity: 'error',
    message: `Node "${node.data.id}": provider "${providerId}" does not enforce ${control}`,
    nodeId: node.data.id,
    field,
    suggestion: `Remove ${field} or choose a provider that enforces ${control}; safety/resource controls must not be silently ignored.`,
    badBehaviour: {
      pattern: 'unsupported_control',
      classification: 'bug',
      rationale: 'The selected provider does not enforce this declared safety/resource control.',
    },
  };
}

function advisoryProviderCapabilityIssue(
  node: DagFlowNode,
  field: string,
  providerId: string,
  control: string
): ValidationIssue {
  return {
    severity: 'error',
    message: `Node "${node.data.id}": provider "${providerId}" does not support ${control}; execution controls must fail closed`,
    nodeId: node.data.id,
    field,
    suggestion: `Remove ${field} or choose a provider that supports ${control}; unsupported execution controls must not be silently ignored.`,
    badBehaviour: {
      pattern: 'unsupported_control',
      classification: 'bug',
      rationale:
        'The selected provider cannot enforce this declared execution/model-selection control, so builder validation must fail closed before save/run.',
    },
  };
}

function getDebouncedIssues(nodes: DagFlowNode[], edges: Edge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(nodes.map(n => n.data.id));

  // 1. Duplicate node IDs
  const idCounts = new Map<string, number>();
  for (const node of nodes) {
    const id = node.data.id;
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      issues.push({
        severity: 'error',
        message: `Duplicate node ID "${id}" (appears ${count} times)`,
        nodeId: id,
        field: 'id',
        suggestion: 'Each node must have a unique ID',
      });
    }
  }

  // 2. Broken depends_on (missing source or target)
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      issues.push({
        severity: 'error',
        message: `Edge references non-existent source node "${edge.source}"`,
        nodeId: edge.target,
        field: 'depends_on',
      });
    }
    if (!nodeIds.has(edge.target)) {
      issues.push({
        severity: 'error',
        message: `Edge references non-existent target node "${edge.target}"`,
        nodeId: edge.source,
        field: 'depends_on',
      });
    }
  }

  // 3. Self-loops
  for (const edge of edges) {
    if (edge.source === edge.target) {
      issues.push({
        severity: 'error',
        message: `Node "${edge.source}" has a self-loop dependency`,
        nodeId: edge.source,
        field: 'depends_on',
        suggestion: 'A node cannot depend on itself',
      });
    }
  }

  // 4. Cycle detection via Kahn's algorithm
  if (hasCycle(nodeIds, edges)) {
    issues.push({
      severity: 'error',
      message: 'Cycle detected in workflow graph',
      suggestion: 'Remove circular dependencies between nodes',
    });
  }

  // 5. Broken $nodeId.output references
  for (const node of nodes) {
    const textsToScan: string[] = [];
    if (node.data.when) textsToScan.push(node.data.when);
    if (node.data.promptText) textsToScan.push(node.data.promptText);

    for (const text of textsToScan) {
      const outputRefPattern = /\$(\w+)\.output/g;
      let match: RegExpExecArray | null;
      while ((match = outputRefPattern.exec(text)) !== null) {
        const referencedId = match[1];
        if (!nodeIds.has(referencedId)) {
          issues.push({
            severity: 'warning',
            message: `Node "${node.data.id}" references "$${referencedId}.output" but node "${referencedId}" does not exist`,
            nodeId: node.data.id,
            suggestion: `Check that node ID "${referencedId}" is correct`,
          });
        }
      }
    }
  }

  return issues;
}

export function useBuilderValidation(
  workflowName: string,
  workflowDescription: string,
  nodes: DagFlowNode[],
  edges: Edge[],
  workflowProvider: string | undefined,
  providers: ProviderInfo[],
  workflowMode: WorkflowMode,
  lockScope: WorkflowLockScope,
  runtimeControls: WorkflowRuntimeControlOptions = {}
): ValidationIssue[] {
  const [debouncedIssues, setDebouncedIssues] = useState<ValidationIssue[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced checks
  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      const issues = getDebouncedIssues(nodes, edges);
      setDebouncedIssues(issues);
      timerRef.current = null;
    }, 300);

    return (): void => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [nodes, edges]);

  // Instant checks (every render)
  const instantIssues = getInstantIssues(
    workflowName,
    workflowDescription,
    nodes,
    workflowProvider,
    providers,
    workflowMode,
    lockScope,
    runtimeControls
  );

  // Combine and sort by severity (errors first)
  const allIssues = [...instantIssues, ...debouncedIssues];
  allIssues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return allIssues;
}
