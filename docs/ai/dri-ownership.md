# DRI Ownership

The AI operating layer needs explicit ownership because workflow assets, commands, skills, MCP policy, validation reports, and BMAD mappings can drift independently.

| Responsibility | Owner |
| --- | --- |
| AI operating layer DRI | TBD |
| Backup | TBD |
| Validation report owner | TBD |
| BMAD mapping owner | TBD |
| MCP/config approval owner | TBD |
| ACO graph/waiver approval owner | TBD |
| Review cadence | Quarterly or after major model/tool releases |

## Owner Duties

- Keep `docs/ai/README.md` current as the AI operating layer index.
- Update `docs/ai/workflow-compliance-matrix.md` when workflows, commands, scripts, skills, agents, MCP config, or package scripts change.
- Update `docs/ai/bmad-to-archon-mapping.md` when `_bmad` assets or `.agents/skills/bmad-*` change.
- Update validation reports with real command output before claiming a gate passed.
- Preserve ACO graph waivers unless explicit approval authorizes refresh or cleanup.
- Review MCP/config changes before committing trust-sensitive settings.

Do not invent owner names in docs. Replace `TBD` only after the repo or maintainer declares ownership.
