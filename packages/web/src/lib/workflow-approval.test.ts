import { describe, expect, test } from 'bun:test';
import {
  formatWorkflowApprovalAuditRows,
  normalizeWorkflowApprovalAuditFromMetadata,
  normalizeWorkflowApprovalFromMetadata,
} from './workflow-approval';

describe('normalizeWorkflowApprovalFromMetadata', () => {
  test('normalizes active approval context from mixed metadata casing', () => {
    const approval = normalizeWorkflowApprovalFromMetadata({
      approval: {
        node_id: 'deploy-gate',
        message: 'Deploy to production?',
        mutation_class: 'production',
        path: 'services/api',
        command: 'npm run deploy',
        reason: 'Release approved build',
        default_scope: 'once',
        allowed_scopes: ['once', 'run'],
        approval_channel: 'web',
        high_impact: true,
        high_impact_confirmed: false,
      },
    });

    expect(approval).toEqual({
      nodeId: 'deploy-gate',
      message: 'Deploy to production?',
      mutationClass: 'production',
      path: 'services/api',
      command: 'npm run deploy',
      reason: 'Release approved build',
      defaultScope: 'once',
      allowedScopes: ['once', 'run'],
      approvalChannel: 'web',
      highImpact: true,
      highImpactConfirmed: false,
    });
  });
});

describe('normalizeWorkflowApprovalAuditFromMetadata', () => {
  test('normalizes persisted snake_case approval audit metadata', () => {
    const audit = normalizeWorkflowApprovalAuditFromMetadata({
      approval_audit: {
        decision: 'approved',
        node_id: 'deploy-gate',
        approval_scope: 'once',
        approval_channel: 'cli',
        high_impact: true,
        high_impact_confirmed: true,
        mutation_class: 'production',
        path: 'services/api',
        command: 'npm run deploy',
        reason: 'Release approved build',
        approval_reason: 'manual reviewer approved',
        default_scope: 'once',
        allowed_scopes: ['once'],
      },
    });

    expect(audit).toEqual({
      decision: 'approved',
      nodeId: 'deploy-gate',
      approvalScope: 'once',
      approvalChannel: 'cli',
      highImpact: true,
      highImpactConfirmed: true,
      mutationClass: 'production',
      path: 'services/api',
      command: 'npm run deploy',
      reason: 'Release approved build',
      approvalReason: 'manual reviewer approved',
      defaultScope: 'once',
      allowedScopes: ['once'],
    });
  });

  test('normalizes persisted camelCase rejection audit metadata', () => {
    const audit = normalizeWorkflowApprovalAuditFromMetadata({
      approvalAudit: {
        decision: 'rejected',
        nodeId: 'review',
        approvalChannel: 'chat',
        highImpact: false,
        rejectionReason: 'needs a rollback plan',
      },
    });

    expect(audit).toEqual({
      decision: 'rejected',
      nodeId: 'review',
      approvalChannel: 'chat',
      highImpact: false,
      rejectionReason: 'needs a rollback plan',
    });
  });

  test('drops invalid scopes and channels instead of rendering misleading controls', () => {
    const audit = normalizeWorkflowApprovalAuditFromMetadata({
      approval_audit: {
        decision: 'approved',
        node_id: 'gate',
        approval_scope: 'forever',
        approval_channel: 'sms',
        allowed_scopes: ['forever', 'once'],
      },
    });

    expect(audit).toEqual({
      decision: 'approved',
      nodeId: 'gate',
      allowedScopes: ['once'],
    });
  });
});

describe('formatWorkflowApprovalAuditRows', () => {
  test('renders the safety-relevant audit fields shown in compact workflow surfaces', () => {
    const rows = formatWorkflowApprovalAuditRows({
      decision: 'approved',
      nodeId: 'deploy-gate',
      approvalScope: 'once',
      approvalChannel: 'web',
      highImpact: true,
      highImpactConfirmed: true,
      mutationClass: 'production',
      path: 'services/api',
      command: 'npm run deploy',
      reason: 'Release approved build',
      defaultScope: 'once',
      allowedScopes: ['once'],
    });

    expect(rows).toContainEqual(['Decision', 'approved']);
    expect(rows).toContainEqual(['Scope', 'once']);
    expect(rows).toContainEqual(['Channel', 'web']);
    expect(rows).toContainEqual(['High impact', 'yes']);
    expect(rows).toContainEqual(['High-impact confirmed', 'yes']);
    expect(rows).toContainEqual(['Mutation class', 'production']);
    expect(rows).toContainEqual(['Path', 'services/api']);
    expect(rows).toContainEqual(['Command', 'npm run deploy']);
    expect(rows).toContainEqual(['Reason', 'Release approved build']);
    expect(rows).toContainEqual(['Default scope', 'once']);
    expect(rows).toContainEqual(['Allowed scopes', 'once']);
  });
});
