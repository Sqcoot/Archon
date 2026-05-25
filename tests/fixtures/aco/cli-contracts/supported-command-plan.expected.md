# ACO Command Plan

command: archon aco status --cwd <repo> [--json]
id: archon.aco.status
surface: cli
owner: aco-cli
status: supported
mutates: read-only
safety: read-only
approvalRequired: false
outputModes: markdown, json

## Arguments

- none

## Options

- --cwd: path; Repository path to inspect
- --json: flag; Render a JSON result envelope

## S7 Boundary

- Supported only through committed pure S1-S6 contracts and thin CLI adaptation.
