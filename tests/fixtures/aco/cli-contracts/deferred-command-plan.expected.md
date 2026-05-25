# ACO Command Plan

command: archon context compile <prompt>
id: archon.context.compile
surface: cli
owner: aco-context
status: deferred
mutates: writes-artifacts
safety: writes-artifacts
approvalRequired: true
outputModes: markdown, json

## Arguments

- prompt: required, variadic; Prompt to compile into a context package

## Options

- none

## S7 Boundary

- Deferred in S7; command is discoverable but returns a stable nonzero diagnostic.
