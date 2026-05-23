# ACO Context Intake Gate

The ACO Context Intake gate is a local, read-only lint gate for committed reusable agent context. It scans tracked files only, so ignored runtime artifacts under `.archon/artifacts/` and `.archon/state/` are not used as readiness evidence.

Run it with:

```bash
bun run aco:context-intake --json
```

The gate reports:

- `ready`
- `blocked`
- `needs_decision`
- `unknown`

Existing public ACO readiness contracts may still use `needs_approval`. This gate keeps approval as a reason or blocker, not as a top-level gate state.

The gate checks for developer-local paths, branch-specific assumptions, undeclared private tools, provider-specific default hooks or config, static runtime-readiness claims, generated artifacts without lifecycle metadata, and readiness claims without nearby evidence.

Fake local paths are allowed only in clearly marked fixtures or examples. Generated artifacts must name a consumer, source input, regeneration command, drift or removal policy, and owner surface before they can be retained as reusable context.
