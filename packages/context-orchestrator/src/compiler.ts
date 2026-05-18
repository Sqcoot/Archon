import { join, resolve } from 'path';
import { createAcceptancePlan } from './acceptance';
import { routeBmad } from './bmad';
import { applyCavemanPolicy } from './caveman';
import { selectCapabilities } from './capabilities';
import { createDecisionDossier, renderDecisionDossierMarkdown } from './decision-dossier';
import { planDocumentation } from './docs';
import { getGraphContext } from './graph';
import { createContextIntent } from './intent';
import {
  buildLedgerBundle,
  renderCommandsLedgerMarkdown,
  renderToolAvailabilityLedgerMarkdown,
  serializeCommandsLedger,
  serializeLedgerBundle,
  serializeToolAvailabilityLedger,
} from './ledgers';
import { writeArchivedPolicyDecision } from './policy-decision';
import {
  prepareArchiveDirectory,
  redactSecrets,
  validateSafeRunId,
  writeFileNoFollow,
} from './security';
import { withAcoSpan } from './telemetry';
import { validateContextOrchestrator } from './validation';
import type { AcoSpanAttributes } from './telemetry';
import type {
  CavemanMode,
  CompilePromptPackageOptions,
  PromptPackage,
  PromptPackagePolicyArtifact,
  PromptPackagePolicyInput,
  PromptPackageResult,
} from './types';

const archiveFiles = [
  'manifest.json',
  'prompt-package.json',
  'policy-decision.json',
  'decision-dossier.json',
  'decision-dossier.md',
  'tool-availability-ledger.json',
  'tool-availability-ledger.md',
  'commands-ledger.json',
  'commands-ledger.md',
  'original-prompt.md',
  'user-prompt.md',
  'codex-prompt.md',
  'final-prompt-package.md',
  'route-report.md',
  'graph-summary.md',
  'graph-evidence.json',
  'docs-plan.md',
  'docs-evidence.json',
  'bmad-route.md',
  'acceptance-plan.md',
  'capability-route.json',
  'caveman-policy.md',
  'validation-report.md',
];

export async function compilePromptPackage(
  options: CompilePromptPackageOptions
): Promise<PromptPackageResult> {
  return withAcoSpan('archon.aco.compile', { 'archon.aco.operation': 'compile' }, async span => {
    const result = await compilePromptPackageWithoutTelemetry(options);
    span.setAttributes(toCompileSpanAttributes(result));
    return result;
  });
}

async function compilePromptPackageWithoutTelemetry(
  options: CompilePromptPackageOptions
): Promise<PromptPackageResult> {
  const runId = validateSafeRunId(options.runId ?? `aco-${crypto.randomUUID()}`);
  const timestamp = options.timestamp ?? new Date().toISOString();
  const cavemanMode: CavemanMode = options.cavemanMode ?? 'lite';
  const archiveRoot = resolve(
    options.archiveRoot ?? join(options.cwd, '.archon/artifacts/context-orchestrator')
  );
  const archivePath = await prepareArchiveDirectory(archiveRoot, runId);

  const redactedPrompt = redactSecrets(options.prompt);
  const contextIntent = await createContextIntent({
    cwd: options.cwd,
    objective: options.prompt,
    timestamp,
  });
  const graphContext = await getGraphContext({ cwd: options.cwd });
  const documentationPlan = planDocumentation({ prompt: options.prompt });
  const bmadRoute = routeBmad({ prompt: options.prompt });
  const acceptancePlan = createAcceptancePlan({ prompt: options.prompt, route: bmadRoute });
  const selectedCapabilities = selectCapabilities({ graphContext, documentationPlan });
  const validationReport = await validateContextOrchestrator({ cwd: options.cwd });
  const ledgerBundle = await buildLedgerBundle({
    cwd: options.cwd,
    objective: options.prompt,
    timestamp,
    contextIntent,
    graphContext,
    documentationPlan,
    bmadRoute,
    acceptancePlan,
    selectedCapabilities,
    validationReport,
  });
  const decisionDossier = await createDecisionDossier({
    cwd: options.cwd,
    prompt: options.prompt,
    timestamp,
    graphContext,
    documentationPlan,
    bmadRoute,
    acceptancePlan,
    selectedCapabilities,
    validationReport,
    ledgerBundle,
    contextIntent,
  });
  const intent = inferIntent(options.prompt);
  const securityConstraints = [
    'Do not read target repo .env files.',
    'Do not archive secrets.',
    'Do not interpolate raw prompt text into shell commands.',
    'Fail closed on path traversal.',
  ];
  const unknowns = [
    ...documentationPlan.unresolved.map(item => `Unresolved Context7 library ID: ${item}`),
    ...(graphContext.waiverCount > 0
      ? [
          `Graph waivers: ${graphContext.waiverCount} (${graphContext.waivers
            .map(waiver => waiver.id)
            .join(', ')})`,
        ]
      : []),
  ];
  const humanPrompt = renderHumanPrompt(redactedPrompt, bmadRoute.steps);
  const codexPrompt = renderCodexPrompt(redactedPrompt, bmadRoute.steps, decisionDossier);
  const promptPackage: PromptPackage = {
    runId,
    timestamp,
    originalPrompt: redactedPrompt,
    targetCodebase: options.cwd,
    contextIntent,
    intent,
    evidenceSummary: graphContext.summary,
    graphContext,
    documentationPlan,
    bmadRoute,
    acceptancePlan,
    selectedCapabilities,
    cavemanPolicy: {
      mode: cavemanMode,
      preservedArtifacts: ['code', 'json', 'yaml', 'toml', 'commands', 'paths', 'urls'],
    },
    securityConstraints,
    unknowns,
    humanPrompt: applyCavemanPolicy(humanPrompt, cavemanMode),
    codexPrompt,
    nextArchonCommand: [
      'bun',
      'run',
      'cli',
      'context',
      'compile',
      '--cwd',
      options.cwd,
      '--',
      redactedPrompt,
    ],
    validationReport,
    ledgerBundle,
    decisionDossier,
  };

  const files = Object.fromEntries(archiveFiles.map(file => [file, join(archivePath, file)]));

  await writeArchiveFiles(archivePath, files, promptPackage);

  return {
    package: promptPackage,
    archivePath,
    files,
  };
}

function toCompileSpanAttributes(result: PromptPackageResult): AcoSpanAttributes {
  const promptPackage = result.package;
  const validationChecks = promptPackage.validationReport.checks;
  return {
    'archon.aco.bmad.route': promptPackage.bmadRoute.id,
    'archon.aco.graph.repositories.count': promptPackage.graphContext.repositories.length,
    'archon.aco.graph.waivers.count': promptPackage.graphContext.waiverCount,
    'archon.aco.graph.nodes.count': promptPackage.graphContext.repositories.reduce(
      (total, repository) => total + repository.nodes,
      0
    ),
    'archon.aco.graph.edges.count': promptPackage.graphContext.repositories.reduce(
      (total, repository) => total + repository.edges,
      0
    ),
    'archon.aco.docs.targets.count': promptPackage.documentationPlan.targets.length,
    'archon.aco.docs.unresolved.count': promptPackage.documentationPlan.unresolved.length,
    'archon.aco.capabilities.selected.count':
      promptPackage.selectedCapabilities.capabilities.length,
    'archon.aco.acceptance.scenarios.count': promptPackage.acceptancePlan.scenarios.length,
    'archon.aco.validation.passed': promptPackage.validationReport.status === 'passed',
    'archon.aco.validation.failed.count': validationChecks.filter(
      check => check.status === 'failed'
    ).length,
    'archon.aco.policy.passed': validationChecks.some(
      check => check.id === 'aco-policy' && check.status === 'passed'
    ),
    'archon.aco.traceability.passed': validationChecks.some(
      check => check.id === 'aco-traceability' && check.status === 'passed'
    ),
    'archon.aco.archive.files.count': Object.keys(result.files).length,
  };
}

function inferIntent(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes('implement')) return 'implementation-planning';
  if (lower.includes('validate')) return 'validation';
  if (lower.includes('review')) return 'review-planning';
  return 'context-orchestration';
}

function renderHumanPrompt(prompt: string, steps: string[]): string {
  return [
    '# ACO Human Prompt',
    '',
    '## Original Request',
    '',
    prompt,
    '',
    '## BMAD Route',
    '',
    steps.map(step => `- ${step}`).join('\n'),
  ].join('\n');
}

function renderCodexPrompt(
  prompt: string,
  steps: string[],
  decisionDossier: PromptPackage['decisionDossier']
): string {
  const codexGoalCommand = `/goal ${decisionDossier.nextGoalObjective}`;
  return [
    '# Codex Prompt',
    '',
    'Use SDD and ATDD before production code.',
    '',
    'First create or update specs. Then define acceptance scenarios. Only then implement.',
    '',
    '## Codex Goal Handoff',
    '',
    'Optional: if Codex `features.goals` is enabled, set this session goal before implementation:',
    '',
    codexGoalCommand,
    '',
    'This is a Codex session control only; do not store it in Archon state.',
    '',
    'Follow this BMAD route:',
    '',
    steps.map(step => `- ${step}`).join('\n'),
    '',
    'Ledger requirements:',
    '',
    '- Read `tool-availability-ledger.json` and `commands-ledger.json` before implementation.',
    '- Use ledger statuses to select validation gates.',
    '- Avoid commands marked `forbidden`.',
    '- Ask for approval or avoid commands marked approval-required.',
    '- Treat `blocked`, `partial`, and `unknown` rows as confidence constraints.',
    '- Cite ledger evidence when explaining implementation and validation choices.',
    '',
    'Decision dossier requirements:',
    '',
    '- Read `decision-dossier.json` before implementation.',
    '- Use `nextPlanPrompt` as the current handoff source.',
    '- Preserve active graph waivers and approval-required state exactly.',
    '- Do not run approval commands unless the user explicitly approves them.',
    '',
    'Original request:',
    '',
    prompt,
  ].join('\n');
}

async function writeArchiveFiles(
  archivePath: string,
  files: Record<string, string>,
  promptPackage: PromptPackage
): Promise<void> {
  await writeFileNoFollow(
    archivePath,
    files['manifest.json'],
    `${JSON.stringify(toManifest(promptPackage), null, 2)}\n`
  );
  await writeFileNoFollow(
    archivePath,
    files['prompt-package.json'],
    `${JSON.stringify(toPolicyInput(promptPackage), null, 2)}\n`
  );
  const policyDecision = await writeArchivedPolicyDecision({
    archivePath,
    inputPath: files['prompt-package.json'],
    outputPath: files['policy-decision.json'],
  });
  if (!policyDecision.decision.allow) {
    const denyCodes = policyDecision.codes.deny.join(', ') || 'unknown';
    throw new Error(`ACO prompt-package policy denied archive admission: ${denyCodes}`);
  }
  await writeFileNoFollow(
    archivePath,
    files['decision-dossier.json'],
    `${JSON.stringify(promptPackage.decisionDossier, null, 2)}\n`
  );
  await writeFileNoFollow(
    archivePath,
    files['decision-dossier.md'],
    `${renderDecisionDossierMarkdown(promptPackage.decisionDossier)}\n`
  );
  await writeFileNoFollow(
    archivePath,
    files['tool-availability-ledger.json'],
    `${JSON.stringify(serializeToolAvailabilityLedger(promptPackage.ledgerBundle), null, 2)}\n`
  );
  await writeFileNoFollow(
    archivePath,
    files['tool-availability-ledger.md'],
    `${renderToolAvailabilityLedgerMarkdown(promptPackage.ledgerBundle.toolAvailability)}\n`
  );
  await writeFileNoFollow(
    archivePath,
    files['commands-ledger.json'],
    `${JSON.stringify(serializeCommandsLedger(promptPackage.ledgerBundle), null, 2)}\n`
  );
  await writeFileNoFollow(
    archivePath,
    files['commands-ledger.md'],
    `${renderCommandsLedgerMarkdown(promptPackage.ledgerBundle.commands)}\n`
  );
  await writeFileNoFollow(
    archivePath,
    files['original-prompt.md'],
    `${promptPackage.originalPrompt}\n`
  );
  await writeFileNoFollow(archivePath, files['user-prompt.md'], `${promptPackage.humanPrompt}\n`);
  await writeFileNoFollow(archivePath, files['codex-prompt.md'], `${promptPackage.codexPrompt}\n`);
  await writeFileNoFollow(
    archivePath,
    files['final-prompt-package.md'],
    `${renderFinalPackage(promptPackage)}\n`
  );
  await writeFileNoFollow(
    archivePath,
    files['route-report.md'],
    `${renderRouteReport(promptPackage)}\n`
  );
  await writeFileNoFollow(
    archivePath,
    files['graph-summary.md'],
    `${renderGraphSummary(promptPackage)}\n`
  );
  await writeFileNoFollow(
    archivePath,
    files['graph-evidence.json'],
    `${JSON.stringify(promptPackage.graphContext, null, 2)}\n`
  );
  await writeFileNoFollow(archivePath, files['docs-plan.md'], `${renderDocsPlan(promptPackage)}\n`);
  await writeFileNoFollow(
    archivePath,
    files['docs-evidence.json'],
    `${JSON.stringify(promptPackage.documentationPlan, null, 2)}\n`
  );
  await writeFileNoFollow(
    archivePath,
    files['bmad-route.md'],
    `${renderBmadRoute(promptPackage)}\n`
  );
  await writeFileNoFollow(
    archivePath,
    files['acceptance-plan.md'],
    `${renderAcceptancePlan(promptPackage)}\n`
  );
  await writeFileNoFollow(
    archivePath,
    files['capability-route.json'],
    `${JSON.stringify(promptPackage.selectedCapabilities, null, 2)}\n`
  );
  await writeFileNoFollow(
    archivePath,
    files['caveman-policy.md'],
    `${renderCavemanPolicy(promptPackage)}\n`
  );
  await writeFileNoFollow(
    archivePath,
    files['validation-report.md'],
    `${renderValidationReport(promptPackage)}\n`
  );
}

function toManifest(promptPackage: PromptPackage): Record<string, unknown> {
  return {
    runId: promptPackage.runId,
    timestamp: promptPackage.timestamp,
    targetCodebase: promptPackage.targetCodebase,
    contextIntent: promptPackage.contextIntent,
    intentHash: promptPackage.contextIntent.intentHash,
    intent: promptPackage.intent,
    graphStatus: promptPackage.graphContext.status,
    graphWaivers: promptPackage.graphContext.waiverCount,
    graphWaiverIds: promptPackage.graphContext.waivers.map(waiver => waiver.id),
    bmadRoute: promptPackage.bmadRoute.id,
    acceptanceStatus: promptPackage.acceptancePlan.status,
    validationStatus: promptPackage.validationReport.status,
    ledgerSchemaVersion: promptPackage.ledgerBundle.schemaVersion,
    ledgerSummary: promptPackage.ledgerBundle.summary,
    ledgerArtifacts: [
      'tool-availability-ledger.json',
      'tool-availability-ledger.md',
      'commands-ledger.json',
      'commands-ledger.md',
    ],
    decisionDossierSchemaVersion: promptPackage.decisionDossier.schemaVersion,
    decisionDossierArtifacts: ['decision-dossier.json', 'decision-dossier.md'],
    nextArchonCommand: promptPackage.nextArchonCommand,
  };
}

function toPolicyInput(promptPackage: PromptPackage): PromptPackagePolicyInput {
  return {
    schema_version: 'aco.prompt-package.policy-input.v1',
    package_id: promptPackage.runId,
    generated_at: promptPackage.timestamp,
    source_request: {
      text: promptPackage.originalPrompt,
    },
    manifest: {
      ...toManifest(promptPackage),
      schemaVersion: 'aco.prompt-package.policy-input.v1',
      specs: [
        'docs/context-orchestrator/specs/008-prompt-package-spec.md',
        'docs/context-orchestrator/specs/025-goal-bound-evidence-gate-spec.md',
        'docs/context-orchestrator/specs/021-opa-prompt-package-policy-spec.md',
      ],
      upstreamManifest: 'docs/context-orchestrator/research/upstream-manifest.json',
    },
    artifacts: toPolicyArtifacts(),
    evidence: {
      graph: promptPackage.graphContext as unknown as Record<string, unknown>,
      docs: promptPackage.documentationPlan as unknown as Record<string, unknown>,
      bmad: promptPackage.bmadRoute as unknown as Record<string, unknown>,
      acceptance: promptPackage.acceptancePlan as unknown as Record<string, unknown>,
      security: {
        constraints: promptPackage.securityConstraints,
        cavemanPolicy: promptPackage.cavemanPolicy,
        redaction: 'applied',
      },
      ledgers: serializeLedgerBundle(promptPackage.ledgerBundle) as unknown as Record<
        string,
        unknown
      >,
      decisionDossier: promptPackage.decisionDossier as unknown as Record<string, unknown>,
    },
    validation: promptPackage.validationReport as unknown as Record<string, unknown>,
  };
}

function toPolicyArtifacts(): PromptPackagePolicyArtifact[] {
  return archiveFiles
    .filter(file => file !== 'policy-decision.json')
    .map(file => ({
      id: file.replace(/\.[^.]+$/, ''),
      path: file,
      kind: file.endsWith('.json') ? 'json' : 'markdown',
    }));
}

function renderFinalPackage(promptPackage: PromptPackage): string {
  return [
    '# Final Prompt Package',
    '',
    `Run ID: ${promptPackage.runId}`,
    `Target: ${promptPackage.targetCodebase}`,
    `Intent: ${promptPackage.contextIntent.intentHash}`,
    `Objective: ${promptPackage.contextIntent.normalizedObjective}`,
    '',
    '## Specs',
    '',
    '- docs/context-orchestrator/specs/008-prompt-package-spec.md',
    '- docs/context-orchestrator/specs/016-acceptance-test-plan.md',
    '',
    '## Graph Status',
    '',
    promptPackage.graphContext.summary,
    '',
    '## Docs Plan',
    '',
    promptPackage.documentationPlan.targets
      .map(target => `- ${target.source}: ${target.topic} (${target.status})`)
      .join('\n'),
    '',
    '## BMAD Route',
    '',
    promptPackage.bmadRoute.steps.map(step => `- ${step}`).join('\n'),
    '',
    '## Acceptance Criteria',
    '',
    promptPackage.acceptancePlan.scenarios
      .map(scenario => `- ${scenario.id}: ${scenario.then}`)
      .join('\n'),
    '',
    '## Ledger Artifacts',
    '',
    '- tool-availability-ledger.json',
    '- tool-availability-ledger.md',
    '- commands-ledger.json',
    '- commands-ledger.md',
    '- decision-dossier.json',
    '- decision-dossier.md',
    '',
    '## Decision Dossier',
    '',
    `Decision: ${promptPackage.decisionDossier.decision.id}`,
    `Readiness: ${promptPackage.decisionDossier.readiness}`,
    `Graph: ${promptPackage.decisionDossier.graphStatus}`,
    `Approval required: ${promptPackage.decisionDossier.approvalRequired ? 'yes' : 'no'}`,
    `Evidence blockers: ${promptPackage.ledgerBundle.evidenceBlockers.length}`,
    '',
    '## Ledger Guidance',
    '',
    '- Read ledger JSON before implementing; Markdown is a derived human view.',
    '- Use ledger statuses to select validation gates.',
    '- Avoid commands marked `forbidden`.',
    '- Ask for approval or avoid commands marked approval-required.',
    '- Treat `blocked`, `partial`, and `unknown` as confidence constraints.',
    '- Cite ledger evidence when explaining implementation and validation choices.',
    '',
    '## Ledger Summary',
    '',
    renderLedgerSummary(promptPackage),
    '',
    '## Unknowns',
    '',
    promptPackage.unknowns.length > 0
      ? promptPackage.unknowns.map(item => `- ${item}`).join('\n')
      : '- none',
    '',
    '## Codex Prompt',
    '',
    promptPackage.codexPrompt,
  ].join('\n');
}

function renderLedgerSummary(promptPackage: PromptPackage): string {
  const summary = promptPackage.ledgerBundle.summary.combined;
  return [
    `Total rows: ${summary.total}`,
    ...Object.entries(summary.counts).map(([status, count]) => `- ${status}: ${count}`),
  ].join('\n');
}

function renderRouteReport(promptPackage: PromptPackage): string {
  return [
    '# Route Report',
    '',
    `Route: ${promptPackage.bmadRoute.id}`,
    '',
    promptPackage.bmadRoute.rationale,
  ].join('\n');
}

function renderGraphSummary(promptPackage: PromptPackage): string {
  return [
    '# Graph Summary',
    '',
    promptPackage.graphContext.summary,
    '',
    '## Waivers',
    '',
    promptPackage.graphContext.waivers.length > 0
      ? promptPackage.graphContext.waivers
          .map(
            waiver =>
              `- ${waiver.id}: ${waiver.repository}; owner=${waiver.owner}; reason=${waiver.reason}; expiry=${waiver.expiryCondition}`
          )
          .join('\n')
      : '- none',
    '',
    ...promptPackage.graphContext.repositories.map(
      repo => `- ${repo.name}: ${repo.graphStatus}, ${repo.nodes} nodes, ${repo.edges} edges`
    ),
  ].join('\n');
}

function renderDocsPlan(promptPackage: PromptPackage): string {
  return [
    '# Documentation Plan',
    '',
    ...promptPackage.documentationPlan.targets.map(
      target => `- ${target.source}: ${target.topic} (${target.status})`
    ),
  ].join('\n');
}

function renderBmadRoute(promptPackage: PromptPackage): string {
  return ['# BMAD Route', '', ...promptPackage.bmadRoute.steps.map(step => `- ${step}`)].join('\n');
}

function renderAcceptancePlan(promptPackage: PromptPackage): string {
  return [
    '# Acceptance Plan',
    '',
    ...promptPackage.acceptancePlan.scenarios.map(
      scenario =>
        `## ${scenario.id}\n\nSpec: ${scenario.spec}\n\nGiven ${scenario.given}\nWhen ${scenario.when}\nThen ${scenario.then}\n`
    ),
  ].join('\n');
}

function renderCavemanPolicy(promptPackage: PromptPackage): string {
  return [
    '# Caveman Policy',
    '',
    `Mode: ${promptPackage.cavemanPolicy.mode}`,
    '',
    'Preserve:',
    '',
    ...promptPackage.cavemanPolicy.preservedArtifacts.map(item => `- ${item}`),
  ].join('\n');
}

function renderValidationReport(promptPackage: PromptPackage): string {
  return [
    '# Validation Report',
    '',
    `Status: ${promptPackage.validationReport.status}`,
    '',
    ...promptPackage.validationReport.checks.map(
      check => `- ${check.id}: ${check.status} - ${check.message}`
    ),
  ].join('\n');
}
