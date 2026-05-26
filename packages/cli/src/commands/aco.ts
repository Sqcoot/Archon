import {
  AcoCommandRouter,
  acoCliContractsFixtureGate,
  buildCommandCatalog,
  commandDescriptorById,
  deniedCommandResult,
  okCommandResult,
  renderCliResultJson,
  renderCommandHelpMarkdown,
  renderCommandPlanMarkdown,
  unsupportedCommandResult,
} from '@archon/aco-cli-contracts';
import type {
  AcoCommandCatalog,
  AcoCommandDescriptor,
  AcoCommandId,
  AcoCommandOutputMode,
  AcoCommandResultEnvelope,
  CommandHandlerRegistration,
  CommandInvocation,
  JsonValue,
} from '@archon/aco-cli-contracts';
import {
  buildApprovalCapsule,
  buildContextStatus,
  compileContextPackage,
  renderApprovalCapsuleJson,
  renderApprovalCapsuleMarkdown,
  renderApprovalCapsuleVerificationJson,
  renderApprovalCapsuleVerificationMarkdown,
  renderCompiledContextPackageJson,
  renderCompiledContextPackageMarkdown,
  renderContextStatusJson,
  renderContextStatusMarkdown,
  verifyApprovalCapsule,
} from '@archon/aco-context';
import {
  buildCodexBootstrapArtifacts,
  codexBootstrapEventTypeValues,
  defaultCodexBootstrapInput,
} from '@archon/aco-codex';
import type { CodexBootstrapEventType } from '@archon/aco-codex';
import { buildGraphWaiverClosure, renderGraphWaiverClosureJson } from '@archon/aco-research';
import { writeAcoDossier } from './aco-artifacts';
import type { AcoDossierWriteResult } from './aco-artifacts';

export interface AcoCliOptions {
  readonly json?: boolean;
  readonly event?: string;
  readonly format?: string;
  readonly writeArtifact?: boolean;
  readonly noWriteArtifact?: boolean;
}

type AcoResolution =
  | { readonly ok: true; readonly invocation: CommandInvocation }
  | { readonly ok: false; readonly result: AcoCommandResultEnvelope };

const DEFAULT_CONTEXT_PROMPT = 'Implement S8 context contracts';

export async function acoCommand(
  cwd: string,
  positionals: readonly string[],
  options: AcoCliOptions = {}
): Promise<number> {
  const catalog = buildCommandCatalog();
  if (!catalog.ok) {
    return writeResult(
      unsupportedCommandResult(`invalid S7 command catalog: ${catalog.issues.join('; ')}`),
      'json'
    );
  }

  const resolution = resolveAcoCommandInvocation(cwd, positionals, options);
  if (!resolution.ok) {
    return writeResult(resolution.result, options.json ? 'json' : 'markdown');
  }

  const router = new AcoCommandRouter({
    descriptors: catalog.value.descriptors,
    handlers: createAcoCliHandlers(cwd),
  });
  const result = await router.dispatch(resolution.invocation);
  return writeResult(result, resolution.invocation.outputMode);
}

export function resolveAcoCommandInvocation(
  cwd: string,
  positionals: readonly string[],
  options: AcoCliOptions = {}
): AcoResolution {
  const command = positionals[0];
  const subcommand = positionals[1];
  const jsonMode = options.json === true;
  const outputMode = resolveOutputMode(options.format, jsonMode);
  if (!outputMode.ok) return { ok: false, result: outputMode.result };

  if (command === 'aco') {
    if (subcommand === 'status') {
      const writeArtifact = shouldWriteArtifacts(options);
      return invocation(
        'archon.aco.status',
        cwd,
        positionals,
        { writeArtifact },
        outputMode.value,
        artifactWriteMutations(writeArtifact)
      );
    }
    if (subcommand === 'bootstrap-codex') {
      const event = options.event;
      const format = options.json === true ? 'json' : (options.format ?? 'markdown');
      const writeArtifact = shouldWriteArtifacts(options);
      if (event === undefined || event.trim().length === 0) {
        const descriptor = descriptorOrThrow('archon.aco.bootstrap-codex');
        return {
          ok: false,
          result: deniedCommandResult(
            descriptor.id,
            descriptor.display,
            'missing required --event <event>'
          ),
        };
      }
      if (format !== 'markdown' && format !== 'json') {
        const descriptor = descriptorOrThrow('archon.aco.bootstrap-codex');
        return {
          ok: false,
          result: deniedCommandResult(
            descriptor.id,
            descriptor.display,
            'invalid --format; expected markdown or json'
          ),
        };
      }
      return invocation(
        'archon.aco.bootstrap-codex',
        cwd,
        positionals,
        { event, format, writeArtifact },
        format,
        artifactWriteMutations(writeArtifact)
      );
    }
  }

  if (command === 'context') {
    switch (subcommand) {
      case 'status':
        return invocation(
          'archon.context.status',
          cwd,
          positionals,
          { ...promptArgs(positionals, 2), writeArtifact: shouldWriteArtifacts(options) },
          outputMode.value,
          artifactWriteMutations(shouldWriteArtifacts(options))
        );
      case 'ledgers':
        return invocation(
          'archon.context.ledgers',
          cwd,
          positionals,
          { ...promptArgs(positionals, 2), writeArtifact: shouldWriteArtifacts(options) },
          outputMode.value,
          artifactWriteMutations(shouldWriteArtifacts(options))
        );
      case 'route': {
        const args = promptArgs(positionals, 2);
        if (args.prompt.length === 0) {
          const descriptor = descriptorOrThrow('archon.context.route');
          return {
            ok: false,
            result: deniedCommandResult(
              descriptor.id,
              descriptor.display,
              'missing required <prompt>'
            ),
          };
        }
        return invocation(
          'archon.context.route',
          cwd,
          positionals,
          { ...args, writeArtifact: shouldWriteArtifacts(options) },
          outputMode.value,
          artifactWriteMutations(shouldWriteArtifacts(options))
        );
      }
      case 'compile':
        return contextPromptInvocation(
          'archon.context.compile',
          cwd,
          positionals,
          outputMode.value,
          shouldWriteArtifacts(options)
        );
      case 'approval-capsule':
        return contextPromptInvocation(
          'archon.context.approval-capsule',
          cwd,
          positionals,
          outputMode.value,
          shouldWriteArtifacts(options)
        );
      case 'approval-capsule-verify':
        return invocation(
          'archon.context.approval-capsule-verify',
          cwd,
          positionals,
          { writeArtifact: shouldWriteArtifacts(options) },
          outputMode.value,
          artifactWriteMutations(shouldWriteArtifacts(options))
        );
      case 'graph-waivers':
        return invocation(
          'archon.context.graph-waivers',
          cwd,
          positionals,
          { writeArtifact: shouldWriteArtifacts(options) },
          outputMode.value,
          artifactWriteMutations(shouldWriteArtifacts(options))
        );
      case 'validate':
        return invocation(
          'archon.context.validate',
          cwd,
          positionals,
          { writeArtifact: shouldWriteArtifacts(options) },
          outputMode.value,
          artifactWriteMutations(shouldWriteArtifacts(options))
        );
      default:
        return { ok: false, result: unsupportedCommandResult(positionals.join(' ')) };
    }
  }

  return { ok: false, result: unsupportedCommandResult(positionals.join(' ')) };
}

function createAcoCliHandlers(cwd: string): readonly CommandHandlerRegistration[] {
  return [
    {
      commandId: 'archon.aco.status',
      handler: (invocationItem, descriptor): AcoCommandResultEnvelope => {
        const outputMode = invocationItem.outputMode;
        const stdout = renderAcoStatusMarkdown(cwd);
        const data = statusData(cwd);
        const badBehaviourLint = acoBadBehaviourLint([
          scopedArtifactWriteLintItem(),
          ...artifactContentBadBehaviourLintItems([{ name: 'aco-status.md', content: stdout }]),
        ]);
        const dossier = invocationItem.args.writeArtifact
          ? writeAcoDossier({
              cwd: invocationItem.cwd ?? process.cwd(),
              runId: `aco-status-${Date.now()}`,
              commandId: descriptor.id,
              evidence: descriptor.evidence,
              artifacts: [
                {
                  name: 'aco-status.md',
                  content: stdout,
                  mediaType: 'text/markdown',
                  schemaVersion: 'aco.status.v1',
                },
              ],
              extra: {
                ...data,
                badBehaviourLint,
              },
            })
          : null;
        return okCommandResult({
          descriptor,
          stdout: stdoutWithOptionalDossierNotice(stdout, dossier, outputMode),
          data: {
            ...data,
            badBehaviourLint,
            ...(dossier
              ? {
                  ...dossierResultData(dossier),
                }
              : {}),
          },
        });
      },
    },
    {
      commandId: 'archon.aco.bootstrap-codex',
      handler: invocationItem => renderBootstrapCodex(invocationItem),
    },
    {
      commandId: 'archon.context.status',
      handler: (invocationItem, descriptor): AcoCommandResultEnvelope =>
        renderContextStatusCommand(invocationItem, descriptor),
    },
    {
      commandId: 'archon.context.ledgers',
      handler: (invocationItem, descriptor): AcoCommandResultEnvelope => {
        const catalog = buildCatalogOrThrow();
        const stdout = renderCommandHelpMarkdown(catalog);
        const outputMode = invocationItem.outputMode;
        const badBehaviourLint = acoBadBehaviourLint([
          scopedArtifactWriteLintItem(),
          ...artifactContentBadBehaviourLintItems([
            { name: 'context-ledgers.md', content: stdout },
          ]),
        ]);
        const dossier = invocationItem.args.writeArtifact
          ? writeAcoDossier({
              cwd: invocationItem.cwd ?? process.cwd(),
              runId: `aco-context-ledgers-${Date.now()}`,
              commandId: descriptor.id,
              evidence: descriptor.evidence,
              artifacts: [
                {
                  name: 'context-ledgers.md',
                  content: stdout,
                  mediaType: 'text/markdown',
                  schemaVersion: 'aco.context-ledgers.v1',
                },
              ],
              extra: {
                commandCount: catalog.descriptors.length,
                badBehaviourLint,
              },
            })
          : null;
        return okCommandResult({
          descriptor,
          stdout: stdoutWithOptionalDossierNotice(stdout, dossier, outputMode),
          data: {
            commandCount: catalog.descriptors.length,
            badBehaviourLint,
            ...(dossier
              ? {
                  ...dossierResultData(dossier),
                }
              : {}),
          },
        });
      },
    },
    {
      commandId: 'archon.context.route',
      handler: (invocationItem, descriptor): AcoCommandResultEnvelope => {
        const prompt = stringArg(invocationItem.args.prompt, '');
        const outputMode = invocationItem.outputMode;
        const routePayload = {
          kind: 'aco-context-route',
          schemaVersion: 'aco.context-route.v1',
          commandId: descriptor.id,
          display: descriptor.display,
          owner: descriptor.owner,
          mutates: descriptor.mutates,
          safetyClasses: descriptor.safetyClasses,
          approvalRequired: descriptor.approvalRequired,
          prompt,
        };
        const stdout =
          outputMode === 'json'
            ? `${JSON.stringify(routePayload, null, 2)}\n`
            : `${renderCommandPlanMarkdown(descriptor)}prompt: ${prompt}\n`;
        const artifactName = outputMode === 'json' ? 'context-route.json' : 'context-route.md';
        const badBehaviourLint = acoBadBehaviourLint([
          scopedArtifactWriteLintItem(),
          ...artifactContentBadBehaviourLintItems([{ name: artifactName, content: stdout }]),
        ]);
        const dossier = invocationItem.args.writeArtifact
          ? writeAcoDossier({
              cwd: invocationItem.cwd ?? process.cwd(),
              runId: `aco-context-route-${Date.now()}`,
              commandId: descriptor.id,
              evidence: descriptor.evidence,
              artifacts: [
                {
                  name: artifactName,
                  content: stdout,
                  mediaType: outputMode === 'json' ? 'application/json' : 'text/markdown',
                  schemaVersion: 'aco.context-route.v1',
                },
              ],
              extra: {
                prompt,
                badBehaviourLint,
              },
            })
          : null;
        return okCommandResult({
          descriptor,
          stdout: stdoutWithOptionalDossierNotice(stdout, dossier, outputMode),
          data: {
            prompt,
            route: routePayload,
            badBehaviourLint,
            ...(dossier
              ? {
                  ...dossierResultData(dossier),
                }
              : {}),
          },
        });
      },
    },
    {
      commandId: 'archon.context.compile',
      handler: (invocationItem, descriptor): AcoCommandResultEnvelope =>
        renderContextPackageCommand(invocationItem, descriptor),
    },
    {
      commandId: 'archon.context.approval-capsule',
      handler: (invocationItem, descriptor): AcoCommandResultEnvelope =>
        renderApprovalCapsuleCommand(invocationItem, descriptor),
    },
    {
      commandId: 'archon.context.approval-capsule-verify',
      handler: (invocationItem, descriptor): AcoCommandResultEnvelope =>
        renderApprovalCapsuleVerificationCommand(invocationItem, descriptor),
    },
    {
      commandId: 'archon.context.graph-waivers',
      handler: (invocationItem, descriptor) => renderGraphWaivers(invocationItem, descriptor),
    },
    {
      commandId: 'archon.context.validate',
      handler: async (invocationItem, descriptor): Promise<AcoCommandResultEnvelope> => {
        const result = await acoCliContractsFixtureGate.run(undefined);
        if (result.status !== 'passed') {
          return deniedCommandResult(
            descriptor.id,
            descriptor.display,
            result.status === 'failed' ? result.errors.join('; ') : result.reason
          );
        }
        const outputMode = invocationItem.outputMode;
        const payload = {
          kind: 'aco-context-validate',
          schemaVersion: 'aco.context-validate.v1',
          descriptorCount: result.value.descriptorCount,
          commandIds: result.value.commandIds,
          statusCounts: result.value.statusCounts,
        };
        const stdout =
          outputMode === 'json'
            ? `${JSON.stringify(payload, null, 2)}\n`
            : `ACO CLI contracts valid: ${result.value.descriptorCount} command descriptors\n`;
        const artifactName =
          outputMode === 'json' ? 'context-validate.json' : 'context-validate.md';
        const badBehaviourLint = acoBadBehaviourLint([
          scopedArtifactWriteLintItem(),
          ...artifactContentBadBehaviourLintItems([{ name: artifactName, content: stdout }]),
        ]);
        const dossier = invocationItem.args.writeArtifact
          ? writeAcoDossier({
              cwd: invocationItem.cwd ?? process.cwd(),
              runId: `aco-context-validate-${Date.now()}`,
              commandId: descriptor.id,
              evidence: descriptor.evidence,
              artifacts: [
                {
                  name: artifactName,
                  content: stdout,
                  mediaType: outputMode === 'json' ? 'application/json' : 'text/markdown',
                  schemaVersion: 'aco.context-validate.v1',
                },
              ],
              extra: {
                descriptorCount: result.value.descriptorCount,
                badBehaviourLint,
              },
            })
          : null;
        return okCommandResult({
          descriptor,
          stdout: stdoutWithOptionalDossierNotice(stdout, dossier, outputMode),
          data: {
            descriptorCount: result.value.descriptorCount,
            commandIds: result.value.commandIds,
            statusCounts: result.value.statusCounts,
            badBehaviourLint,
            ...(dossier
              ? {
                  ...dossierResultData(dossier),
                }
              : {}),
          },
        });
      },
    },
  ];
}

function renderContextStatusCommand(
  invocationItem: CommandInvocation,
  descriptor: AcoCommandDescriptor
): AcoCommandResultEnvelope {
  const prompt = stringArg(invocationItem.args.prompt, '');
  const status = buildContextStatus({ prompt });
  if (!status.ok)
    return deniedCommandResult(descriptor.id, descriptor.display, status.issues.join('; '));

  const outputMode = invocationItem.outputMode === 'json' ? 'json' : 'markdown';
  const stdout =
    outputMode === 'json'
      ? renderContextStatusJson(status.value)
      : renderContextStatusMarkdown(status.value);
  const badBehaviourLint = acoBadBehaviourLint([
    scopedArtifactWriteLintItem(),
    ...artifactContentBadBehaviourLintItems([
      {
        name: outputMode === 'json' ? 'context-status.json' : 'context-status.md',
        content: stdout,
      },
    ]),
  ]);
  const dossier = invocationItem.args.writeArtifact
    ? writeAcoDossier({
        cwd: invocationItem.cwd ?? process.cwd(),
        runId: `aco-context-status-${Date.now()}`,
        commandId: descriptor.id,
        evidence: descriptor.evidence,
        artifacts: [
          {
            name: outputMode === 'json' ? 'context-status.json' : 'context-status.md',
            content: stdout,
            mediaType: outputMode === 'json' ? 'application/json' : 'text/markdown',
            schemaVersion: 'aco.context-status.v1',
          },
        ],
        extra: {
          readiness: status.value.readiness,
          promptDigest: status.value.promptDigest,
          requiredLedgers: status.value.requiredLedgers.length,
          deferredSurfaces: status.value.deferredSurfaces.length,
          badBehaviourLint,
        },
      })
    : null;

  return okCommandResult({
    descriptor,
    stdout: stdoutWithOptionalDossierNotice(stdout, dossier, outputMode),
    data: {
      readiness: status.value.readiness,
      promptDigest: status.value.promptDigest,
      requiredLedgers: status.value.requiredLedgers.length,
      deferredSurfaces: status.value.deferredSurfaces.length,
      badBehaviourLint,
      ...(dossier
        ? {
            ...dossierResultData(dossier),
          }
        : {}),
    },
  });
}

function renderContextPackageCommand(
  invocationItem: CommandInvocation,
  descriptor: AcoCommandDescriptor
): AcoCommandResultEnvelope {
  const prompt = stringArg(invocationItem.args.prompt, '');
  const context = compileContextPackage({ prompt });
  if (!context.ok) {
    return deniedCommandResult(descriptor.id, descriptor.display, context.issues.join('; '));
  }

  const outputMode = invocationItem.outputMode === 'json' ? 'json' : 'markdown';
  const stdout =
    outputMode === 'json'
      ? renderCompiledContextPackageJson(context.value)
      : renderCompiledContextPackageMarkdown(context.value);
  const contextArtifacts =
    (
      context.value as {
        artifacts?: readonly { name: string; content?: string; schemaVersion?: string }[];
      }
    ).artifacts ?? [];
  const badBehaviourLint = acoBadBehaviourLint([
    scopedArtifactWriteLintItem(),
    deferredItemsLintItem(context.value.deferredItems.length),
    ...artifactContentBadBehaviourLintItems([
      {
        name: outputMode === 'json' ? 'context-package.json' : 'context-package.md',
        content: stdout,
      },
      ...contextArtifacts.map(item => ({
        name: `artifacts/${item.name}`,
        content: item.content ?? JSON.stringify(item, null, 2),
      })),
    ]),
  ]);
  const dossier = invocationItem.args.writeArtifact
    ? writeAcoDossier({
        cwd: invocationItem.cwd ?? process.cwd(),
        runId: `aco-context-compile-${Date.now()}`,
        commandId: descriptor.id,
        evidence: descriptor.evidence,
        artifacts: [
          {
            name: outputMode === 'json' ? 'context-package.json' : 'context-package.md',
            content: stdout,
            mediaType: outputMode === 'json' ? 'application/json' : 'text/markdown',
            schemaVersion: 'aco.context-package.v1',
          },
          ...contextArtifacts.map(item => ({
            name: `artifacts/${item.name}`,
            content: item.content ?? JSON.stringify(item, null, 2),
            mediaType: 'application/json',
            schemaVersion: item.schemaVersion,
          })),
        ],
        extra: {
          contextDigest: context.value.contextDigest,
          promptDigest: context.value.promptDigest,
          statusReadiness: context.value.statusReadiness,
          ledgerSummaries: context.value.ledgerSummaries.length,
          deferredItems: context.value.deferredItems.length,
          badBehaviourLint,
        },
      })
    : null;

  return okCommandResult({
    descriptor,
    stdout: stdoutWithOptionalDossierNotice(stdout, dossier, outputMode),
    data: {
      contextDigest: context.value.contextDigest,
      promptDigest: context.value.promptDigest,
      statusReadiness: context.value.statusReadiness,
      ledgerSummaries: context.value.ledgerSummaries.length,
      deferredItems: context.value.deferredItems.length,
      badBehaviourLint,
      ...(dossier
        ? {
            ...dossierResultData(dossier),
          }
        : {}),
    },
  });
}

function renderApprovalCapsuleCommand(
  invocationItem: CommandInvocation,
  descriptor: AcoCommandDescriptor
): AcoCommandResultEnvelope {
  const prompt = stringArg(invocationItem.args.prompt, '');
  const context = compileContextPackage({ prompt });
  if (!context.ok) {
    return deniedCommandResult(descriptor.id, descriptor.display, context.issues.join('; '));
  }

  const capsule = buildApprovalCapsule({ contextPackage: context.value });
  if (!capsule.ok) {
    return deniedCommandResult(descriptor.id, descriptor.display, capsule.issues.join('; '));
  }

  const outputMode = invocationItem.outputMode === 'json' ? 'json' : 'markdown';
  const stdout =
    outputMode === 'json'
      ? renderApprovalCapsuleJson(capsule.value)
      : renderApprovalCapsuleMarkdown(capsule.value);
  const badBehaviourLint = acoBadBehaviourLint([
    scopedArtifactWriteLintItem(),
    deferredItemsLintItem(context.value.deferredItems.length),
    ...artifactContentBadBehaviourLintItems([
      {
        name: outputMode === 'json' ? 'approval-capsule.json' : 'approval-capsule.md',
        content: stdout,
      },
      { name: 'context-package.json', content: renderCompiledContextPackageJson(context.value) },
    ]),
  ]);
  const dossier = invocationItem.args.writeArtifact
    ? writeAcoDossier({
        cwd: invocationItem.cwd ?? process.cwd(),
        runId: `aco-approval-capsule-${Date.now()}`,
        commandId: descriptor.id,
        evidence: descriptor.evidence,
        artifacts: [
          {
            name: outputMode === 'json' ? 'approval-capsule.json' : 'approval-capsule.md',
            content: stdout,
            mediaType: outputMode === 'json' ? 'application/json' : 'text/markdown',
            schemaVersion: 'aco.approval-capsule.v1',
          },
          {
            name: 'context-package.json',
            content: renderCompiledContextPackageJson(context.value),
            mediaType: 'application/json',
            schemaVersion: 'aco.context-package.v1',
          },
        ],
        extra: {
          capsuleId: capsule.value.id,
          checksum: capsule.value.checksum,
          contextDigest: capsule.value.contextDigest,
          approvalStatus: capsule.value.approvalStatus,
          badBehaviourLint,
        },
      })
    : null;

  return okCommandResult({
    descriptor,
    stdout: stdoutWithOptionalDossierNotice(stdout, dossier, outputMode),
    data: {
      capsuleId: capsule.value.id,
      checksum: capsule.value.checksum,
      contextDigest: capsule.value.contextDigest,
      approvalStatus: capsule.value.approvalStatus,
      badBehaviourLint,
      ...(dossier
        ? {
            ...dossierResultData(dossier),
          }
        : {}),
    },
  });
}

function renderApprovalCapsuleVerificationCommand(
  invocationItem: CommandInvocation,
  descriptor: AcoCommandDescriptor
): AcoCommandResultEnvelope {
  const context = compileContextPackage({ prompt: DEFAULT_CONTEXT_PROMPT });
  if (!context.ok) {
    return deniedCommandResult(descriptor.id, descriptor.display, context.issues.join('; '));
  }

  const capsule = buildApprovalCapsule({ contextPackage: context.value });
  if (!capsule.ok) {
    return deniedCommandResult(descriptor.id, descriptor.display, capsule.issues.join('; '));
  }

  const verification = verifyApprovalCapsule({
    capsule: capsule.value,
    expectedContext: context.value,
    expectedPrompt: DEFAULT_CONTEXT_PROMPT,
  });
  if (!verification.ok) {
    return deniedCommandResult(descriptor.id, descriptor.display, verification.issues.join('; '));
  }
  const outputMode = invocationItem.outputMode === 'json' ? 'json' : 'markdown';
  const stdout =
    outputMode === 'json'
      ? renderApprovalCapsuleVerificationJson(verification.value)
      : renderApprovalCapsuleVerificationMarkdown(verification.value);
  const badBehaviourLint = acoBadBehaviourLint([
    scopedArtifactWriteLintItem(),
    ...artifactContentBadBehaviourLintItems([
      {
        name:
          outputMode === 'json'
            ? 'approval-capsule-verification.json'
            : 'approval-capsule-verification.md',
        content: stdout,
      },
      { name: 'approval-capsule.json', content: renderApprovalCapsuleJson(capsule.value) },
      { name: 'context-package.json', content: renderCompiledContextPackageJson(context.value) },
    ]),
  ]);
  const dossier = invocationItem.args.writeArtifact
    ? writeAcoDossier({
        cwd: invocationItem.cwd ?? process.cwd(),
        runId: `aco-approval-capsule-verify-${Date.now()}`,
        commandId: descriptor.id,
        evidence: descriptor.evidence,
        artifacts: [
          {
            name:
              outputMode === 'json'
                ? 'approval-capsule-verification.json'
                : 'approval-capsule-verification.md',
            content: stdout,
            mediaType: outputMode === 'json' ? 'application/json' : 'text/markdown',
            schemaVersion: 'aco.approval-capsule-verification.v1',
          },
          {
            name: 'approval-capsule.json',
            content: renderApprovalCapsuleJson(capsule.value),
            mediaType: 'application/json',
            schemaVersion: 'aco.approval-capsule.v1',
          },
          {
            name: 'context-package.json',
            content: renderCompiledContextPackageJson(context.value),
            mediaType: 'application/json',
            schemaVersion: 'aco.context-package.v1',
          },
        ],
        extra: {
          verificationStatus: verification.value.status,
          capsuleId: verification.value.capsuleId,
          canGrantApproval: verification.value.canGrantApproval,
          badBehaviourLint,
        },
      })
    : null;

  return okCommandResult({
    descriptor,
    stdout: stdoutWithOptionalDossierNotice(stdout, dossier, outputMode),
    data: {
      verificationStatus: verification.value.status,
      capsuleId: verification.value.capsuleId,
      canGrantApproval: verification.value.canGrantApproval,
      issueCount: verification.value.issues.length,
      badBehaviourLint,
      ...(dossier
        ? {
            ...dossierResultData(dossier),
          }
        : {}),
    },
  });
}

function renderBootstrapCodex(invocationItem: CommandInvocation): AcoCommandResultEnvelope {
  const descriptor = descriptorOrThrow('archon.aco.bootstrap-codex');
  const event = stringArg(invocationItem.args.event, 'Unknown');
  const format = invocationItem.args.format === 'json' ? 'json' : 'markdown';
  const input = defaultCodexBootstrapInput();
  const normalizedEvent = normalizeCodexEvent(event);
  const bundle = buildCodexBootstrapArtifacts({
    ...input,
    id: 'aco.cli.bootstrap-codex.s7',
    goal: 'S7 CLI parity bootstrap-codex invocation',
    repository: {
      ...input.repository,
      repoPath: invocationItem.cwd ?? input.repository.repoPath,
    },
    event: {
      ...input.event,
      type: normalizedEvent,
      label: event,
      payloadContract: 'S7 CLI adapter preserves event label; runtime payload is deferred',
    },
  });
  if (!bundle.ok) {
    return deniedCommandResult(descriptor.id, descriptor.display, bundle.issues.join('; '));
  }

  const artifactName =
    format === 'json' ? 'codex-bootstrap-context.json' : 'codex-bootstrap-capsule.md';
  const artifact = bundle.value.artifacts.find(item => item.name === artifactName);
  if (artifact === undefined) {
    return deniedCommandResult(descriptor.id, descriptor.display, `missing ${artifactName}`);
  }
  const badBehaviourLint = acoBadBehaviourLint([
    scopedArtifactWriteLintItem(),
    ...codexBootstrapBadBehaviourLintItems(bundle.value.artifacts),
    ...artifactContentBadBehaviourLintItems(bundle.value.artifacts),
  ]);

  const dossier = invocationItem.args.writeArtifact
    ? writeAcoDossier({
        cwd: invocationItem.cwd ?? process.cwd(),
        runId: `aco-bootstrap-codex-${Date.now()}`,
        commandId: descriptor.id,
        evidence: descriptor.evidence,
        artifacts: bundle.value.artifacts,
        extra: {
          event: normalizedEvent,
          format,
          selectedArtifact: artifact.name,
          badBehaviourLint,
        },
      })
    : null;

  return okCommandResult({
    descriptor,
    stdout: stdoutWithOptionalDossierNotice(artifact.content, dossier, format),
    data: {
      event: normalizedEvent,
      format,
      artifact: artifact.name,
      artifactCount: bundle.value.artifacts.length,
      badBehaviourLint,
      ...(dossier
        ? {
            ...dossierResultData(dossier),
          }
        : {}),
    },
  });
}

function renderGraphWaivers(
  invocationItem: CommandInvocation,
  descriptor: AcoCommandDescriptor
): AcoCommandResultEnvelope {
  const closure = buildGraphWaiverClosure();
  if (!closure.ok) {
    return deniedCommandResult(descriptor.id, descriptor.display, closure.issues.join('; '));
  }
  const stdout = renderGraphWaiverClosureJson(closure.value);
  const outputMode = invocationItem.outputMode;
  const badBehaviourLint = acoBadBehaviourLint([
    scopedArtifactWriteLintItem(),
    ...artifactContentBadBehaviourLintItems([
      { name: 'graph-waiver-closure.json', content: stdout },
      ...closure.value.artifacts.map(item => ({
        name: `artifacts/${item.path}`,
        content: JSON.stringify(item, null, 2),
      })),
    ]),
  ]);
  const dossier = invocationItem.args.writeArtifact
    ? writeAcoDossier({
        cwd: invocationItem.cwd ?? process.cwd(),
        runId: `aco-graph-waivers-${Date.now()}`,
        commandId: descriptor.id,
        evidence: descriptor.evidence,
        artifacts: [
          {
            name: 'graph-waiver-closure.json',
            content: stdout,
            mediaType: 'application/json',
            schemaVersion: 'aco.graph-waiver-closure.v1',
          },
          ...closure.value.artifacts.map(item => ({
            name: `artifacts/${item.path}`,
            content: JSON.stringify(item, null, 2),
            mediaType: 'application/json',
            schemaVersion: item.schemaVersion,
          })),
        ],
        extra: {
          status: closure.value.status,
          graphRefs: closure.value.graphRefs.length,
          artifactMetadata: closure.value.artifacts.length,
          badBehaviourLint,
        },
      })
    : null;

  return okCommandResult({
    descriptor,
    stdout: stdoutWithOptionalDossierNotice(stdout, dossier, outputMode),
    data: {
      status: closure.value.status,
      graphRefs: closure.value.graphRefs.length,
      artifactMetadata: closure.value.artifacts.length,
      badBehaviourLint,
      ...(dossier
        ? {
            ...dossierResultData(dossier),
          }
        : {}),
    },
  });
}

function renderAcoStatusMarkdown(cwd: string): string {
  const catalog = buildCatalogOrThrow();
  const supported = catalog.descriptors.filter(
    descriptor => descriptor.implementationStatus === 'supported'
  ).length;
  const deferred = catalog.descriptors.filter(
    descriptor => descriptor.implementationStatus === 'deferred'
  ).length;
  const approvalRequired = catalog.descriptors.filter(
    descriptor => descriptor.implementationStatus === 'approval-required'
  ).length;

  return [
    '# ACO CLI Status',
    '',
    `cwd: ${cwd}`,
    `schemaVersion: ${catalog.schemaVersion}`,
    `commands: ${catalog.descriptors.length}`,
    `supported: ${supported}`,
    `deferred: ${deferred}`,
    `approvalRequired: ${approvalRequired}`,
    '',
    'S8 exposes context parity through @archon/aco-context and thin CLI adapters.',
    '',
  ].join('\n');
}

function statusData(cwd: string): Readonly<Record<string, JsonValue>> {
  const catalog = buildCatalogOrThrow();
  return {
    cwd,
    schemaVersion: catalog.schemaVersion,
    commands: catalog.descriptors.length,
    supported: catalog.descriptors.filter(
      descriptor => descriptor.implementationStatus === 'supported'
    ).length,
    deferred: catalog.descriptors.filter(
      descriptor => descriptor.implementationStatus === 'deferred'
    ).length,
    approvalRequired: catalog.descriptors.filter(
      descriptor => descriptor.implementationStatus === 'approval-required'
    ).length,
  };
}

function resolveOutputMode(
  format: string | undefined,
  jsonMode: boolean
):
  | { readonly ok: true; readonly value: AcoCommandOutputMode }
  | { readonly ok: false; readonly result: AcoCommandResultEnvelope } {
  if (jsonMode) return { ok: true, value: 'json' };
  if (format === undefined) return { ok: true, value: 'markdown' };
  if (format === 'markdown' || format === 'json') return { ok: true, value: format };
  return {
    ok: false,
    result: deniedCommandResult(
      'aco.cli.format',
      'aco command format',
      'invalid --format; expected markdown or json'
    ),
  };
}

function shouldWriteArtifacts(options: AcoCliOptions): boolean {
  if (options.noWriteArtifact === true) return false;
  return true;
}

function invocation(
  commandId: AcoCommandId,
  cwd: string,
  argv: readonly string[],
  args: Readonly<Record<string, JsonValue>>,
  outputMode: AcoCommandOutputMode,
  requestedMutations: readonly CommandInvocation['requestedMutations'][number][] = []
): AcoResolution {
  return {
    ok: true,
    invocation: {
      commandId,
      argv,
      args,
      options: {},
      cwd,
      outputMode,
      requestedMutations,
      readonlyContext: true,
      approval: null,
    },
  };
}

function contextPromptInvocation(
  commandId: Extract<AcoCommandId, 'archon.context.compile' | 'archon.context.approval-capsule'>,
  cwd: string,
  positionals: readonly string[],
  outputMode: AcoCommandOutputMode,
  writeArtifact: boolean
): AcoResolution {
  const args = promptArgs(positionals, 2);
  if (args.prompt.length === 0) {
    const descriptor = descriptorOrThrow(commandId);
    return {
      ok: false,
      result: deniedCommandResult(descriptor.id, descriptor.display, 'missing required <prompt>'),
    };
  }
  return invocation(
    commandId,
    cwd,
    positionals,
    { ...args, writeArtifact },
    outputMode,
    artifactWriteMutations(writeArtifact)
  );
}

function artifactWriteMutations(
  writeArtifact: boolean
): readonly CommandInvocation['requestedMutations'][number][] {
  return writeArtifact ? ['writes-artifacts'] : ['read-only'];
}

function promptArgs(
  positionals: readonly string[],
  start: number
): Readonly<Record<string, string>> {
  return { prompt: positionals.slice(start).join(' ') };
}

function stringArg(value: JsonValue | undefined, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function stdoutWithOptionalDossierNotice(
  stdout: string,
  dossier: AcoDossierWriteResult | null,
  outputMode: AcoCommandOutputMode
): string {
  if (dossier === null || outputMode === 'json') return stdout;
  return [
    stdout,
    '',
    'ACO dossier written.',
    `Manifest: ${dossier.manifestPath}`,
    `Archive: ${dossier.zipPath}`,
    `Archive checksum: ${dossier.archiveChecksumPath}`,
  ].join('\n');
}

function dossierResultData(dossier: AcoDossierWriteResult): Record<string, JsonValue> {
  return {
    dossierDir: dossier.directory,
    manifestPath: dossier.manifestPath,
    archivePath: dossier.zipPath,
    archiveChecksumPath: dossier.archiveChecksumPath,
    artifactPolicyPath: dossier.requiredArtifactPaths.artifactPolicy,
    evidencePath: dossier.requiredArtifactPaths.evidence,
    nextGoal4000CharsPath: dossier.requiredArtifactPaths.nextGoal4000Chars,
    partyModeNotesPath: dossier.requiredArtifactPaths.partyModeNotes,
    badBehaviourLintPath: dossier.requiredArtifactPaths.badBehaviourLint,
    requiredArtifactPaths: {
      artifactPolicy: dossier.requiredArtifactPaths.artifactPolicy,
      evidence: dossier.requiredArtifactPaths.evidence,
      nextGoal4000Chars: dossier.requiredArtifactPaths.nextGoal4000Chars,
      partyModeNotes: dossier.requiredArtifactPaths.partyModeNotes,
      badBehaviourLint: dossier.requiredArtifactPaths.badBehaviourLint,
      manifest: dossier.requiredArtifactPaths.manifest,
      archive: dossier.requiredArtifactPaths.archive,
      archiveChecksum: dossier.requiredArtifactPaths.archiveChecksum,
    },
    artifactFiles: dossier.files,
  };
}

function descriptorOrThrow(id: AcoCommandId): AcoCommandDescriptor {
  const descriptor = commandDescriptorById(id);
  if (descriptor === undefined) throw new Error(`missing descriptor ${id}`);
  return descriptor;
}

function buildCatalogOrThrow(): AcoCommandCatalog {
  const catalog = buildCommandCatalog();
  if (!catalog.ok) throw new Error(catalog.issues.join('\n'));
  return catalog.value;
}

function normalizeCodexEvent(event: string): CodexBootstrapEventType {
  const match = codexBootstrapEventTypeValues.find(value => value === event);
  return match ?? 'Unknown';
}

function writeResult(result: AcoCommandResultEnvelope, outputMode: AcoCommandOutputMode): number {
  if (outputMode === 'json') {
    console.log(renderCliResultJson(result).trimEnd());
  } else {
    if (result.stdout.length > 0) console.log(result.stdout.trimEnd());
    if (result.stderr.length > 0) console.error(result.stderr);
    const badBehaviourLint = formatAcoBadBehaviourLint(result.data.badBehaviourLint);
    if (badBehaviourLint) {
      if (result.status === 'ok') {
        console.log(badBehaviourLint);
      } else {
        console.error(badBehaviourLint);
      }
    }
  }
  return result.exitCode;
}

interface AcoBadBehaviourLintItem {
  readonly pattern: string;
  readonly classification: 'intentional' | 'warning-only' | 'bug';
  readonly rationale: string;
}

function acoBadBehaviourLint(items: readonly (AcoBadBehaviourLintItem | null)[]): JsonValue {
  const present = items.filter((item): item is AcoBadBehaviourLintItem => item !== null);
  if (present.length === 0) return null;
  const deduped = Array.from(
    new Map(
      present.map(item => [`${item.pattern}:${item.classification}:${item.rationale}`, item])
    ).values()
  );
  if (deduped.length === 1) return deduped[0] as unknown as JsonValue;
  return deduped as unknown as JsonValue;
}

function scopedArtifactWriteLintItem(): AcoBadBehaviourLintItem {
  return {
    pattern: 'writes_artifacts_scoped',
    classification: 'intentional',
    rationale:
      'The command writes only a scoped dossier under the artifact root; this is not an arbitrary checkout mutation.',
  };
}

function deferredItemsLintItem(count: number): AcoBadBehaviourLintItem | null {
  if (count <= 0) return null;
  return {
    pattern: 'deferred_behavior',
    classification: 'warning-only',
    rationale: `The context package surfaced ${String(count)} deferred item(s) explicitly instead of silently pretending they executed.`,
  };
}

function codexBootstrapBadBehaviourLintItems(
  artifacts: readonly { readonly name: string; readonly content: string }[]
): AcoBadBehaviourLintItem[] {
  const capabilityReport = artifacts.find(
    artifact => artifact.name === 'codex-harness-capability-report.json'
  );
  if (capabilityReport === undefined) return [];
  try {
    const parsed = JSON.parse(capabilityReport.content) as {
      summary?: {
        unsupported?: number;
        unknown?: number;
        deferred_by_design?: number;
      };
    };
    const summary = parsed.summary ?? {};
    const items: AcoBadBehaviourLintItem[] = [];
    if ((summary.unsupported ?? 0) > 0) {
      items.push({
        pattern: 'unsupported_ignored',
        classification: 'warning-only',
        rationale: `The Codex bootstrap capability report explicitly marks ${String(summary.unsupported)} unsupported runtime surface(s); contractOnly prevents silently claiming support.`,
      });
    }
    if ((summary.unknown ?? 0) > 0) {
      items.push({
        pattern: 'unknown_capability',
        classification: 'warning-only',
        rationale: `The Codex bootstrap capability report explicitly marks ${String(summary.unknown)} unknown runtime capability surface(s).`,
      });
    }
    if ((summary.deferred_by_design ?? 0) > 0) {
      items.push({
        pattern: 'deferred_behavior',
        classification: 'intentional',
        rationale: `The Codex bootstrap capability report explicitly marks ${String(summary.deferred_by_design)} surface(s) deferred_by_design.`,
      });
    }
    return items;
  } catch {
    return [
      {
        pattern: 'bad_behaviour_lint_parse_failed',
        classification: 'bug',
        rationale:
          'The Codex bootstrap capability report could not be parsed for unsupported/unknown/deferred classification.',
      },
    ];
  }
}

function artifactContentBadBehaviourLintItems(
  artifacts: readonly { readonly name: string; readonly content: string }[]
): AcoBadBehaviourLintItem[] {
  const combined = artifacts
    .map(artifact => `${artifact.name}\n${artifact.content}`)
    .join('\n')
    .toLowerCase();
  const items: AcoBadBehaviourLintItem[] = [];

  if (/\bsilent(?:ly)?\b|\bsilenced\b/.test(combined)) {
    items.push({
      pattern: 'silent_behavior',
      classification: 'warning-only',
      rationale:
        'Artifact content mentions silent behavior; the dossier surfaces it explicitly so it is not hidden from operators.',
    });
  }

  if (
    /\bignore(?:d|s|ing)?\b|\bskip(?:s|ped|ping)?\b|\bdrop(?:s|ped|ping)?\b|\bstrip(?:s|ped|ping)?\b|\bbypass(?:ed|es|ing)?\b/.test(
      combined
    )
  ) {
    items.push({
      pattern: 'ignored_control',
      classification: 'bug',
      rationale:
        'Artifact content mentions ignored, skipped, dropped, stripped, or bypassed behavior; user-facing safety/output controls must fail closed or be classified as intentional.',
    });
  }

  if (/\bbest[-_ ]effort\b|\bdegraded\b|\bdegradation\b/.test(combined)) {
    items.push({
      pattern: 'best_effort_surface',
      classification: 'warning-only',
      rationale:
        'Artifact content mentions best-effort or degraded behavior; this must stay diagnostic-visible rather than looking fully persisted or enforced.',
    });
  }

  if (
    /\bwarning[-_ ]only\b|\badvisory[-_ ]only\b|\badvisory(?:[-_ ]model)?[-_ ]controls?\b/.test(
      combined
    )
  ) {
    items.push({
      pattern: 'warning_only_control',
      classification: 'bug',
      rationale:
        'Artifact content mentions warning-only, advisory-only, or advisory-control behavior; user-facing safety/output controls must fail closed or be implemented.',
    });
  }

  if (/\bno[-_ ]?op\b|\bnoop\b/.test(combined)) {
    items.push({
      pattern: 'noop_behavior',
      classification: 'bug',
      rationale:
        'Artifact content mentions no-op behavior; requested safety/output controls must not appear accepted while doing nothing.',
    });
  }

  if (/\bfail[-_ ]open\b|\bfails? open\b/.test(combined)) {
    items.push({
      pattern: 'fail_open_behavior',
      classification: 'bug',
      rationale:
        'Artifact content mentions fail-open behavior; safety-critical controls must fail closed or be explicitly classified as intentional.',
    });
  }

  if (/\bfail[-_ ]closed\b|\bfails? closed\b/.test(combined)) {
    items.push({
      pattern: 'fail_closed_enforcement',
      classification: 'intentional',
      rationale:
        'Artifact content mentions fail-closed behavior; this is the intended enforcement posture for unsupported safety/output/resource controls.',
    });
  }

  if (
    /\bunsupported\b|\bnot supported\b|\bunavailable\b|\bnot available\b|\bunobservable\b|\bnot observable\b|\bnot[-_ ]streamed\b|\bnot[-_ ]streaming\b/.test(
      combined
    ) &&
    /\b(safety|privacy|output|resource|sandbox|approval|approval[-_ ]policy|permission|permission[-_ ]mode|bypass[-_ ]permissions|hook|hooks|tool[-_ ]restriction|tool[-_ ]restrictions|allowed[-_ ]tools?|denied[-_ ]tools?|mcp|skill|skills|output[-_ ]format|structured[-_ ]output)\b/.test(
      combined
    )
  ) {
    items.push({
      pattern: 'unsupported_control',
      classification: 'bug',
      rationale:
        'Artifact content mentions unsupported safety/output/resource controls; these must fail validation or runtime dispatch rather than degrade to warning-only behavior.',
    });
  }

  if (
    /\bunsupported\b|\bnot supported\b|\bunavailable\b|\bnot available\b|\bunobservable\b|\bnot observable\b|\bnot[-_ ]streamed\b|\bnot[-_ ]streaming\b/.test(
      combined
    )
  ) {
    items.push({
      pattern: 'unsupported_ignored',
      classification: 'warning-only',
      rationale:
        'Artifact content mentions unsupported, unavailable, unobservable, or not-streamed behavior; unsupported surfaces must be explicit in the dossier instead of silently implied as available.',
    });
  }

  if (
    /\bdeferred\b|\bdefer(?:s|red|ring)?\b|\bnot[-_ ]implemented\b|\bunimplemented\b/.test(combined)
  ) {
    items.push({
      pattern: 'deferred_behavior',
      classification: 'warning-only',
      rationale:
        'Artifact content mentions deferred behavior; deferred work must be visible in the dossier instead of appearing completed.',
    });
  }

  if (/\bdenied[-_ ]before[-_ ]write\b/.test(combined)) {
    items.push({
      pattern: 'denied_before_write',
      classification: 'intentional',
      rationale:
        'Artifact content mentions denied-before-write behavior; this is acceptable only when unsafe mutations are rejected before side effects.',
    });
  }

  return items;
}

export function lintAcoArtifactContentForBadBehaviour(
  artifacts: readonly { readonly name: string; readonly content: string }[]
): JsonValue {
  return acoBadBehaviourLint(artifactContentBadBehaviourLintItems(artifacts));
}

function formatAcoBadBehaviourLint(value: JsonValue | undefined): string | null {
  if (Array.isArray(value)) {
    const rendered = value
      .map(item => formatAcoBadBehaviourLint(item))
      .filter((item): item is string => item !== null);
    return rendered.length > 0 ? rendered.join('\n') : null;
  }
  if (!isJsonObject(value)) return null;
  const pattern = typeof value.pattern === 'string' ? value.pattern : undefined;
  const classification =
    typeof value.classification === 'string' ? value.classification : undefined;
  const rationale = typeof value.rationale === 'string' ? value.rationale : undefined;
  if (!pattern || !classification || !rationale) return null;
  return `bad-behaviour: ${pattern} (${classification}) - ${rationale}`;
}

function isJsonObject(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
