import {
  commandDescriptorById,
  type AcoCommandImplementationStatus,
  type AcoCommandId,
} from '@archon/aco-cli-contracts';
import {
  REQUIRED_ACO_WORKFLOW_IDS,
  REQUIRED_APPROVAL_COMMAND_ID,
  REQUIRED_DEFERRED_COMMAND_ID,
} from './constants';
import {
  bundledDefaultInventorySchema,
  workflowParityBundleSchema,
  workflowParityContractSchema,
  workflowYamlMetadataSchema,
} from './schemas';
import type {
  WorkflowApprovalRequirement,
  WorkflowParityBundle,
  WorkflowParityContract,
  WorkflowYamlMetadata,
} from './schemas';

export function checkWorkflowParityContract(input: unknown): readonly string[] {
  const parsed = workflowParityContractSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map(issue => issue.message);

  const contract = parsed.data;
  const errors: string[] = [];
  if (contract.id !== contract.name) errors.push('workflow contract id must match name');

  errors.push(
    ...checkUnique(
      contract.requiredNodes.map(node => node.id),
      'workflow node'
    )
  );
  errors.push(
    ...checkUnique(
      contract.artifactContracts.map(artifact => artifact.path),
      'artifact'
    )
  );

  const nodeIds = new Set(contract.requiredNodes.map(node => node.id));
  const bundledNodeIds = [...contract.bundledDefault.nodeIds].sort();
  const contractNodeIds = [...nodeIds].sort();
  if (bundledNodeIds.join(',') !== contractNodeIds.join(',')) {
    errors.push(`${contract.name} bundled default node IDs do not match contract node IDs`);
  }

  for (const node of contract.requiredNodes) {
    for (const dependency of node.dependsOn) {
      if (!nodeIds.has(dependency)) {
        errors.push(`${contract.name} node ${node.id} depends on unknown node ${dependency}`);
      }
    }
    for (const artifactPath of node.requiredArtifacts) {
      if (!contract.artifactContracts.some(artifact => artifact.path === artifactPath)) {
        errors.push(`${contract.name} node ${node.id} references unknown artifact ${artifactPath}`);
      }
    }
  }

  for (const binding of contract.contextCommandBindings) {
    if (!nodeIds.has(binding.nodeId)) {
      errors.push(`${contract.name} binding references unknown node ${binding.nodeId}`);
    }
    errors.push(...checkDescriptorBinding(binding.commandId, binding.implementationStatus));
    if (!binding.requestedMutationClasses.includes('read-only')) {
      errors.push(`${contract.name} binding ${binding.commandId} must request read-only execution`);
    }
  }

  for (const requirement of contract.approvalRequirements) {
    errors.push(...checkRequirementDescriptor(requirement));
  }
  errors.push(...checkRequiredWorkflowRequirements(contract.approvalRequirements));

  return errors;
}

export function checkWorkflowParityBundle(input: unknown): readonly string[] {
  const parsed = workflowParityBundleSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map(issue => issue.message);

  const bundle = parsed.data;
  const errors: string[] = [];
  const ids = new Set(bundle.contracts.map(contract => contract.id));
  for (const required of REQUIRED_ACO_WORKFLOW_IDS) {
    if (!ids.has(required)) errors.push(`missing required workflow contract ${required}`);
  }
  if (ids.size !== REQUIRED_ACO_WORKFLOW_IDS.length) {
    errors.push('workflow parity bundle must contain exactly the required workflows');
  }
  for (const contract of bundle.contracts) {
    errors.push(...checkWorkflowParityContract(contract));
  }
  errors.push(
    ...checkRequiredWorkflowRequirements([
      ...bundle.deferredCommands,
      ...bundle.approvalRequiredCommands,
    ])
  );
  if (!bundle.nextSlice.toLowerCase().includes('s10')) {
    errors.push('workflow parity bundle must advance nextSlice to S10');
  }
  return errors;
}

export function checkBundledDefaultInventory(
  input: unknown,
  bundle: WorkflowParityBundle
): readonly string[] {
  const parsed = bundledDefaultInventorySchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map(issue => issue.message);

  const inventory = parsed.data;
  const errors: string[] = [];
  const byName = new Map(inventory.defaults.map(defaultItem => [defaultItem.name, defaultItem]));

  for (const contract of bundle.contracts) {
    const defaultItem = byName.get(contract.name);
    if (defaultItem === undefined) {
      errors.push(`missing bundled default workflow ${contract.name}`);
      continue;
    }
    if (defaultItem.fileName !== contract.bundledDefault.fileName) {
      errors.push(`${contract.name} bundled default filename mismatch`);
    }
    if (defaultItem.checksum !== contract.bundledDefault.checksum) {
      errors.push(`${contract.name} bundled default checksum mismatch`);
    }
    if (defaultItem.nodeIds.join(',') !== contract.bundledDefault.nodeIds.join(',')) {
      errors.push(`${contract.name} bundled default node order mismatch`);
    }
  }

  return errors;
}

export function checkWorkflowYamlMetadata(
  input: unknown,
  contract: WorkflowParityContract
): readonly string[] {
  const parsed = workflowYamlMetadataSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map(issue => issue.message);

  const metadata = parsed.data;
  const errors: string[] = [];
  if (metadata.name !== contract.name) {
    errors.push(`workflow yaml name ${metadata.name} does not match ${contract.name}`);
  }

  const yamlNodeIds = metadata.nodes.map(node => node.id);
  const contractNodeIds = contract.requiredNodes.map(node => node.id);
  if (yamlNodeIds.join(',') !== contractNodeIds.join(',')) {
    errors.push(`${contract.name} yaml node order does not match contract`);
  }

  for (const node of contract.requiredNodes) {
    const yamlNode = metadata.nodes.find(candidate => candidate.id === node.id);
    if (yamlNode === undefined) {
      errors.push(`${contract.name} yaml is missing node ${node.id}`);
      continue;
    }
    const dependsOn = yamlNode.depends_on ?? [];
    if (dependsOn.join(',') !== node.dependsOn.join(',')) {
      errors.push(`${contract.name} yaml node ${node.id} dependencies do not match contract`);
    }
    const commandText = [yamlNode.bash, yamlNode.command, yamlNode.prompt].filter(
      (value): value is string => value !== undefined
    );
    if (commandText.some(value => value.includes('research:graph'))) {
      errors.push(`${contract.name} yaml must not run bun run research:graph`);
    }
    if (commandText.some(value => value.includes('aco:role-contracts'))) {
      errors.push(`${contract.name} yaml must not run bun run aco:role-contracts`);
    }
    if (commandText.some(value => value.includes('--write-artifact'))) {
      errors.push(`${contract.name} yaml must not request artifact writes`);
    }
  }

  return errors;
}

export function stableChecksum(seedValue: string): string {
  const seeds = [0x811c9dc5, 0x12345678, 0x9e3779b9, 0xabcdef01];
  const parts = seeds.map(seed => fnv1a(seedValue, seed).toString(16).padStart(8, '0'));
  return `${parts.join('')}${parts.join('')}`.slice(0, 64);
}

export function parseWorkflowYamlMetadata(input: unknown): WorkflowYamlMetadata | null {
  const parsed = workflowYamlMetadataSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

function checkDescriptorBinding(
  commandId: AcoCommandId,
  implementationStatus: AcoCommandImplementationStatus
): readonly string[] {
  const descriptor = commandDescriptorById(commandId);
  if (descriptor === undefined) return [`missing command descriptor ${commandId}`];
  const errors: string[] = [];
  if (descriptor.implementationStatus !== implementationStatus) {
    errors.push(`${commandId} implementation status does not match descriptor`);
  }
  if (descriptor.implementationStatus !== 'supported') {
    errors.push(`${commandId} cannot be a workflow context binding until it is supported`);
  }
  if (descriptor.mutates !== 'read-only') {
    errors.push(`${commandId} workflow binding must be read-only`);
  }
  return errors;
}

function checkRequirementDescriptor(requirement: WorkflowApprovalRequirement): readonly string[] {
  const descriptor = commandDescriptorById(requirement.commandId);
  if (descriptor === undefined) return [`missing command descriptor ${requirement.commandId}`];

  const errors: string[] = [];
  if (requirement.display !== descriptor.display) {
    errors.push(`${requirement.commandId} requirement display does not match descriptor`);
  }
  if (requirement.commandId === REQUIRED_DEFERRED_COMMAND_ID && requirement.status !== 'deferred') {
    errors.push(`${REQUIRED_DEFERRED_COMMAND_ID} must remain deferred in S9`);
  }
  if (
    requirement.commandId === REQUIRED_APPROVAL_COMMAND_ID &&
    requirement.status !== 'approval-required'
  ) {
    errors.push(`${REQUIRED_APPROVAL_COMMAND_ID} must remain approval-required in S9`);
  }
  return errors;
}

function checkRequiredWorkflowRequirements(
  requirements: readonly WorkflowApprovalRequirement[]
): readonly string[] {
  const errors: string[] = [];
  const deferred = requirements.find(
    requirement => requirement.commandId === REQUIRED_DEFERRED_COMMAND_ID
  );
  const approvalRequired = requirements.find(
    requirement => requirement.commandId === REQUIRED_APPROVAL_COMMAND_ID
  );
  if (deferred === undefined) {
    errors.push(`${REQUIRED_DEFERRED_COMMAND_ID} requirement is missing`);
  }
  if (approvalRequired === undefined) {
    errors.push(`${REQUIRED_APPROVAL_COMMAND_ID} requirement is missing`);
  }
  return errors;
}

function checkUnique(values: readonly string[], label: string): readonly string[] {
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const value of values) {
    if (seen.has(value)) errors.push(`duplicate ${label} ${value}`);
    seen.add(value);
  }
  return errors;
}

function fnv1a(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
