# Party Mode Router Verification Findings

## Summary

- Overall result: `<pass|fail|partial>`
- Target implementation pack: `<repo-relative path or attached package name>`
- Target commit or version evidence: `<optional evidence-only metadata>`
- Verification date: `<YYYY-MM-DD>`
- Verifier: `<agent/session identifier>`

## Result Matrix

| Area | Result | Evidence |
| --- | --- | --- |
| Artifact inventory | `<pass|fail|partial>` | `<file paths or command summary>` |
| Hook config/schema validity | `<pass|fail|partial>` | `<evidence>` |
| UserPromptSubmit activation | `<pass|fail|partial>` | `<evidence>` |
| PreToolUse read-only enforcement | `<pass|fail|partial>` | `<evidence>` |
| PermissionRequest denial | `<pass|fail|partial>` | `<evidence>` |
| PostToolUse guidance/warnings | `<pass|fail|partial>` | `<evidence>` |
| SubagentStart contract | `<pass|fail|partial>` | `<evidence>` |
| SubagentStop continuation | `<pass|fail|partial>` | `<evidence>` |
| Stop handoff gate | `<pass|fail|partial>` | `<evidence>` |
| Env-var path overrides | `<pass|fail|partial>` | `<evidence>` |
| Genericity/path portability | `<pass|fail|partial>` | `<evidence>` |

## Deviations

List each deviation as:

```text
ID: PMR-V-001
Severity: <low|medium|high|critical>
Expected: <expected behavior>
Observed: <actual behavior>
Evidence: <path, command summary, or output excerpt>
Impact: <why it matters>
```

## Read-Only Safety Result

- Mutating source edits denied: `<yes|no|partial>`
- Dependency changes denied: `<yes|no|partial>`
- Commits denied: `<yes|no|partial>`
- Migrations/generated-code writes denied: `<yes|no|partial>`
- Artifact writes allowed: `<yes|no|partial>`

## Risk Assessment

- Risk level: `<low|medium|high>`
- Main risk: `<one sentence>`
- Confidence: `<low|medium|high>`

## Next Recommended Goal

Provide exactly one bounded next goal. If verification passes, make it a rollout or adoption decision goal. If verification fails, make it a targeted implementation-fix goal.
