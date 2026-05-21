# BMAD Method 6.7 Sync Review

Date: 2026-05-21
BMAD action: `bmad-investigate`
Archon route: `brownfield-architecture`

## Source Evidence

- BMAD npm latest: `6.7.1`
- BMAD-METHOD tag inspected: `v6.7.1`
- BMAD-METHOD commit inspected: `1da6bf80dff34b87ee7098a1f55b38942ad5a4a3`
- Local manifest before sync: `core@6.6.0`, `bmm@6.6.0`, IDE `codex`
- Local manifest after sync: `core@6.7.1`, `bmm@6.7.1`, IDE `codex`
- Archon ACO artifact: `.archon/artifacts/context-orchestrator/aco-095ddb62-e5df-4dc6-a06b-f07c9cf96d14/`

## Changelog Delta From 6.6.0 To 6.7.1

### PRD

`bmad-prd` is the canonical current PRD skill. It owns Create, Update, and
Validate intents, creates a persistent run workspace, writes `.decision-log.md`,
uses `addendum.md` for overflow/detail, and emits validation reports through the
new rubric/synthesis pipeline. `bmad-create-prd`, `bmad-edit-prd`, and
`bmad-validate-prd` remain generated compatibility shims in 6.7.1, but new
project guidance should point to `bmad-prd` directly.

### Product Brief

`bmad-product-brief` remains the canonical generated skill name in this install.
The 6.7 line replaced the older scripted multi-agent Product Brief flow with an
outcome-driven single skill supporting Create, Update, and Validate intents.
Brief work now uses a live workspace, `.decision-log.md`, optional `addendum.md`,
and downstream handoff through current BMAD skills.

### Investigation

`bmad-investigate` is new in the installed BMM catalog. It is the preferred BMM
skill for forensic case investigation, bug triage, incident/root-cause review,
unfamiliar-code exploration, and changelog-delta checks like this one.

### Registry And Community Modules

The interactive community module picker and remote marketplace registry are no
longer current installer behavior. Current official module choices come from the
bundled `bmad-modules.yaml`. Previously installed community modules may remain
in a manifest, but updates require current installer-supported custom source
handling such as `--custom-source <git-url-or-path>`.

The existing ACO references to `bmad-plugins-marketplace` are retained only as
graph-waiver evidence. They are not current installer registry guidance and must
not be used to justify adding marketplace registry behavior back to Archon.

### Automator

The old experimental Automator module code `baut` was renamed upstream. Current
official module code is `automator`. This repository has no installed `baut`
module and no `_bmad/baut/` directory. Do not add Automator unless explicitly
selected; if Automator is later required, install the current `automator` module
through the BMAD installer.

### Generated Surfaces

The installer generated 44 Codex-compatible BMAD skill directories under
`.agents/skills/`. Recursive comparison against a fresh 6.7.1 install found the
local generated `_bmad/` files and BMAD skill files matched the fresh install.
No stale generated BMAD directories or deep PRD/Product Brief step files
remained.

## Ideal BMAD Route For This Repository

For this BMAD sync and similar architecture-sensitive repository maintenance:

1. `bmad-index-docs`
2. `bmad-generate-project-context`
3. `bmad-document-project`
4. `bmad-domain-research`
5. `bmad-technical-research`
6. `bmad-investigate`
7. `bmad-product-brief`
8. `bmad-prd`
9. `bmad-create-architecture`
10. `bmad-review-adversarial-general`
11. `bmad-review-edge-case-hunter`
12. `bmad-create-epics-and-stories`
13. `bmad-check-implementation-readiness`
14. `bmad-sprint-planning`

`bmad-cis-problem-solving` is an optional CIS module skill and is not installed
in this repository. ACO should not emit it as a required route step while the
manifest only contains `core` and `bmm`.

## MCP And Documentation Sources

- OpenAI/Codex behavior: prefer OpenAI Docs MCP when available.
- Third-party libraries, SDKs, CLIs, and cloud services: resolve through
  Context7 before relying on memory.
- BMAD installer and changelog evidence: use npm metadata, BMAD-METHOD tag/commit
  inspection, and the checked-out changelog.
- Optional graph refresh, ACO research, generated bundled defaults, format writes,
  and lint fixes remain approval-gated by the ACO ledger.

## Archon Artifacts And Ledgers

Archon produced a context package for this review under:

```text
.archon/artifacts/context-orchestrator/aco-095ddb62-e5df-4dc6-a06b-f07c9cf96d14/
```

Important artifacts:

- `codex-prompt.md`
- `decision-dossier.json`
- `decision-dossier.md`
- `tool-availability-ledger.json`
- `tool-availability-ledger.md`
- `commands-ledger.json`
- `commands-ledger.md`
- `validation-report.md`

Ledger result: 40 combined rows, 29 available, 3 deferred, 8 forbidden, and no
evidence blockers. Graph evidence remains `forbidden` with preserved waiver IDs
`graph-waiver.bmad-plugins-marketplace` and `graph-waiver.bmad-sample-data`.

## Actions Taken

- Re-reviewed BMAD 6.7.0 and 6.7.1 changelog deltas.
- Recursively compared local generated BMAD files against a fresh 6.7.1 install.
- Confirmed no stale generated BMAD deep files remain.
- Corrected the ACO brownfield route to use installed `bmad-investigate` instead
  of unavailable optional `bmad-cis-problem-solving`.
- Documented PRD/Product Brief `.decision-log.md` and `addendum.md` behavior.
- Preserved graph waivers and did not run approval-gated graph refresh commands.

## Remaining Follow-Up

- If CIS is intentionally needed later, install it through the BMAD installer and
  then update ACO route tests to allow `bmad-cis-problem-solving`.
- If Automator is intentionally needed later, install current `automator`, not
  legacy `baut`.
- `.agents/skills/` is gitignored in this repository. The generated BMAD skills
  were refreshed locally and verified against a fresh install, but they are not
  committed by design.
