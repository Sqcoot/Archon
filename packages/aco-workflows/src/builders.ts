import type { EvidenceRef, MutationClass, ParseResult } from '@archon/aco-core';
import { commandDescriptorById, type AcoCommandId } from '@archon/aco-cli-contracts';
import {
  DEFAULT_WORKFLOW_EVIDENCE,
  REQUIRED_ADVERSARIAL_LOOP_NODES,
  REQUIRED_APPROVAL_COMMAND_ID,
  REQUIRED_CONTEXT_ORCHESTRATE_NODES,
  REQUIRED_DEFERRED_COMMAND_ID,
  S8_CONTEXT_EVIDENCE,
  S9_CONSENSUS_EVIDENCE,
  WORKFLOW_LEDGER_EVIDENCE,
} from './constants';
import { checkWorkflowParityBundle, checkWorkflowParityContract, stableChecksum } from './checks';
import { renderWorkflowDefaultYaml } from './renderers';
import {
  bundledDefaultInventorySchema,
  workflowParityBundleSchema,
  workflowParityContractSchema,
  workflowYamlMetadataSchema,
} from './schemas';
import type {
  AcoWorkflowId,
  BundledDefaultInventory,
  BundledDefaultRecord,
  WorkflowApprovalRequirement,
  WorkflowArtifactContract,
  WorkflowCommandBinding,
  WorkflowNodeContract,
  WorkflowParityBundle,
  WorkflowParityContract,
  WorkflowYamlMetadata,
} from './schemas';

interface WorkflowContractSeed {
  readonly id: AcoWorkflowId;
  readonly purpose: string;
  readonly triggerDescription: string;
  readonly workflowDescription: string;
  readonly requiredNodes: readonly WorkflowNodeContract[];
  readonly roleConstraints: readonly string[];
  readonly capabilityConstraints: readonly string[];
  readonly artifactContracts: readonly WorkflowArtifactContract[];
  readonly evidence: readonly EvidenceRef[];
}

export interface BundledDefaultInventoryInput {
  readonly name: AcoWorkflowId;
  readonly fileName: string;
  readonly content: string;
  readonly nodeIds: readonly string[];
}

export function buildWorkflowParityBundle(): ParseResult<WorkflowParityBundle> {
  const context = buildContextOrchestrateContract();
  if (!context.ok) return context;

  const adversarial = buildAdversarialLoopContract();
  if (!adversarial.ok) return adversarial;

  const allRequirements = defaultWorkflowRequirements();
  const bundle = {
    kind: 'aco-workflow-parity-bundle',
    schemaVersion: 'aco.workflow-parity-bundle.v1',
    id: 'aco.workflows.s9.workflow-parity',
    status: 'contractual',
    contracts: [context.value, adversarial.value],
    deferredCommands: allRequirements.filter(requirement => requirement.status === 'deferred'),
    approvalRequiredCommands: allRequirements.filter(
      requirement => requirement.status === 'approval-required'
    ),
    nextSlice: 'complete',
    evidence: [S9_CONSENSUS_EVIDENCE, WORKFLOW_LEDGER_EVIDENCE, DEFAULT_WORKFLOW_EVIDENCE],
  } as const;

  const parsed = workflowParityBundleSchema.safeParse(bundle);
  if (!parsed.success)
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  const issues = checkWorkflowParityBundle(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function buildContextOrchestrateContract(): ParseResult<WorkflowParityContract> {
  return buildContract({
    id: 'context-orchestrate',
    purpose: 'Preserve context orchestration as a bundled workflow contract',
    triggerDescription:
      'S9 needs read-only orchestration of context status, ledgers, routing, compilation, approval capsule verification, and handoff.',
    workflowDescription:
      'Runs only read-only context CLI surfaces in the order status, ledgers, route, compile, approval capsule, verification, and handoff.',
    requiredNodes: contextOrchestrateNodes(),
    roleConstraints: [
      'workflow cannot claim implementation completion without evaluator evidence',
      'approval capsule records requested scope only and cannot grant approval',
      'handoff must carry context digest and verification status',
    ],
    capabilityConstraints: [
      'uses only supported S1-S8 read-only context command surfaces',
      'does not refresh graph evidence',
      'does not request write-artifact flags',
      'does not install or mutate workflow configuration',
    ],
    artifactContracts: contextOrchestrateArtifacts(),
    evidence: [S9_CONSENSUS_EVIDENCE, S8_CONTEXT_EVIDENCE, WORKFLOW_LEDGER_EVIDENCE],
  });
}

export function buildAdversarialLoopContract(): ParseResult<WorkflowParityContract> {
  return buildContract({
    id: 'archon-aco-adversarial-loop',
    purpose: 'Preserve adversarial loop planning and review as a bundled workflow contract',
    triggerDescription:
      'S9 needs a conservative adversarial loop contract without claiming autonomous runtime parity.',
    workflowDescription:
      'Represents coordinator, BMAD review, search evidence, planner contract, generator/QA/evaluator, and feedback handoff using read-only context outputs.',
    requiredNodes: adversarialLoopNodes(),
    roleConstraints: [
      'planner proposes criteria but cannot declare final completion',
      'generator output remains subject to QA and evaluator review',
      'evaluator verdict is required before any completion claim',
      'feedback handoff must preserve unresolved risks',
    ],
    capabilityConstraints: [
      'does not execute provider adapters or autonomous subagents',
      'does not run bun run aco:role-contracts in S9',
      'does not run bun run research:graph or write graph cache',
      'does not grant approval or mutate provider configuration',
    ],
    artifactContracts: adversarialLoopArtifacts(),
    evidence: [S9_CONSENSUS_EVIDENCE, S8_CONTEXT_EVIDENCE, WORKFLOW_LEDGER_EVIDENCE],
  });
}

export function workflowContractById(id: AcoWorkflowId): WorkflowParityContract | undefined {
  const bundle = buildWorkflowParityBundle();
  if (!bundle.ok) throw new Error(bundle.issues.join('\n'));
  return bundle.value.contracts.find(contract => contract.id === id);
}

export function buildBundledDefaultInventory(
  inputs: readonly BundledDefaultInventoryInput[]
): ParseResult<BundledDefaultInventory> {
  const defaults = inputs.map(input => ({
    name: input.name,
    fileName: input.fileName,
    checksum: stableChecksum(input.content.replace(/\r\n/g, '\n')),
    nodeIds: [...input.nodeIds],
  })) satisfies BundledDefaultRecord[];

  const inventory = {
    kind: 'aco-workflow-bundled-default-inventory',
    schemaVersion: 'aco.workflow-bundled-default-inventory.v1',
    defaults,
  } as const;

  const parsed = bundledDefaultInventorySchema.safeParse(inventory);
  if (!parsed.success)
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  return { ok: true, value: parsed.data };
}

export function parseWorkflowYamlMetadata(input: unknown): ParseResult<WorkflowYamlMetadata> {
  const parsed = workflowYamlMetadataSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  return { ok: true, value: parsed.data };
}

function buildContract(seed: WorkflowContractSeed): ParseResult<WorkflowParityContract> {
  const nodeIds = seed.requiredNodes.map(node => node.id);
  const withoutChecksum = {
    kind: 'aco-workflow-parity-contract',
    schemaVersion: 'aco.workflow-parity-contract.v1',
    id: seed.id,
    name: seed.id,
    purpose: seed.purpose,
    triggerDescription: seed.triggerDescription,
    workflowDescription: seed.workflowDescription,
    requiredNodes: seed.requiredNodes,
    contextCommandBindings: commandBindings(seed.requiredNodes),
    roleConstraints: seed.roleConstraints,
    capabilityConstraints: seed.capabilityConstraints,
    artifactContracts: seed.artifactContracts,
    approvalRequirements: defaultWorkflowRequirements(),
    bundledDefault: {
      name: seed.id,
      fileName: `${seed.id}.yaml`,
      checksum: '0'.repeat(64),
      nodeIds,
    },
    status: 'contractual',
    evidence: seed.evidence,
  } as const;

  const checksum = stableChecksum(renderWorkflowDefaultYaml(withoutChecksum));
  const contract = {
    ...withoutChecksum,
    bundledDefault: {
      ...withoutChecksum.bundledDefault,
      checksum,
    },
  } as const;

  const parsed = workflowParityContractSchema.safeParse(contract);
  if (!parsed.success)
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  const issues = checkWorkflowParityContract(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

function commandBindings(
  nodes: readonly WorkflowNodeContract[]
): readonly WorkflowCommandBinding[] {
  return nodes.flatMap(node =>
    node.contextCommandIds.map(commandId => {
      const descriptor = descriptorOrThrow(commandId);
      return {
        nodeId: node.id,
        commandId: descriptor.id,
        display: descriptor.display,
        implementationStatus: descriptor.implementationStatus,
        requestedMutationClasses: ['read-only'],
        outputModes: descriptor.outputModes,
        reason: `${node.id} consumes ${descriptor.display} without mutation flags`,
      } as const;
    })
  );
}

function defaultWorkflowRequirements(): readonly WorkflowApprovalRequirement[] {
  return [
    requirement(
      REQUIRED_DEFERRED_COMMAND_ID,
      'deferred',
      false,
      [],
      'role contract execution remains deferred outside S9 workflow parity'
    ),
    requirement(
      REQUIRED_APPROVAL_COMMAND_ID,
      'approval-required',
      true,
      ['network', 'writes-graph-cache'],
      'graph refresh remains approval-required and is never triggered implicitly'
    ),
  ];
}

function requirement(
  commandId: AcoCommandId,
  status: WorkflowApprovalRequirement['status'],
  required: boolean,
  mutationScope: readonly MutationClass[],
  reason: string
): WorkflowApprovalRequirement {
  const descriptor = descriptorOrThrow(commandId);
  return {
    commandId: descriptor.id,
    display: descriptor.display,
    status,
    required,
    mutationScope: [...mutationScope],
    reason,
  };
}

function contextOrchestrateNodes(): readonly WorkflowNodeContract[] {
  return [
    node(
      'status',
      'Compute context readiness and next-slice state',
      [],
      ['archon.context.status'],
      ['artifacts/context-orchestrate/status.json']
    ),
    node(
      'ledgers',
      'Expose command and ledger coverage for routing',
      ['status'],
      ['archon.context.ledgers']
    ),
    node(
      'route',
      'Select the read-only advisory route for the prompt',
      ['ledgers'],
      ['archon.context.route']
    ),
    node(
      'compile',
      'Compile deterministic context package output',
      ['route'],
      ['archon.context.compile']
    ),
    node(
      'approval-capsule',
      'Record requested mutation scope without granting approval',
      ['compile'],
      ['archon.context.approval-capsule']
    ),
    node(
      'verification',
      'Verify approval capsule evidence and checksum',
      ['approval-capsule'],
      ['archon.context.approval-capsule-verify']
    ),
    node(
      'handoff',
      'Summarize verified context package for the next slice',
      ['verification'],
      ['archon.context.status']
    ),
  ];
}

function adversarialLoopNodes(): readonly WorkflowNodeContract[] {
  return [
    node(
      'coordinator',
      'Route the objective through supported context contracts',
      [],
      ['archon.context.route']
    ),
    node(
      'skill-bmad-review',
      'Represent BMAD review boundaries without running role contracts',
      ['coordinator'],
      ['archon.context.compile']
    ),
    node(
      'search-evidence',
      'Read graph waiver state without refreshing graph cache',
      ['skill-bmad-review'],
      ['archon.context.graph-waivers']
    ),
    node(
      'planner-contract',
      'Compile planner contract evidence for generator and QA review',
      ['search-evidence'],
      ['archon.context.compile']
    ),
    node(
      'generator-qa-evaluator',
      'Require QA and evaluator verification before completion claims',
      ['planner-contract'],
      ['archon.context.approval-capsule-verify']
    ),
    node(
      'feedback-handoff',
      'Carry unresolved risks and evaluator status into handoff',
      ['generator-qa-evaluator'],
      ['archon.context.status']
    ),
  ];
}

function node(
  id: string,
  purpose: string,
  dependsOn: readonly string[],
  contextCommandIds: readonly AcoCommandId[],
  requiredArtifacts: readonly string[] = []
): WorkflowNodeContract {
  return {
    id,
    purpose,
    dependsOn: [...dependsOn],
    contextCommandIds: [...contextCommandIds],
    role: roleForNode(id),
    requiredArtifacts: [...requiredArtifacts],
    completionEvidence: [`${id} output is present`, `${id} contract remains read-only`],
  };
}

function contextOrchestrateArtifacts(): readonly WorkflowArtifactContract[] {
  return REQUIRED_CONTEXT_ORCHESTRATE_NODES.map(nodeId => ({
    path: `artifacts/context-orchestrate/${nodeId}.json`,
    schemaVersion: 'aco.workflow-node-artifact.v1',
    producerNodeId: nodeId,
    consumerNodeIds: nodeId === 'handoff' ? [] : ['handoff'],
    required: true,
  }));
}

function adversarialLoopArtifacts(): readonly WorkflowArtifactContract[] {
  return REQUIRED_ADVERSARIAL_LOOP_NODES.map(nodeId => ({
    path: `artifacts/archon-aco-adversarial-loop/${nodeId}.json`,
    schemaVersion: 'aco.workflow-node-artifact.v1',
    producerNodeId: nodeId,
    consumerNodeIds: nodeId === 'feedback-handoff' ? [] : ['feedback-handoff'],
    required: true,
  }));
}

function roleForNode(id: string): string {
  if (id.includes('evaluator') || id.includes('verification')) return 'evaluator';
  if (id.includes('planner') || id.includes('route')) return 'planner';
  if (id.includes('handoff')) return 'coordinator';
  if (id.includes('search')) return 'researcher';
  return 'coordinator';
}

function descriptorOrThrow(
  commandId: AcoCommandId
): NonNullable<ReturnType<typeof commandDescriptorById>> {
  const descriptor = commandDescriptorById(commandId);
  if (descriptor === undefined) throw new Error(`missing command descriptor ${commandId}`);
  return descriptor;
}
