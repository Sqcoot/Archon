#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { pathExists, repoRoot } from './common';

interface MarkdownSpec {
  path: string;
  title: string;
  purpose: string;
  scope: string;
  nonGoals: string[];
  genericBehavior: string[];
  archonBehavior: string[];
  inputs: string[];
  outputs: string[];
  knownUnknowns: string[];
  evidenceReferences: string[];
  acceptanceScenarios: string[];
  failureBehavior: string[];
  securityConstraints: string[];
  openQuestions: string[];
}

const specsDir = join(repoRoot, 'docs', 'context-orchestrator', 'specs');

const markdownSpecs: MarkdownSpec[] = [
  {
    path: '000-product-charter.md',
    title: '000 Product Charter',
    purpose: 'Define ACO product direction before implementation.',
    scope: 'ACO as an Archon-native, Codex-focused, generic capability orchestration subsystem.',
    nonGoals: [
      'Do not implement every Archon surface in MVP.',
      'Do not lock architecture before ADRs.',
    ],
    genericBehavior: [
      'Turn a user prompt plus evidence into a spec-backed prompt package.',
      'Keep core concepts generic: evidence, capabilities, docs plans, routes, acceptance plans, archives.',
    ],
    archonBehavior: [
      'Expose the selected MVP through at least one Archon-native surface.',
      'Use Archon artifacts and workflow events before considering database migrations.',
    ],
    inputs: [
      'user prompt',
      'target codebase',
      'graph evidence',
      'documentation evidence',
      'BMAD route',
    ],
    outputs: ['prompt package', 'acceptance plan', 'validation report', 'archive manifest'],
    knownUnknowns: [
      'first MVP surface',
      'package boundary',
      'whether workflow integration is in MVP',
    ],
    evidenceReferences: [
      'docs/context-orchestrator/research/graph-evidence-index.md',
      'docs/context-orchestrator/research/codex-official-docs.md',
    ],
    acceptanceScenarios: [
      'Given a user prompt and Archon codebase, when ACO compiles a package, then it includes evidence, docs plan, BMAD route, acceptance criteria, unknowns, and Codex prompt.',
    ],
    failureBehavior: [
      'Stop before implementation when required evidence or acceptance criteria are missing.',
    ],
    securityConstraints: [
      'Never archive target repo secrets.',
      'Never interpolate raw prompt text into shell commands.',
    ],
    openQuestions: ['Which Archon-native surface is first?', 'Which feature subset is MVP?'],
  },
  {
    path: '001-domain-glossary.md',
    title: '001 Domain Glossary',
    purpose: 'Define shared ACO language before model and contract work.',
    scope: 'Core domain terms used by specs, ADRs, tests, and implementation.',
    nonGoals: [
      'Do not freeze class names before architecture ADRs.',
      'Do not duplicate generated TypeScript types.',
    ],
    genericBehavior: [
      'Maintain stable meanings for PromptRequest, EvidencePacket, GraphContext, DocumentationPlan, BmadRoute, AcceptancePlan, PromptPackage, ArchiveArtifact, and ValidationReport.',
    ],
    archonBehavior: [
      'Map generic terms to Archon workflows, artifacts, commands, CLI, REST API, and events only at integration boundaries.',
    ],
    inputs: ['graph evidence', 'Archon docs', 'BMAD source', 'OpenAI docs', 'Context7 docs'],
    outputs: ['bounded-context glossary', 'domain object glossary'],
    knownUnknowns: ['final package/module names', 'which terms become public API'],
    evidenceReferences: ['docs/context-orchestrator/research/merged-ecosystem-report.md'],
    acceptanceScenarios: [
      'Given a spec uses a domain term, when the glossary is checked, then the term has one clear definition.',
    ],
    failureBehavior: [
      'Route terminology conflicts to assumption-evidence register and BMAD correct-course if architecture-affecting.',
    ],
    securityConstraints: ['Do not use glossary terms to hide security-sensitive behavior.'],
    openQuestions: ['Should CapabilityRoute and BmadRoute be separate objects?'],
  },
  {
    path: '002-capability-model.md',
    title: '002 Capability Model',
    purpose: 'Define generic capability routing before implementation.',
    scope: 'Capability registry, availability, route selection, and capability evidence.',
    nonGoals: [
      'Do not hardcode every future capability.',
      'Do not make Graphify or Context7 mandatory for all prompts.',
    ],
    genericBehavior: [
      'A Capability describes a named ability, requirements, optional dependencies, output contracts, and safety constraints.',
      'A CapabilityRoute selects only capabilities needed for the prompt.',
    ],
    archonBehavior: [
      'Archon adapters expose capabilities through chosen CLI, command, workflow, or API surfaces.',
      'Provider and workflow details stay outside the generic core.',
    ],
    inputs: ['prompt intent', 'graph readiness', 'docs readiness', 'BMAD route', 'user flags'],
    outputs: ['CapabilityRegistry', 'CapabilityRoute', 'selected capability report'],
    knownUnknowns: ['initial registry implementation host', 'runtime extension mechanism'],
    evidenceReferences: ['docs/context-orchestrator/research/graph-evidence-index.md'],
    acceptanceScenarios: [
      'Given a prompt does not need graph evidence, when ACO routes capabilities, then Graphify is optional-skipped instead of required.',
    ],
    failureBehavior: ['Unsupported required capabilities produce explicit blockers.'],
    securityConstraints: [
      'Capabilities must declare whether they can read files, write files, call tools, or emit prompts.',
    ],
    openQuestions: ['Should capabilities be data-only JSON or TypeScript objects in MVP?'],
  },
  {
    path: '003-evidence-model.md',
    title: '003 Evidence Model',
    purpose: 'Define how ACO records evidence before decisions.',
    scope: 'Evidence sources, packets, references, trust level, waivers, and unknowns.',
    nonGoals: [
      'Do not treat evidence as proof when it is indirect.',
      'Do not require all evidence for all routes.',
    ],
    genericBehavior: [
      'EvidencePacket records source, capture time, trust, summary, paths, and limitations.',
      'Waivers are explicit evidence gaps, not silent success.',
    ],
    archonBehavior: [
      'Archon stores evidence in artifacts for MVP and may emit workflow events for evidence milestones.',
    ],
    inputs: ['manifest', 'graph reports', 'docs MCP outputs', 'source files', 'validation output'],
    outputs: ['EvidencePacket', 'waiver records', 'open questions'],
    knownUnknowns: ['whether evidence JSON becomes public API', 'best traceability format'],
    evidenceReferences: [
      'docs/context-orchestrator/research/upstream-manifest.json',
      'docs/context-orchestrator/research/waivers.md',
    ],
    acceptanceScenarios: [
      'Given a required upstream graph fails, when evidence is indexed, then a waiver is recorded with status, reason, and path.',
    ],
    failureBehavior: ['Missing controlling evidence blocks architecture approval.'],
    securityConstraints: ['Evidence must not include secrets, `.env` values, or credentials.'],
    openQuestions: ['Should graph evidence be summarized per route or globally per run?'],
  },
  {
    path: '004-graph-context-spec.md',
    title: '004 Graph Context Spec',
    purpose: 'Define GraphContext and graph evidence use.',
    scope: 'Graphify modes, normalized graph summaries, merge behavior, waivers, and path safety.',
    nonGoals: [
      'Do not require Graphify for every ACO run.',
      'Do not make graph merge quality an architecture decision by itself.',
    ],
    genericBehavior: [
      'GraphContext summarizes repository graphs, graph status, node/edge counts, waivers, and open questions.',
      'Graph modes are auto, required, off, and fixture.',
    ],
    archonBehavior: [
      'Research graphs live under ignored `research/graphs/`; workflow archives use `$ARTIFACTS_DIR`.',
      'Graph scripts must not dirty upstream repositories.',
    ],
    inputs: ['upstream manifest', 'Graphify outputs', 'graph metadata', 'waivers'],
    outputs: ['GraphContext', 'graph evidence summary', 'merged ecosystem report'],
    knownUnknowns: ['whether deeper semantic Graphify extraction is needed for ADRs'],
    evidenceReferences: [
      'docs/context-orchestrator/research/graph-evidence-index.md',
      'docs/context-orchestrator/research/merged-ecosystem-report.md',
    ],
    acceptanceScenarios: [
      'Given Graphify fails for a non-controlling repo, when GraphContext is created, then status includes failed and waiverRequired=true.',
    ],
    failureBehavior: ['Graph mode required fails if graph outputs cannot be produced or waived.'],
    securityConstraints: ['Validate graph paths and keep outputs under approved artifact roots.'],
    openQuestions: ['Should graph evidence normalize `links` to `edges` in persisted JSON?'],
  },
  {
    path: '006-bmad-routing-spec.md',
    title: '006 BMAD Routing Spec',
    purpose: 'Define BMAD route selection for ACO.',
    scope:
      'Route catalog, brownfield route, quick route, correct-course route, and assumption-evidence gate.',
    nonGoals: [
      'Do not run BMAD skills automatically without user-visible route evidence.',
      'Do not skip PRD validation before architecture-sensitive work.',
    ],
    genericBehavior: [
      'BmadRoute contains route steps, rationale, assumptions, required gates, and fallback route.',
      'Architecture-sensitive brownfield work starts with context, documentation, research, PRD, validation, architecture, review, stories, readiness, sprint planning.',
    ],
    archonBehavior: [
      'Archon route summaries can be exposed through CLI, slash command, workflow, or API after ADR selection.',
    ],
    inputs: ['prompt intent', 'graph evidence', 'docs evidence', 'risk level', 'task size'],
    outputs: ['BmadRoute', 'assumption-evidence gate result', 'next BMAD skill'],
    knownUnknowns: [
      'exact local BMAD catalog availability in this repo',
      'whether custom assumption gate becomes a bundled workflow',
    ],
    evidenceReferences: ['docs/context-orchestrator/research/bmad-graph-report.md'],
    acceptanceScenarios: [
      'Given architecture-sensitive Archon work, when ACO routes the prompt, then PRD validation occurs before architecture and readiness before sprint planning.',
    ],
    failureBehavior: ['Blocked architecture-controlling assumptions trigger correct-course.'],
    securityConstraints: ['BMAD route output must not expose secrets or raw env values.'],
    openQuestions: ['Should route catalog be data-driven YAML or TypeScript constants in MVP?'],
  },
  {
    path: '008-prompt-package-spec.md',
    title: '008 Prompt Package Spec',
    purpose: 'Define the ACO prompt package.',
    scope: 'Prompt package fields, renderers, traceability, validation report, and Codex handoff.',
    nonGoals: ['Do not execute the prompt package automatically unless ADR selects that surface.'],
    genericBehavior: [
      'PromptPackage includes runId, timestamp, original prompt, target codebase, intent, evidence, GraphContext, DocumentationPlan, MCP readiness, BmadRoute, AcceptancePlan, capabilities, CavemanPolicy, security constraints, unknowns, human prompt, Codex prompt, next command, and validation report.',
    ],
    archonBehavior: [
      'Archive prompt packages under `$ARTIFACTS_DIR/context-orchestrator/<run-id>/` for workflow runs or selected equivalent artifact surface.',
    ],
    inputs: [
      'PromptRequest',
      'CapabilityRoute',
      'EvidencePacket',
      'DocumentationPlan',
      'BmadRoute',
      'AcceptancePlan',
    ],
    outputs: [
      'manifest.json',
      'final-prompt-package.md',
      'codex-prompt.md',
      'validation-report.md',
    ],
    knownUnknowns: ['final archive root for CLI-only MVP'],
    evidenceReferences: ['docs/context-orchestrator/specs/005-documentation-resolution-spec.md'],
    acceptanceScenarios: [
      'Given a compiled prompt package, when final-prompt-package.md is opened, then it references specs, acceptance criteria, graph status, docs plan, BMAD route, capabilities, and unknowns.',
    ],
    failureBehavior: ['Compilation fails if acceptance plan or security constraints are missing.'],
    securityConstraints: ['Redact secrets and validate all paths before writing.'],
    openQuestions: ['Should prompt package JSON schema live in a new package or server schemas?'],
  },
  {
    path: '009-archive-artifact-spec.md',
    title: '009 Archive Artifact Spec',
    purpose: 'Define archive files and path safety.',
    scope: 'Archive layout, manifest, deterministic tests, redaction, and workflow artifact paths.',
    nonGoals: ['Do not require database storage for MVP archives.'],
    genericBehavior: [
      'ArchiveArtifact stores named files, metadata, checks, redaction status, and validation results.',
    ],
    archonBehavior: [
      'Workflow archives use `$ARTIFACTS_DIR/context-orchestrator/<run-id>/`; CLI MVP may use an ADR-selected Archon-native artifact directory.',
    ],
    inputs: ['PromptPackage', 'runId', 'timestamp', 'artifact root'],
    outputs: ['archive directory', 'manifest.json', 'validation-report.md'],
    knownUnknowns: ['final CLI artifact root', 'whether retention policy belongs in MVP'],
    evidenceReferences: ['docs/context-orchestrator/specs/008-prompt-package-spec.md'],
    acceptanceScenarios: [
      'Given an archive path containing `..`, when archive writer validates it, then write is blocked.',
    ],
    failureBehavior: ['Fail closed on unsafe paths or redaction failures.'],
    securityConstraints: ['No `.env` values, token-like secrets, or path traversal.'],
    openQuestions: ['Should archives include hashes for every file in MVP?'],
  },
  {
    path: '011-command-contract.md',
    title: '011 Command Contract',
    purpose: 'Define slash command contract candidates.',
    scope: 'Potential `/context` commands, inputs, outputs, and errors.',
    nonGoals: ['Do not implement slash commands until ADR selects the surface.'],
    genericBehavior: [
      'Command contract maps user prompt to route, compile, docs, graph, accept, validate, and status operations.',
    ],
    archonBehavior: [
      'If selected, slash commands route through Archon command handler as deterministic top-level commands.',
    ],
    inputs: ['conversation id', 'command name', 'arguments', 'codebase context'],
    outputs: ['compact response', 'artifact paths', 'validation status'],
    knownUnknowns: ['whether slash command is MVP or phase two'],
    evidenceReferences: ['AGENTS.md', 'packages/core/src/handlers'],
    acceptanceScenarios: [
      'Given `/context compile <prompt>`, when slash command surface is selected, then output includes archive path and validation status.',
    ],
    failureBehavior: ['Unknown subcommands return explicit help and do not call AI.'],
    securityConstraints: ['Do not echo secrets or raw env values into chat responses.'],
    openQuestions: ['Should `/context` become a deterministic command or workflow shortcut first?'],
  },
  {
    path: '012-cli-contract.md',
    title: '012 CLI Contract',
    purpose: 'Define CLI contract candidates.',
    scope: '`archon context` commands, flags, JSON output, and validation behavior.',
    nonGoals: ['Do not implement CLI before ADR 0009 selects MVP surface.'],
    genericBehavior: [
      'CLI exposes route, compile, graph, docs, bmad, accept, validate, and status operations.',
    ],
    archonBehavior: [
      'Archon CLI command should live under `packages/cli/src/commands` if selected.',
    ],
    inputs: [
      '--cwd',
      'prompt',
      '--json',
      '--graph',
      '--docs',
      '--context7',
      '--openai-docs',
      '--caveman',
    ],
    outputs: ['human summary', 'JSON response', 'archive path', 'exit code'],
    knownUnknowns: ['whether CLI or workflow is first MVP'],
    evidenceReferences: ['packages/cli/src/commands/validate.ts', 'packages/cli/src/cli.ts'],
    acceptanceScenarios: [
      'Given `archon context compile --cwd . --json "prompt"`, when CLI surface is selected, then output is valid JSON and includes prompt package paths.',
    ],
    failureBehavior: ['Exit nonzero for blockers; include machine-readable error in JSON mode.'],
    securityConstraints: ['Do not print secrets in stdout/stderr.'],
    openQuestions: ['Should CLI command be available in binary builds for MVP?'],
  },
  {
    path: '014-workflow-contracts.md',
    title: '014 Workflow Contracts',
    purpose: 'Define candidate bundled workflow contracts.',
    scope:
      'context-orchestrate, context-sdd-atdd-implement, context-research, context-code-review, context-correct-course.',
    nonGoals: ['Do not create workflows before ADR selects workflow surface.'],
    genericBehavior: [
      'Workflow contracts compose route, graph, docs, bmad, accept, compile, validate, review, and archive stages.',
    ],
    archonBehavior: [
      'Workflows use `$ARGUMENTS`, `$USER_MESSAGE`, `$WORKFLOW_ID`, `$ARTIFACTS_DIR`, `$DOCS_DIR`, `$CONTEXT`, and node-output references.',
    ],
    inputs: ['workflow arguments', 'codebase context', 'artifact root'],
    outputs: ['workflow artifacts', 'workflow events', 'validation report'],
    knownUnknowns: ['which workflows are included in MVP'],
    evidenceReferences: [
      'packages/workflows/src/schemas/workflow.ts',
      '.archon/workflows/defaults',
    ],
    acceptanceScenarios: [
      'Given `context-orchestrate` workflow exists, when workflow validation runs, then validation passes before use.',
    ],
    failureBehavior: [
      'Workflow fails with explicit blocker when required spec or acceptance plan is missing.',
    ],
    securityConstraints: ['No raw prompt text in shell commands; no secrets in workflow events.'],
    openQuestions: ['Should context workflows be bundled defaults or repo-local examples first?'],
  },
  {
    path: '015-security-threat-model.md',
    title: '015 Security Threat Model',
    purpose: 'Define ACO security constraints.',
    scope:
      'Secrets, path traversal, prompt injection, docs/graph untrusted input, MCP config, archives, subprocess safety.',
    nonGoals: ['Do not claim sandboxing beyond what Archon/Codex provides.'],
    genericBehavior: [
      'ACO treats prompts, docs, and graph text as untrusted. It validates paths, redacts secrets, and fails closed on unsafe archives.',
    ],
    archonBehavior: ['Use Archon env isolation behavior; do not read target repo `.env` files.'],
    inputs: ['prompt text', 'graph text', 'docs text', 'target path', 'archive root'],
    outputs: ['security constraints', 'security validation report', 'blocker list'],
    knownUnknowns: ['exact redaction implementation', 'API surface redaction scope'],
    evidenceReferences: [
      'packages/docs-web/src/content/docs/reference/security.md',
      'docs/context-orchestrator/research/caveman-principles.md',
    ],
    acceptanceScenarios: [
      'Given target repo contains `.env` with `SECRET_TOKEN`, when ACO compiles a package, then `SECRET_TOKEN` appears in no archive, CLI output, or API output.',
    ],
    failureBehavior: ['Block on path traversal, secret leakage, or shell interpolation risk.'],
    securityConstraints: [
      'Never read target `.env`; never archive secrets; never interpolate prompt text into shell.',
    ],
    openQuestions: ['Should token redaction use shared Archon utility or ACO-local validator?'],
  },
  {
    path: '016-acceptance-test-plan.md',
    title: '016 Acceptance Test Plan',
    purpose: 'Define ATDD structure before implementation.',
    scope: 'Acceptance, contract, golden, integration, unit, and security tests for ACO.',
    nonGoals: ['Do not replace acceptance tests with unit-only coverage.'],
    genericBehavior: [
      'Acceptance tests define done; unit tests support implementation details only.',
    ],
    archonBehavior: [
      'Tests should fit Bun workspace isolation and avoid root `bun test`; use project scripts or isolated package commands.',
    ],
    inputs: ['spec IDs', 'acceptance IDs', 'feature stories', 'risk areas'],
    outputs: ['tests/acceptance/context-orchestrator/*', 'traceability matrix'],
    knownUnknowns: ['final test package location', 'whether CLI/API/workflow surfaces are MVP'],
    evidenceReferences: ['docs/context-orchestrator/research/bootstrap-acceptance-scenarios.md'],
    acceptanceScenarios: [
      'Given a production ACO feature, when acceptance tests are searched, then at least one acceptance scenario maps to its spec ID.',
    ],
    failureBehavior: [
      'Implementation readiness fails if acceptance tests are missing for selected MVP surface.',
    ],
    securityConstraints: [
      'Security acceptance tests must verify redaction and path traversal behavior.',
    ],
    openQuestions: ['Should acceptance tests live in root tests or package-local tests?'],
  },
  {
    path: '017-implementation-discovery-protocol.md',
    title: '017 Implementation Discovery Protocol',
    purpose: 'Define discovery-first implementation order.',
    scope:
      'Preflight, graph/docs evidence, specs, acceptance, ADRs, implementation, validation, retrospective.',
    nonGoals: [
      'Do not let implementation start before relevant specs and acceptance scenarios exist.',
    ],
    genericBehavior: [
      'ACO work proceeds through evidence, specs, acceptance tests, ADRs, smallest feature, validation, review.',
    ],
    archonBehavior: [
      'Archon work uses package boundaries and existing validation commands; no direct commits to main.',
    ],
    inputs: ['goal', 'manifest', 'graph reports', 'docs readiness', 'BMAD route'],
    outputs: ['phase reports', 'blockers', 'next BMAD skill'],
    knownUnknowns: ['which later phases need correct-course'],
    evidenceReferences: ['docs/context-orchestrator/research/graph-open-questions.md'],
    acceptanceScenarios: [
      'Given bootstrap evidence is incomplete, when implementation protocol runs, then it stops and completes bootstrap first.',
    ],
    failureBehavior: ['Blocked assumptions route to correct-course.'],
    securityConstraints: ['Do not broaden permissions silently during discovery.'],
    openQuestions: ['Should protocol be enforced by tests, scripts, or BMAD checklist?'],
  },
  {
    path: '018-release-readiness-spec.md',
    title: '018 Release Readiness Spec',
    purpose: 'Define final readiness gate for ACO MVP.',
    scope: 'Validation commands, reports, unknowns, waivers, limitations, next BMAD skill.',
    nonGoals: ['Do not release with failing required acceptance suites.'],
    genericBehavior: [
      'ReleaseReadinessReport aggregates spec, acceptance, contract, golden, integration, security, build, and waiver status.',
    ],
    archonBehavior: [
      'Use `bun run validate` before PR; use workflow/command validation if surfaces are created.',
    ],
    inputs: ['test output', 'build output', 'validation output', 'waivers', 'ADR decisions'],
    outputs: ['docs/context-orchestrator/final-validation-report.md'],
    knownUnknowns: ['final MVP surfaces and commands'],
    evidenceReferences: ['AGENTS.md', 'package.json'],
    acceptanceScenarios: [
      'Given one required acceptance suite fails, when release readiness is checked, then release readiness fails and report lists blocker plus next BMAD skill.',
    ],
    failureBehavior: [
      'Fail release readiness on required test, build, security, or validation failure.',
    ],
    securityConstraints: ['Final report must not include secrets or raw env values.'],
    openQuestions: ['Should release readiness be a CLI command in MVP or a docs checklist?'],
  },
  {
    path: '019-observability-and-events-spec.md',
    title: '019 Observability and Events Spec',
    purpose: 'Define ACO event and observability behavior.',
    scope: 'Workflow events, stage names, redaction, runId, and failure reporting.',
    nonGoals: ['Do not add database migrations until artifacts/events are proven insufficient.'],
    genericBehavior: [
      'ACO emits stage transitions for route, graph, docs, BMAD, acceptance, compile, archive, validate, completion, and failure.',
    ],
    archonBehavior: [
      'If workflow integration is selected, use existing workflow event tables and event emitter patterns.',
    ],
    inputs: ['runId', 'stage', 'status', 'safe metadata'],
    outputs: ['workflow events', 'log entries', 'validation report entries'],
    knownUnknowns: ['whether non-workflow CLI MVP needs event persistence'],
    evidenceReferences: [
      'packages/workflows/src/event-emitter.ts',
      'packages/workflows/src/store.ts',
    ],
    acceptanceScenarios: [
      'Given workflow integration is included, when route, graph, docs, BMAD, compile, and archive stages complete, then events contain runId and stage and no raw secrets.',
    ],
    failureBehavior: [
      'Event emission failure should be explicit; do not silently mark workflow success if archive validation failed.',
    ],
    securityConstraints: ['No raw secrets or `.env` values in events.'],
    openQuestions: ['Should prompt text be omitted, redacted, or hashed in events?'],
  },
  {
    path: '020-package-scripts-and-research-corpus-spec.md',
    title: '020 Package Scripts and Research Corpus Spec',
    purpose: 'Define research corpus scripts and validation.',
    scope: 'Bootstrap, update, graph, merge, render, validate scripts and gitignore behavior.',
    nonGoals: ['Do not commit raw upstream repositories or graph caches.'],
    genericBehavior: [
      'Research scripts are safe to rerun, record status, and continue on per-repo failures.',
    ],
    archonBehavior: [
      'Scripts live under `scripts/research` and are exposed through root `package.json` scripts.',
    ],
    inputs: ['required upstream list', 'local names', 'roles', 'Graphify availability'],
    outputs: ['upstream manifest', 'graph evidence docs', 'waivers', 'merged report'],
    knownUnknowns: ['whether Graphify semantic extraction is required later'],
    evidenceReferences: [
      'docs/context-orchestrator/research/upstream-manifest.json',
      'docs/context-orchestrator/research/graph-evidence-index.md',
    ],
    acceptanceScenarios: [
      'Given research scripts complete, when corpus validation runs, then manifest exists, graph outputs exist or are waived, and ignored research directories are not visible to git.',
    ],
    failureBehavior: ['Failed repos are recorded and do not stop other repos.'],
    securityConstraints: [
      'Never use `git clean -fd`, reset hard, forced checkout, or overwrite non-git directories.',
    ],
    openQuestions: [
      'Should failed Graphify repos be retried with fixture mode or left as waivers?',
    ],
  },
];

const apiContractPath = join(specsDir, '013-api-contract.openapi.yaml');

async function main(): Promise<void> {
  const checkOnly = process.argv.includes('--check');
  await mkdir(specsDir, { recursive: true });

  const missing: string[] = [];
  for (const spec of markdownSpecs) {
    const path = join(specsDir, spec.path);
    if (checkOnly) {
      if (!(await pathExists(path))) missing.push(spec.path);
      continue;
    }
    if (!(await pathExists(path))) {
      await writeFile(path, renderMarkdownSpec(spec), 'utf-8');
    }
  }

  if (checkOnly) {
    if (!(await pathExists(apiContractPath))) missing.push('013-api-contract.openapi.yaml');
    const sectionErrors = await validateSections();
    if (missing.length > 0 || sectionErrors.length > 0) {
      for (const item of missing) console.error(`Missing spec: ${item}`);
      for (const item of sectionErrors) console.error(item);
      process.exit(1);
    }
    console.log('ACO SDD specs present and sectioned.');
    return;
  }

  if (!(await pathExists(apiContractPath))) {
    await writeFile(apiContractPath, renderApiContract(), 'utf-8');
  }

  await writeRegisterFiles(checkOnly);
  console.log('ACO SDD scaffold rendered.');
}

async function writeRegisterFiles(checkOnly: boolean): Promise<void> {
  const assumptionPath = join(specsDir, 'assumption-evidence-register.md');
  const tracePath = join(specsDir, 'spec-traceability-matrix.md');
  if (!checkOnly && !(await pathExists(assumptionPath))) {
    await writeFile(
      assumptionPath,
      [
        '# Assumption Evidence Register',
        '',
        '| ID | Assumption | Classification | Evidence | Status | Correct-course trigger |',
        '| --- | --- | --- | --- | --- | --- |',
        '| ACO-A-001 | Graph evidence must exist or be waived before architecture lock. | proven by Graphify evidence | docs/context-orchestrator/research/graph-evidence-index.md | active | Required graph missing without waiver |',
        '| ACO-A-002 | OpenAI Docs MCP is primary for Codex behavior. | proven by official OpenAI docs | docs/context-orchestrator/research/openai-docs-mcp.md | active | Official docs unavailable for required Codex behavior |',
        '| ACO-A-003 | Context7 IDs must be resolved before version-specific docs use. | proven by Context7 evidence | docs/context-orchestrator/research/context7-mcp.md | active | A generated prompt includes unproven Context7 ID |',
        '| ACO-A-004 | MVP should prefer artifacts/events before DB migration. | proven by Archon docs | AGENTS.md | active | Requirement appears that artifacts/events cannot satisfy |',
        '',
      ].join('\n'),
      'utf-8'
    );
  }
  if (!checkOnly && !(await pathExists(tracePath))) {
    await writeFile(
      tracePath,
      [
        '# Spec Traceability Matrix',
        '',
        '| Spec | Acceptance IDs | Evidence | Implementation status |',
        '| --- | --- | --- | --- |',
        '| 000-product-charter.md | ACO-CHARTER-001 | graph/docs research | spec only |',
        '| 004-graph-context-spec.md | ACO-GRAPH-001 | graph-evidence-index.md | research scripts complete |',
        '| 005-documentation-resolution-spec.md | ACO-DOCS-001, ACO-DOCS-002, ACO-DOCS-003 | openai-docs-mcp.md, context7-mcp.md | spec only |',
        '| 007-caveman-policy-spec.md | ACO-CAVEMAN-001, ACO-CAVEMAN-002, ACO-CAVEMAN-003 | caveman-principles.md | spec only |',
        '| 008-prompt-package-spec.md | ACO-COMPILE-001 | pending acceptance tests | not implemented |',
        '| 015-security-threat-model.md | ACO-SECURITY-001 | pending acceptance tests | not implemented |',
        '| 020-package-scripts-and-research-corpus-spec.md | ACO-RESEARCH-001 | upstream-manifest.json, validate-corpus output | scripts complete |',
        '',
      ].join('\n'),
      'utf-8'
    );
  }
}

async function validateSections(): Promise<string[]> {
  const requiredSections = [
    '## Purpose',
    '## Scope',
    '## Non-Goals',
    '## Generic Behavior',
    '## Archon-Specific Behavior',
    '## Inputs',
    '## Outputs',
    '## Known Unknowns',
    '## Evidence References',
    '## Acceptance Scenarios',
    '## Failure Behavior',
    '## Security Constraints',
    '## Open Questions',
  ];
  const errors: string[] = [];
  for (const spec of markdownSpecs) {
    const path = join(specsDir, spec.path);
    if (!(await pathExists(path))) continue;
    const content = await readFile(path, 'utf-8');
    for (const section of requiredSections) {
      if (!content.includes(section)) {
        errors.push(`${spec.path} missing ${section}`);
      }
    }
  }
  return errors;
}

function renderMarkdownSpec(spec: MarkdownSpec): string {
  return [
    `# ${spec.title}`,
    '',
    '## Purpose',
    '',
    spec.purpose,
    '',
    '## Scope',
    '',
    spec.scope,
    '',
    '## Non-Goals',
    '',
    renderList(spec.nonGoals),
    '',
    '## Generic Behavior',
    '',
    renderList(spec.genericBehavior),
    '',
    '## Archon-Specific Behavior',
    '',
    renderList(spec.archonBehavior),
    '',
    '## Inputs',
    '',
    renderList(spec.inputs),
    '',
    '## Outputs',
    '',
    renderList(spec.outputs),
    '',
    '## Known Unknowns',
    '',
    renderList(spec.knownUnknowns),
    '',
    '## Evidence References',
    '',
    renderList(spec.evidenceReferences),
    '',
    '## Acceptance Scenarios',
    '',
    renderList(spec.acceptanceScenarios),
    '',
    '## Failure Behavior',
    '',
    renderList(spec.failureBehavior),
    '',
    '## Security Constraints',
    '',
    renderList(spec.securityConstraints),
    '',
    '## Open Questions',
    '',
    renderList(spec.openQuestions),
    '',
  ].join('\n');
}

function renderList(values: string[]): string {
  return values.map(value => `- ${value}`).join('\n');
}

function renderApiContract(): string {
  return [
    'openapi: 3.1.0',
    'info:',
    '  title: Archon Context Orchestrator API Contract',
    '  version: 0.0.0',
    '  description: >-',
    '    Candidate ACO REST API contract. Purpose: define API shape before implementation.',
    '    Scope: status, route, compile, graph, docs, bmad, accept, validate, and package retrieval.',
    '    Non-goals: no API implementation before ADR selection. Generic behavior: expose prompt package orchestration',
    '    through request/response contracts. Archon-specific behavior: use registerOpenApiRoute(createRoute({...}), handler)',
    '    if API surface is selected. Inputs: JSON request bodies. Outputs: JSON response bodies and archive paths.',
    '    Known unknowns: whether API is MVP. Evidence references: docs/context-orchestrator/specs/008-prompt-package-spec.md.',
    '    Acceptance scenarios: API returns redacted JSON and validates required fields. Failure behavior: explicit 4xx/5xx errors.',
    '    Security constraints: no secrets in responses. Open questions: whether package retrieval streams files or returns paths.',
    'paths:',
    '  /api/context/status:',
    '    get:',
    '      summary: Candidate ACO status endpoint',
    '      responses:',
    '        "200":',
    '          description: ACO readiness status',
    '  /api/context/compile:',
    '    post:',
    '      summary: Candidate ACO prompt package compile endpoint',
    '      responses:',
    '        "200":',
    '          description: Compiled prompt package summary',
    '        "400":',
    '          description: Invalid request or readiness blocker',
    '  /api/context/packages/{runId}:',
    '    get:',
    '      summary: Candidate prompt package lookup endpoint',
    '      parameters:',
    '        - name: runId',
    '          in: path',
    '          required: true',
    '          schema:',
    '            type: string',
    '      responses:',
    '        "200":',
    '          description: Prompt package manifest or archive reference',
    '        "404":',
    '          description: Prompt package not found',
    '',
  ].join('\n');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
