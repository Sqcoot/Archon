import { z } from 'zod';
import { evidenceRefSchema, mutationClassValues } from '@archon/aco-core';
import {
  acoCommandIdValues,
  acoCommandImplementationStatusValues,
  acoCommandOutputModeValues,
} from '@archon/aco-cli-contracts';

export const acoWorkflowIdValues = ['context-orchestrate', 'archon-aco-adversarial-loop'] as const;
export const workflowParityStatusValues = ['contractual'] as const;
export const workflowRequirementStatusValues = [
  'not-required',
  'deferred',
  'approval-required',
] as const;

const nonEmptyStringSchema = z.string().min(1);
const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/);
const mutationClassSchema = z.enum(mutationClassValues);

export const workflowNodeContractSchema = z
  .object({
    id: nonEmptyStringSchema,
    purpose: nonEmptyStringSchema,
    dependsOn: z.array(nonEmptyStringSchema),
    contextCommandIds: z.array(z.enum(acoCommandIdValues)),
    role: nonEmptyStringSchema,
    requiredArtifacts: z.array(nonEmptyStringSchema),
    completionEvidence: z.array(nonEmptyStringSchema).min(1),
  })
  .strict();

export const workflowCommandBindingSchema = z
  .object({
    nodeId: nonEmptyStringSchema,
    commandId: z.enum(acoCommandIdValues),
    display: nonEmptyStringSchema,
    implementationStatus: z.enum(acoCommandImplementationStatusValues),
    requestedMutationClasses: z.array(mutationClassSchema).min(1),
    outputModes: z.array(z.enum(acoCommandOutputModeValues)).min(1),
    reason: nonEmptyStringSchema,
  })
  .strict();

export const workflowApprovalRequirementSchema = z
  .object({
    commandId: z.enum(acoCommandIdValues),
    display: nonEmptyStringSchema,
    status: z.enum(workflowRequirementStatusValues),
    required: z.boolean(),
    mutationScope: z.array(mutationClassSchema),
    reason: nonEmptyStringSchema,
  })
  .strict();

export const workflowArtifactContractSchema = z
  .object({
    path: nonEmptyStringSchema,
    schemaVersion: nonEmptyStringSchema,
    producerNodeId: nonEmptyStringSchema,
    consumerNodeIds: z.array(nonEmptyStringSchema),
    required: z.boolean(),
  })
  .strict();

export const bundledWorkflowDefaultIdentitySchema = z
  .object({
    name: z.enum(acoWorkflowIdValues),
    fileName: nonEmptyStringSchema,
    checksum: checksumSchema,
    nodeIds: z.array(nonEmptyStringSchema).min(1),
  })
  .strict();

export const workflowParityContractSchema = z
  .object({
    kind: z.literal('aco-workflow-parity-contract'),
    schemaVersion: z.literal('aco.workflow-parity-contract.v1'),
    id: z.enum(acoWorkflowIdValues),
    name: z.enum(acoWorkflowIdValues),
    purpose: nonEmptyStringSchema,
    triggerDescription: nonEmptyStringSchema,
    workflowDescription: nonEmptyStringSchema,
    requiredNodes: z.array(workflowNodeContractSchema).min(1),
    contextCommandBindings: z.array(workflowCommandBindingSchema).min(1),
    roleConstraints: z.array(nonEmptyStringSchema).min(1),
    capabilityConstraints: z.array(nonEmptyStringSchema).min(1),
    artifactContracts: z.array(workflowArtifactContractSchema).min(1),
    approvalRequirements: z.array(workflowApprovalRequirementSchema).min(1),
    bundledDefault: bundledWorkflowDefaultIdentitySchema,
    status: z.enum(workflowParityStatusValues),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const workflowParityBundleSchema = z
  .object({
    kind: z.literal('aco-workflow-parity-bundle'),
    schemaVersion: z.literal('aco.workflow-parity-bundle.v1'),
    id: z.literal('aco.workflows.s9.workflow-parity'),
    status: z.enum(workflowParityStatusValues),
    contracts: z.array(workflowParityContractSchema).length(acoWorkflowIdValues.length),
    deferredCommands: z.array(workflowApprovalRequirementSchema),
    approvalRequiredCommands: z.array(workflowApprovalRequirementSchema),
    nextSlice: nonEmptyStringSchema,
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const bundledDefaultRecordSchema = z
  .object({
    name: z.enum(acoWorkflowIdValues),
    fileName: nonEmptyStringSchema,
    checksum: checksumSchema,
    nodeIds: z.array(nonEmptyStringSchema).min(1),
  })
  .strict();

export const bundledDefaultInventorySchema = z
  .object({
    kind: z.literal('aco-workflow-bundled-default-inventory'),
    schemaVersion: z.literal('aco.workflow-bundled-default-inventory.v1'),
    defaults: z.array(bundledDefaultRecordSchema),
  })
  .strict();

export const workflowYamlNodeMetadataSchema = z
  .object({
    id: nonEmptyStringSchema,
    depends_on: z.array(nonEmptyStringSchema).optional(),
    bash: nonEmptyStringSchema.optional(),
    command: nonEmptyStringSchema.optional(),
    prompt: nonEmptyStringSchema.optional(),
  })
  .passthrough();

export const workflowYamlMetadataSchema = z
  .object({
    name: z.enum(acoWorkflowIdValues),
    description: nonEmptyStringSchema,
    nodes: z.array(workflowYamlNodeMetadataSchema).min(1),
  })
  .passthrough();

export type AcoWorkflowId = (typeof acoWorkflowIdValues)[number];
export type WorkflowParityStatus = (typeof workflowParityStatusValues)[number];
export type WorkflowRequirementStatus = (typeof workflowRequirementStatusValues)[number];
export type WorkflowNodeContract = z.infer<typeof workflowNodeContractSchema>;
export type WorkflowCommandBinding = z.infer<typeof workflowCommandBindingSchema>;
export type WorkflowApprovalRequirement = z.infer<typeof workflowApprovalRequirementSchema>;
export type WorkflowArtifactContract = z.infer<typeof workflowArtifactContractSchema>;
export type BundledWorkflowDefaultIdentity = z.infer<typeof bundledWorkflowDefaultIdentitySchema>;
export type WorkflowParityContract = z.infer<typeof workflowParityContractSchema>;
export type WorkflowParityBundle = z.infer<typeof workflowParityBundleSchema>;
export type BundledDefaultRecord = z.infer<typeof bundledDefaultRecordSchema>;
export type BundledDefaultInventory = z.infer<typeof bundledDefaultInventorySchema>;
export type WorkflowYamlNodeMetadata = z.infer<typeof workflowYamlNodeMetadataSchema>;
export type WorkflowYamlMetadata = z.infer<typeof workflowYamlMetadataSchema>;
