import { join, resolve } from 'path';
import { createAcceptancePlan } from './acceptance';
import { routeBmad } from './bmad';
import { applyCavemanPolicy } from './caveman';
import { selectCapabilities } from './capabilities';
import { planDocumentation } from './docs';
import { getGraphContext } from './graph';
import {
  prepareArchiveDirectory,
  redactSecrets,
  validateSafeRunId,
  writeFileNoFollow,
} from './security';
import { validateContextOrchestrator } from './validation';
import type {
  CavemanMode,
  CompilePromptPackageOptions,
  PromptPackage,
  PromptPackageResult,
} from './types';

const archiveFiles = [
  'manifest.json',
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
  const runId = validateSafeRunId(options.runId ?? `aco-${crypto.randomUUID()}`);
  const timestamp = options.timestamp ?? new Date().toISOString();
  const cavemanMode: CavemanMode = options.cavemanMode ?? 'lite';
  const archiveRoot = resolve(
    options.archiveRoot ?? join(options.cwd, '.archon/artifacts/context-orchestrator')
  );
  const archivePath = await prepareArchiveDirectory(archiveRoot, runId);

  const redactedPrompt = redactSecrets(options.prompt);
  const graphContext = await getGraphContext({ cwd: options.cwd });
  const documentationPlan = planDocumentation({ prompt: options.prompt });
  const bmadRoute = routeBmad({ prompt: options.prompt });
  const acceptancePlan = createAcceptancePlan({ prompt: options.prompt, route: bmadRoute });
  const selectedCapabilities = selectCapabilities({ graphContext, documentationPlan });
  const validationReport = await validateContextOrchestrator({ cwd: options.cwd });
  const intent = inferIntent(options.prompt);
  const securityConstraints = [
    'Do not read target repo .env files.',
    'Do not archive secrets.',
    'Do not interpolate raw prompt text into shell commands.',
    'Fail closed on path traversal.',
  ];
  const unknowns = [
    ...documentationPlan.unresolved.map(item => `Unresolved Context7 library ID: ${item}`),
    ...(graphContext.waiverCount > 0 ? [`Graph waivers: ${graphContext.waiverCount}`] : []),
  ];
  const humanPrompt = renderHumanPrompt(redactedPrompt, bmadRoute.steps);
  const codexPrompt = renderCodexPrompt(redactedPrompt, bmadRoute.steps);
  const promptPackage: PromptPackage = {
    runId,
    timestamp,
    originalPrompt: redactedPrompt,
    targetCodebase: options.cwd,
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
  };

  const files = Object.fromEntries(archiveFiles.map(file => [file, join(archivePath, file)]));

  await writeArchiveFiles(archivePath, files, promptPackage);

  return {
    package: promptPackage,
    archivePath,
    files,
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

function renderCodexPrompt(prompt: string, steps: string[]): string {
  return [
    '# Codex Prompt',
    '',
    'Use SDD and ATDD before production code.',
    '',
    'First create or update specs. Then define acceptance scenarios. Only then implement.',
    '',
    'Follow this BMAD route:',
    '',
    steps.map(step => `- ${step}`).join('\n'),
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
    intent: promptPackage.intent,
    graphStatus: promptPackage.graphContext.status,
    bmadRoute: promptPackage.bmadRoute.id,
    acceptanceStatus: promptPackage.acceptancePlan.status,
    validationStatus: promptPackage.validationReport.status,
    nextArchonCommand: promptPackage.nextArchonCommand,
  };
}

function renderFinalPackage(promptPackage: PromptPackage): string {
  return [
    '# Final Prompt Package',
    '',
    `Run ID: ${promptPackage.runId}`,
    `Target: ${promptPackage.targetCodebase}`,
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
