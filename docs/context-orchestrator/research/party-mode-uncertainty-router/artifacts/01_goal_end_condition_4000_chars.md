# Party Mode Goal / End Condition

Produce a read-only uncertainty investigation package for the requested implementation area. The task is complete only when a zip artifact exists and contains enough evidence for a separate implementation pass to act without rediscovering context.

The investigation must not edit source code, generated code, dependency lockfiles, database migrations, infrastructure files, or tests. It may read files, inspect configuration, run safe read-only commands, query approved documentation/research tools, and create investigation artifacts outside the source tree or under the designated artifact directory.

The final zip must include:

1. `investigation_report.md` explaining the uncertainty, relevant findings, assumptions, rejected hypotheses, open risks, and recommended implementation path.
2. `next_goal.md` containing exactly one implementation goal with a clear definition of done, boundaries, verification steps, and rollback notes.
3. `evidence_manifest.yaml` listing every file, command, document, subagent output, graph, ledger, adapter result, docs lookup, or research result used.
4. `readonly_policy_result.md` confirming that no code edits were made and naming any attempted mutation that was blocked or avoided.
5. Supporting artifacts that reduce implementation ambiguity, such as architecture notes, dependency maps, API surfaces, failing/expected behavior notes, risk ledger, tool output summaries, context bootload notes, graph/Graphify exports, Context7/docs notes, MCP/tool inventory, hook observations, and subagent role reports.

The investigation should delegate when useful, but each delegated output must be summarized in the evidence manifest. Party mode is successful only when uncertainty has been converted into a bounded implementation goal. Do not solve the implementation in this pass. Do not patch files. Do not create commits. Do not run destructive commands. Do not silently assume missing facts; capture them as risks or explicit implementation questions.

If the evidence is insufficient, the next goal must be a discovery or instrumentation goal rather than a code-change goal. If multiple implementation paths remain plausible, recommend one default path and document why alternatives were rejected. The final answer should point to the zip artifact and summarize only the key finding, the confidence level, and the next goal.
