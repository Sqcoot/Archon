import { describe, expect, test } from 'bun:test';
import { isApprovalContext } from './workflow-run';

describe('isApprovalContext', () => {
  test('accepts canonical high-impact approval metadata', () => {
    expect(
      isApprovalContext({
        nodeId: 'production-gate',
        message: 'Deploy to production?',
        type: 'approval',
        mutationClass: 'production',
        path: '/service',
        command: 'deploy production',
        reason: 'Production deployment changes customer traffic',
        highImpact: true,
        highImpactConfirmed: false,
        defaultScope: 'once',
        allowedScopes: ['once'],
      })
    ).toBe(true);
  });

  test('accepts forward-compatible high-impact approval mutation classes', () => {
    expect(
      isApprovalContext({
        nodeId: 'network-gate',
        message: 'Change network boundary?',
        type: 'approval',
        mutationClass: 'network_boundary',
        command: 'configure-network-boundary',
        reason: 'Changes external network access',
        highImpact: true,
        highImpactConfirmed: false,
        defaultScope: 'once',
        allowedScopes: ['once'],
      })
    ).toBe(true);
  });

  test('rejects malformed or legacy approval safety metadata', () => {
    expect(
      isApprovalContext({
        nodeId: 'production-gate',
        message: 'Deploy to production?',
        mutation_class: 'production',
        default_scope: 'once',
        allowed_scopes: ['once'],
      })
    ).toBe(false);
    expect(
      isApprovalContext({
        nodeId: 'production-gate',
        message: 'Deploy to production?',
        mutationClass: 'production',
        allowedScopes: ['run', 'forever'],
      })
    ).toBe(false);
    expect(
      isApprovalContext({
        nodeId: 'production-gate',
        message: 'Deploy to production?',
        mutationClass: '',
      })
    ).toBe(false);
  });
});
