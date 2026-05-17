# Caveman Principles

## Source Evidence

Evidence captured: 2026-05-17

- Caveman upstream: `research/upstreams/caveman`
- Commit: `63a91ecadbf4c4719a4602a5abb00883f9966034`
- Graph report: `docs/context-orchestrator/research/caveman-graph-report.md`
- Primary skill: `research/upstreams/caveman/skills/caveman/SKILL.md`
- Compression skill: `research/upstreams/caveman/skills/caveman-compress/SKILL.md`
- Compression security note: `research/upstreams/caveman/skills/caveman-compress/SECURITY.md`
- Data-loss tests: `research/upstreams/caveman/tests/test_compress_safety.py`

## Observed Policy

Caveman is an output compression mode. It removes filler, pleasantries, hedging, redundant phrasing, and unnecessary articles while keeping technical content intact.

Supported levels:

- `lite`
- `full`
- `ultra`
- `wenyan-lite`
- `wenyan-full`
- `wenyan-ultra`

The policy preserves technical terms, code identifiers, exact errors, and byte-sensitive artifacts.

## Preservation Rules

ACO must preserve these exactly when applying Caveman policy:

- fenced code blocks
- inline code
- URLs
- markdown links
- file paths
- shell commands
- API names
- library names
- protocol names
- environment variables
- dates
- version numbers
- JSON, YAML, TOML, SQL, shell, HTML, XML, CSS, and lockfile content

ACO must also preserve acceptance criteria, specs, ADRs, OpenAPI contracts, workflow YAML, and security warnings without caveman compression.

## Safe Use In ACO

ACO may apply Caveman policy to:

- route summaries
- status summaries
- review findings
- next-action suggestions
- compact prompt package summaries

ACO must not apply Caveman policy to:

- generated specs
- acceptance scenarios
- architecture ADRs
- OpenAPI files
- workflow YAML
- JSON schemas
- TOML config
- shell commands
- code blocks
- exact file paths
- exact URLs
- security warnings

## Safety Lessons

Caveman-compress records several safety constraints that ACO should carry forward:

- user file content must not be executed as code
- subprocess calls must use fixed argument lists, not shell interpolation
- file content should be passed through stdin when possible
- oversized files should be rejected before external calls
- empty or identical compression output should not overwrite the input
- backup integrity must be verified before replacing content

ACO MVP does not need to implement file rewriting. It only needs safe output policy and prompt package rendering.

## ACO Implications

ACO should model Caveman as `CavemanPolicy`, not as personality.

The compiler should classify output regions before compression. Structured regions are protected and copied byte-identically.

The policy should default to off unless requested or configured by route. When active, it should use `full` for status summaries and avoid `ultra` where compression creates ambiguity.

## Open Questions

- Whether `wenyan-*` modes are in MVP or deferred.
- Whether Caveman policy should be represented as a post-render transform or as a renderer-level style option.
- Whether golden tests should use upstream fixtures from `research/upstreams/caveman/tests/caveman-compress`.
