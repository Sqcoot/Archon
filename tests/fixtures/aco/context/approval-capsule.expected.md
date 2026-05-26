# ACO Approval Capsule

schemaVersion: aco.approval-capsule.v1
id: aco.context.s8.approval-capsule.archon.context.compile
requestedCommand: archon context compile <prompt> [--no-write-artifact]
mutationClass: writes-artifacts
approvalScope: writes-artifacts
approvalStatus: not-granted
promptDigest: 496d706c656d656e7420533820636f6e7465787420636f6e7472616374730000
contextDigest: 61636f2e636f6e746578742d7061636b6167652e76317c61636f2e636f6e7465
checksum: 61636f2e617070726f76616c2d63617073756c652e76317c61636f2e636f6e74

## Boundary

- This capsule records requested scope only; it does not grant approval.
- Verification is read-only and must not run gated commands.

## Invalidates When

- prompt changes
- context package digest changes
- requested command changes
- mutation scope changes
- evidence refs change
