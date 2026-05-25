# Commands To Run In The Fresh Verification Session

Do not run these commands while generating this handoff zip. They are for the fresh session that performs verification.

Set this variable to the target implementation pack directory from the checkout root:

```bash
PMR_ROOT="docs/context-orchestrator/research/party-mode-uncertainty-router"
```

## Inventory And Static Checks

```bash
find "$PMR_ROOT" -maxdepth 3 -type f | sort
python3 -m json.tool "$PMR_ROOT/hooks/hooks.json" >/tmp/pmr-hooks-json.ok
python3 -m json.tool "$PMR_ROOT/schemas/party_mode_state.schema.json" >/tmp/pmr-state-schema.ok
python3 -m zipfile -l "$PMR_ROOT/party_mode_uncertainty_router_implementation.zip"
```

## Unit And Behavior Checks

Run the implementation tests if allowed in the fresh session:

```bash
python3 -B -m unittest discover -s "$PMR_ROOT/tests"
```

Use isolated runtime paths when invoking the router directly:

```bash
TMPDIR="$(mktemp -d)"
export PARTY_MODE_STATE_DIR="$TMPDIR/state"
export PARTY_MODE_ARTIFACT_DIR="$TMPDIR/party-mode-output"
export PARTY_MODE_ZIP_PATH="$TMPDIR/party-mode-output.zip"
```

Example direct hook invocation shape:

```bash
printf '%s\n' '{"session_id":"s1","turn_id":"t1","cwd":".","hook_event_name":"UserPromptSubmit","prompt":"Use party mode to investigate this uncertain failure. Do not edit code."}' \
  | python3 "$PMR_ROOT/hooks/party_mode_router.py"
```

The fresh session should adapt this event shape for `PreToolUse`, `PermissionRequest`, `PostToolUse`, `SubagentStart`, `SubagentStop`, and `Stop`, then record the observed JSON decisions in the findings report.

## Genericity Scan

Use repo-appropriate patterns to check reusable files for user-local absolute paths and stale chat-specific wording. Example:

```bash
rg -n "/Users/|eac0bc3d|this chat|this session only|party-mode-backup-[0-9]+" "$PMR_ROOT/README.md" "$PMR_ROOT/next_goal.md" "$PMR_ROOT/artifacts" || true
```

Literal hashes, dates, and local paths are acceptable only in files that clearly label them as evidence.
