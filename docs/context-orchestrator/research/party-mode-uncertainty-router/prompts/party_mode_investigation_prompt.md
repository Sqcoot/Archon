# Party Mode Investigation Prompt

Use party mode because the task is uncertain. This is a read-only investigation pass. Do not edit code. Do not patch files. Do not create commits. Do not install or update dependencies. Read the relevant files and use available read-only tools to investigate.

End only when you have produced a zip artifact with:

- `investigation_report.md`
- `next_goal.md`
- `evidence_manifest.yaml`
- `readonly_policy_result.md`
- supporting artifacts that make the implementation pass straightforward

The `next_goal.md` file must contain exactly one implementation goal with a definition of done, boundaries, verification, and rollback/safety notes.

Use `artifacts/01_goal_end_condition_4000_chars.md` as the end condition, not as an implementation plan.
