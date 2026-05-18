---
title: Solidification Review Ledgers
description: Use tool and command ledgers to solidify an existing POC without adding features.
category: book
part: advanced
audience: [user]
sidebar:
  order: 11
---

Use this guide when you believe a proof of concept already uses the right technologies and you want to make it more reliable, observable, repeatable, and easier to operate without adding product features.

This is a brownfield stabilization review. It starts by proving what tools and commands are available, what evidence they produce, what is blocked, and what should not be run without approval.

ACO also supports these ledgers as first-class code-level artifacts. `archon context ledgers` renders the current Tool Availability and Commands ledgers without writing an archive. `archon context compile` embeds the same ledger bundle into prompt-package evidence and exports JSON plus Markdown ledger artifacts.

---

## Scope

The ledgers are a discovery snapshot. They are not a canonical capability registry, a product roadmap, or proof that the POC is ready. JSON output is the source of truth; Markdown tables are derived human-readable views.

Use them to:

- Inventory available tools and commands.
- Separate verified evidence from assumptions.
- Identify blocked or partial validation gates.
- Capture safe fallbacks before proposing hardening work.

Do not use them to:

- Add features.
- Swap frameworks or technology choices.
- Edit code by default.
- Generate artifacts without approval.
- Install dependencies, run migrations, format files, commit, push, or open a PR.

---

## Status Values

Use these exact lowercase values in both ledgers:

| Status | Meaning |
|---|---|
| `available` | The tool or command was found and its verification check passed. |
| `partial` | The tool or command produced useful evidence, but waivers, stale data, missing inputs, or degraded status limit confidence. |
| `blocked` | The tool or command is required or relevant, but cannot run until a missing prerequisite is resolved. |
| `deferred` | The tool or command is valid, but intentionally left for a later phase. |
| `forbidden` | The tool or command is outside the current read-only stabilization scope. |
| `not used` | The tool or command exists, but was not needed for this review. |
| `unknown` | Availability or behavior was not verified. |

`Last Verified` must be an ISO date such as `2026-05-18`, or `unknown` when it was not checked during the review.

Every ledger row must cite a source: a file path, command output, tool result, or explicit `unknown`.

Generated ledgers use schema version `aco.ledger-bundle.v1`. Missing evidence remains `unknown` unless concrete partial or blocked evidence exists. Cheap read-only evidence such as `git status --short --untracked-files=all` should be observed instead of left as unexplained `unknown`. Command safety classifications are advisory; they do not execute commands or grant permission.

---

## Tool Availability Ledger

Use this ledger before claiming a tool is available, missing, blocked, or safe to use.

| Tool / Capability | Source | Invocation Path | Scope | Status | Preconditions | Verification Check | Primary Use | Failure Mode | Fallback | Owner | Last Verified | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Archon ACO | `archon context status --cwd .` output | `archon context route --cwd . "<task>"` and `archon context status --cwd .` | route and readiness evidence | `forbidden` | Archon CLI available | command exits 0 and reports route/status | choose BMAD route and identify readiness caveats | graph forbidden, waivers, or missing policy tool | record caveat and limit claims | project | `2026-05-18` | Example state: route `brownfield-architecture`; validation passed; graph forbidden with named waivers such as `graph-waiver.bmad-plugins-marketplace`. |
| BMAD Party Mode | BMAD skill roster / agent outputs | `/bmad-party-mode` | review consensus | `available` | BMAD skills installed | reviewers produce consensus or objections | challenge scope, evidence, and unsafe certainty | advisory-only output or thread limit | use smaller reviewer set or manual review | project | `unknown` | Consensus does not replace command evidence. |
| OPA | shell command output | `opa version` | policy validation prerequisite | `unknown` | `opa` on `PATH` | command exits 0 | run policy gates such as `bun run aco:policy` | `opa: command not found` | install/pin OPA or mark policy validation blocked | project | `unknown` | Do not assume OPA availability. |

---

## Commands Ledger

Use this ledger before running validation or recommending hardening work.

| Command | File / Location | Invocation | Purpose | Inputs | Outputs | Preconditions | Related Tool | Status | Validation Check | Failure Mode | Owner | Last Verified | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `git status --short --untracked-files=all` | Git | repo root | detect dirty or untracked work | current worktree | status lines | Git available | Git | `available` | exit 0 | unexpected unrelated changes | project | `unknown` | Classify before editing or staging. |
| `archon context route --cwd . "<task>"` | Archon CLI | repo root | choose BMAD route | task prompt | route and route steps | Archon CLI available | Archon ACO | `partial` | exit 0 and route returned | route uncertainty | project | `2026-05-18` | Example route: `brownfield-architecture`. |
| `archon context status --cwd .` | Archon CLI | repo root | report graph/readiness status | repo path | status summary with waiver IDs and ledger summary | Archon CLI available | Archon ACO | `forbidden` | exit 0 and status returned | graph forbidden or failed status | project | `2026-05-18` | Example status: validation passed; graph forbidden with 2 named waivers. |
| `bun run aco:policy` | `package.json` | repo root | validate OPA policy gate | policy files and fixtures | pass/fail | OPA available on `PATH` | OPA | `unknown` | exit 0 | missing OPA or policy failure | project | `unknown` | Mark blocked if `opa` is unavailable. |
| `bun run validate` | `package.json` | repo root | run pre-PR validation suite | repo state | pass/fail | repo dependencies installed and policy prerequisites available | Bun validation | `unknown` | exit 0 | type, lint, format, test, traceability, or policy failure | project | `unknown` | This is the final validation gate, not a substitute for ledger evidence. |

---

## Where Am I? What Do I Run?

If you are solidifying an existing POC, start with evidence rather than feature planning:

```bash
git status --short --untracked-files=all
archon context route --cwd . "<POC solidification task>"
archon context status --cwd .
archon context ledgers --cwd . --json
```

Then fill the Tool Availability Ledger and Commands Ledger. Run validation gates only after you know their prerequisites and mutation risk.

Use BMAD review commands when you need critique:

```text
/bmad-party-mode
/bmad-review-adversarial-general
/bmad-review-edge-case-hunter
```

Commands that write files or artifacts require explicit approval in a read-only stabilization review. Examples include `archon context compile`, `bun run research:graph`, `bun run aco:research`, `bun run format`, `bun run lint:fix`, code generation, migrations, commits, pushes, and PR creation.

When you compile a prompt package, expect these ledger artifacts in the archive:

- `tool-availability-ledger.json`
- `tool-availability-ledger.md`
- `commands-ledger.json`
- `commands-ledger.md`

---

## Reusable Prompt

```text
I consider this POC's current technology choices acceptable. I do not want new features, framework swaps, or implementation work. I want to solidify the solution by leveraging the available tools.

Run a read-only brownfield stabilization review.

Required outputs:
1. Tool Availability Ledger
2. Commands Ledger
3. Validation and waiver summary
4. Architecture hardening findings
5. Final status: Blocked, Partial, or Ready

Rules:
- Do not change code.
- Do not generate artifacts unless explicitly approved.
- Do not install dependencies, run migrations, format files, commit, push, or open a PR.
- Treat partial or forbidden graph evidence and waivers as confidence limits.
- Use Archon for route/status/validation evidence.
- Use BMAD Party Mode for consensus.
- Use Context7 for third-party docs only.
- Use OpenAI Docs for OpenAI/Codex behavior.
- Use Graphify when repository structure matters.
```

---

## Final Status

Use one final status:

| Status | Use When |
|---|---|
| `Ready` | Required tools are available, required validations pass, and graph/docs waivers do not block readiness. |
| `Partial` | Useful evidence exists, but missing prerequisites, stale data, or partial graph coverage limit confidence. |
| `Blocked` | A required tool or validation gate cannot run, or evidence is too incomplete to recommend hardening work. |
| `Forbidden` | Failed waiver-required graph evidence or unsafe command evidence blocks readiness claims. |

Current example status for this repository is `Forbidden`: Archon routes confidence-sensitive ACO work to `brownfield-architecture`, validation passes, and graph evidence remains forbidden because named waivers such as `graph-waiver.bmad-plugins-marketplace` and `graph-waiver.bmad-sample-data` still constrain readiness.
