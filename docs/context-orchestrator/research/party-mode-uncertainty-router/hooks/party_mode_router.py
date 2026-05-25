#!/usr/bin/env python3
"""
Party mode hook router for Codex.

Purpose:
- Detect explicit and inferred uncertainty on UserPromptSubmit.
- Inject a read-only investigation contract.
- Deny source edits, dependency changes, commits, migrations, generated-code
  writes, and mutating MCP/tool calls while party mode is active.
- Permit writes only to the designated party-mode artifact directory/zip.
- Continue Stop/SubagentStop when required handoff artifacts are missing.

Review and trust this hook with /hooks before use. Hooks are guardrails, not a
replacement for a read-only Codex permission profile.
"""
from __future__ import annotations

import json
import os
import re
import shlex
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence, Tuple


STATE_VERSION = 2
DEFAULT_THRESHOLD = 3
REQUIRED_FINAL_ARTIFACTS = [
    "investigation_report.md",
    "next_goal.md",
    "evidence_manifest.yaml",
    "readonly_policy_result.md",
]
SUPPORTING_ARTIFACT_PREFIX = "artifacts/"

UNCERTAINTY_RULES: Sequence[Tuple[str, str, int]] = (
    ("explicit_party_mode", r"\bparty[-\s]?mode\b", 99),
    ("explicit_uncertainty", r"\b(not sure|unclear|uncertain|ambiguous|unknown|open question)\b", 3),
    ("investigation_request", r"\b(investigate|figure out|explore|research|diagnose|triage|root cause)\b", 3),
    ("failure_analysis", r"\bwhy\b.*\b(fail|failing|broken|error|regression|crash)\b", 3),
    ("approach_unclear", r"\b(what should (we|i) do|best approach|which approach|recommend an approach)\b", 2),
    ("vague_target", r"\b(fix|implement|update|change|add)\b.{0,80}\b(it|this|that|stuff|things|issue|bug)\b", 2),
    ("high_blast_radius", r"\b(migration|auth|authorization|permissions?|security|secrets?|billing|payments?|ledger|money|sandbox)\b", 2),
    ("generated_or_tooling", r"\b(generated code|codegen|lockfile|build system|mcp|adapter|provider manifest|plugin)\b", 2),
    ("readonly_intent", r"\b(read[-\s]?only|do not edit|don't edit|no edits|no code changes)\b", 4),
    ("handoff_artifact", r"\bzip\b.*\b(next goal|artifacts?|handoff|investigation)\b", 3),
)

READONLY_MCP_WORDS = {
    "read",
    "get",
    "list",
    "search",
    "find",
    "query",
    "fetch",
    "docs",
    "resolve",
    "lookup",
    "view",
    "show",
    "status",
}

MUTATING_MCP_WORDS = {
    "write",
    "delete",
    "create",
    "update",
    "patch",
    "commit",
    "mutation",
    "insert",
    "upsert",
    "remove",
    "move",
    "rename",
    "exec",
    "run_command",
}

ALWAYS_DENY_BASH_PATTERNS: Sequence[Tuple[str, str]] = (
    (r"(^|[;&|]\s*)apply_patch\b", "apply_patch edits files"),
    (r"(^|[;&|]\s*)git\s+(add|commit|checkout|reset|clean|rebase|merge|am|apply|push|tag)\b", "git mutation"),
    (r"\b(npm|pnpm|yarn|bun)\s+(install|i|add|remove|update|upgrade)\b", "dependency change"),
    (r"\b(pip|pip3)\s+install\b", "dependency change"),
    (r"\b(poetry|uv)\s+add\b", "dependency change"),
    (r"\bcargo\s+(add|update)\b", "dependency change"),
    (r"\bgo\s+get\b", "dependency change"),
    (r"\bbundle\s+(add|install|update)\b", "dependency change"),
    (r"\b(prisma\s+migrate|sequelize\s+db:migrate|knex\s+migrate)\b", "database migration"),
    (r"\b(rails\s+db:(migrate|rollback)|alembic\s+(upgrade|downgrade|revision))\b", "database migration"),
    (r"\bpython\s+manage\.py\s+(migrate|makemigrations)\b", "database migration"),
    (r"\b(protoc|buf\s+generate|openapi-generator|swagger-codegen|graphql-codegen|orval)\b", "generated-code write"),
    (r"\b(prisma\s+generate|go\s+generate)\b", "generated-code write"),
    (r"\b(docker\s+compose\s+up|docker\s+run)\b", "container mutation"),
    (r"\b(psql|mysql|sqlite3)\b.*\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b", "database mutation"),
    (r"\b(sed\s+-i|perl\s+-pi)\b", "in-place source edit"),
)

MUTATION_OUTPUT_PATTERNS: Sequence[Tuple[str, str]] = (
    (r"\b\d+\s+files?\s+changed\b", "tool output reports changed files"),
    (r"\b(create|delete)\s+mode\s+\d+\b", "tool output reports file mode changes"),
    (r"\b(wrote|written|created|deleted|renamed|updated)\b.{0,80}\b(file|path|migration|lockfile)\b", "tool output reports file mutation"),
    (r"(^|\n)\s*[MADRCU?!]{1,2}\s+\S+", "git status-like output shows changed paths"),
)

PARTY_CONTEXT = """
Party mode is active because uncertainty was detected. Treat this as a read-only investigation pass, not an implementation pass. Do not edit source code, tests, generated files, migrations, lockfiles, infrastructure files, or commits. Use safe read-only commands and approved read-only tools to collect evidence. Writes are permitted only inside the designated party-mode artifact directory and to the final handoff zip. Produce a zip artifact containing investigation_report.md, next_goal.md, evidence_manifest.yaml, readonly_policy_result.md, and supporting artifacts. The next_goal.md must contain exactly one bounded implementation goal with definition of done, boundaries, verification, and rollback/safety notes. If evidence is insufficient, make the next goal a discovery/instrumentation goal rather than a code-change goal.
""".strip()


def emit(obj: Dict[str, Any]) -> None:
    print(json.dumps(obj, separators=(",", ":")))


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def event_cwd(event: Dict[str, Any]) -> Path:
    raw = str(event.get("cwd") or os.getcwd())
    return Path(raw).expanduser().resolve()


def state_dir() -> Path:
    default = Path.home() / ".local" / "state" / "codex-party-mode"
    return Path(os.environ.get("PARTY_MODE_STATE_DIR", str(default))).expanduser()


def safe_component(value: Any, fallback: str) -> str:
    text = str(value or fallback)
    return re.sub(r"[^A-Za-z0-9_.-]", "_", text)


def session_state_dir(event: Dict[str, Any]) -> Path:
    return state_dir() / safe_component(event.get("session_id"), "session")


def state_paths(event: Dict[str, Any]) -> List[Path]:
    base = session_state_dir(event)
    turn_id = event.get("turn_id")
    paths: List[Path] = []
    if turn_id:
        paths.append(base / f"{safe_component(turn_id, 'turn')}.json")
    paths.append(base / "current.json")
    return paths


def default_artifact_dir(event: Dict[str, Any]) -> Path:
    configured = os.environ.get("PARTY_MODE_ARTIFACT_DIR")
    if configured:
        return Path(configured).expanduser().resolve()
    return (event_cwd(event) / "party-mode-output").resolve()


def default_zip_path(event: Dict[str, Any], artifact_dir: Path | None = None) -> Path:
    configured = os.environ.get("PARTY_MODE_ZIP_PATH")
    if configured:
        return Path(configured).expanduser().resolve()
    artifact_dir = artifact_dir or default_artifact_dir(event)
    return artifact_dir.with_suffix(".zip")


def base_state(event: Dict[str, Any], active: bool = False, score: int = 0, reason: str = "no state") -> Dict[str, Any]:
    artifact_dir = default_artifact_dir(event)
    return {
        "version": STATE_VERSION,
        "active": active,
        "score": score,
        "reason": reason,
        "session_id": event.get("session_id"),
        "turn_id": event.get("turn_id"),
        "cwd": str(event_cwd(event)),
        "artifact_dir": str(artifact_dir),
        "artifact_zip": str(default_zip_path(event, artifact_dir)),
        "required_artifacts": list(REQUIRED_FINAL_ARTIFACTS),
        "blocked_mutations": [],
        "observations": [],
        "updated_at": utc_now(),
    }


def write_state(event: Dict[str, Any], state: Dict[str, Any]) -> None:
    state = dict(state)
    state["updated_at"] = utc_now()
    try:
        for path in state_paths(event):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")
    except Exception:
        # Hooks should not fail just because state persistence is unavailable.
        pass


def read_state(event: Dict[str, Any]) -> Dict[str, Any]:
    override = os.environ.get("PARTY_MODE", "").strip().lower()
    if override in {"0", "false", "off", "disable", "disabled"}:
        return base_state(event, False, 0, "PARTY_MODE environment override disabled")
    if override in {"1", "true", "force", "on", "active"}:
        return base_state(event, True, 999, "PARTY_MODE environment override active")

    for path in state_paths(event):
        try:
            state = json.loads(path.read_text(encoding="utf-8"))
            merged = base_state(event)
            merged.update(state)
            return merged
        except Exception:
            continue
    return base_state(event)


def append_state_list(event: Dict[str, Any], field: str, item: Dict[str, Any]) -> None:
    state = read_state(event)
    values = state.get(field)
    if not isinstance(values, list):
        values = []
    values.append(item)
    state[field] = values[-50:]
    write_state(event, state)


def score_uncertainty(prompt: str) -> Tuple[int, str]:
    score = 0
    hits: List[str] = []
    for name, pattern, weight in UNCERTAINTY_RULES:
        if re.search(pattern, prompt, flags=re.IGNORECASE | re.DOTALL):
            score += weight
            hits.append(name)
    return score, ", ".join(hits) if hits else "no uncertainty trigger matched"


def tool_command(event: Dict[str, Any]) -> str:
    tool_input = event.get("tool_input") or {}
    if isinstance(tool_input, dict):
        return str(tool_input.get("command") or tool_input.get("description") or tool_input)
    return str(tool_input)


def tool_response_text(event: Dict[str, Any]) -> str:
    response = event.get("tool_response")
    if response is None:
        return ""
    if isinstance(response, str):
        return response
    try:
        return json.dumps(response, sort_keys=True)
    except Exception:
        return str(response)


def clean_path_token(token: str) -> str:
    token = token.strip().strip(",.;)")
    if token.startswith("<") and token.endswith(">"):
        token = token[1:-1]
    return token.strip("\"'")


def resolve_candidate_path(raw: str, cwd: Path) -> Path | None:
    raw = clean_path_token(raw)
    if not raw or raw in {"-", "&1", "&2"}:
        return None
    if raw.startswith("&"):
        return None
    if raw.startswith("/dev/"):
        return Path(raw)
    if raw.startswith("$"):
        return None
    path = Path(raw).expanduser()
    if not path.is_absolute():
        path = cwd / path
    try:
        return path.resolve(strict=False)
    except Exception:
        return path


def is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def allowed_artifact_paths(event: Dict[str, Any], state: Dict[str, Any]) -> Tuple[Path, Path]:
    artifact_dir = Path(str(state.get("artifact_dir") or default_artifact_dir(event))).expanduser().resolve()
    artifact_zip = Path(str(state.get("artifact_zip") or default_zip_path(event, artifact_dir))).expanduser().resolve()
    return artifact_dir, artifact_zip


def is_allowed_artifact_write(path: Path, event: Dict[str, Any], state: Dict[str, Any]) -> bool:
    if str(path).startswith("/dev/"):
        return True
    artifact_dir, artifact_zip = allowed_artifact_paths(event, state)
    if path == artifact_zip:
        return True
    if is_relative_to(path, artifact_dir):
        return True
    return False


def split_shell(command: str) -> List[str]:
    try:
        return shlex.split(command, posix=True)
    except ValueError:
        return []


def is_separator(token: str) -> bool:
    return token in {"&&", "||", ";", "|"}


def command_basename(token: str) -> str:
    return Path(token).name


def collect_until_separator(tokens: Sequence[str], start: int) -> List[str]:
    result: List[str] = []
    for token in tokens[start:]:
        if is_separator(token):
            break
        result.append(token)
    return result


def extract_redirection_targets(command: str, cwd: Path) -> List[Path]:
    targets: List[Path] = []
    pattern = re.compile(r"(?<![<])(?:[12]?>|[12]?>>|&>)\s*(?!&)(?P<path>'[^']+'|\"[^\"]+\"|[^\s;&|]+)")
    for match in pattern.finditer(command):
        path = resolve_candidate_path(match.group("path"), cwd)
        if path is not None:
            targets.append(path)
    return targets


def extract_python_open_targets(command: str, cwd: Path) -> List[Path]:
    targets: List[Path] = []
    pattern = re.compile(
        r"open\(\s*['\"](?P<path>[^'\"]+)['\"]\s*,\s*['\"][^'\"]*[wax+][^'\"]*['\"]",
        flags=re.IGNORECASE,
    )
    for match in pattern.finditer(command):
        path = resolve_candidate_path(match.group("path"), cwd)
        if path is not None:
            targets.append(path)
    return targets


def extract_token_write_targets(command: str, cwd: Path) -> Tuple[List[Path], bool]:
    tokens = split_shell(command)
    if not tokens:
        return [], False

    targets: List[Path] = []
    saw_unresolved_mutation = False
    index = 0
    while index < len(tokens):
        token = tokens[index]
        name = command_basename(token)

        if name in {"touch", "mkdir", "rm", "chmod", "chown"}:
            args = collect_until_separator(tokens, index + 1)
            path_args = [arg for arg in args if not arg.startswith("-")]
            if name in {"chmod", "chown"} and path_args:
                path_args = path_args[1:]
            if not path_args:
                saw_unresolved_mutation = True
            for arg in path_args:
                path = resolve_candidate_path(arg, cwd)
                if path is not None:
                    targets.append(path)
            index += max(len(args), 1)

        elif name in {"cp", "mv"}:
            args = [arg for arg in collect_until_separator(tokens, index + 1) if not arg.startswith("-")]
            if args:
                path = resolve_candidate_path(args[-1], cwd)
                if path is not None:
                    targets.append(path)
            else:
                saw_unresolved_mutation = True
            index += max(len(args), 1)

        elif name == "tee":
            args = [arg for arg in collect_until_separator(tokens, index + 1) if not arg.startswith("-")]
            if not args:
                saw_unresolved_mutation = True
            for arg in args:
                path = resolve_candidate_path(arg, cwd)
                if path is not None:
                    targets.append(path)
            index += max(len(args), 1)

        elif name == "zip":
            args = [arg for arg in collect_until_separator(tokens, index + 1) if not arg.startswith("-")]
            if args:
                path = resolve_candidate_path(args[0], cwd)
                if path is not None:
                    targets.append(path)
            else:
                saw_unresolved_mutation = True
            index += max(len(args), 1)

        index += 1

    return targets, saw_unresolved_mutation


def extract_write_targets(command: str, cwd: Path) -> Tuple[List[Path], bool]:
    targets = extract_redirection_targets(command, cwd)
    targets.extend(extract_python_open_targets(command, cwd))
    token_targets, unresolved = extract_token_write_targets(command, cwd)
    targets.extend(token_targets)
    deduped: List[Path] = []
    seen = set()
    for target in targets:
        key = str(target)
        if key not in seen:
            deduped.append(target)
            seen.add(key)
    return deduped, unresolved


def bash_mutation_reason(event: Dict[str, Any], state: Dict[str, Any]) -> Tuple[bool, str]:
    command = tool_command(event)
    for pattern, reason in ALWAYS_DENY_BASH_PATTERNS:
        if re.search(pattern, command, flags=re.IGNORECASE | re.DOTALL):
            return True, f"{reason}: {pattern}"

    targets, unresolved = extract_write_targets(command, event_cwd(event))
    if targets:
        unauthorized = [path for path in targets if not is_allowed_artifact_write(path, event, state)]
        if unauthorized:
            return True, "writes outside party-mode artifact paths: " + ", ".join(str(path) for path in unauthorized[:5])
        return False, "writes only to designated party-mode artifacts"
    if unresolved:
        return True, "write-like shell command target could not be verified as artifact-only"
    return False, "Bash command appears read-only"


def mcp_mutation_reason(event: Dict[str, Any]) -> Tuple[bool, str]:
    tool_name = str(event.get("tool_name") or "")
    lowered_name = tool_name.lower()
    name_words = set(re.split(r"[_\W]+", lowered_name))
    has_readonly_word = bool(name_words & READONLY_MCP_WORDS)
    has_mutating_word = bool(name_words & MUTATING_MCP_WORDS)
    if has_mutating_word and not has_readonly_word:
        return True, f"MCP tool name appears mutating: {tool_name}"

    try:
        payload = json.dumps(event.get("tool_input"), sort_keys=True)
    except Exception:
        payload = str(event.get("tool_input"))
    lowered_payload = payload.lower()
    if re.search(r'"readonlyhint"\s*:\s*false', lowered_payload):
        return True, f"MCP tool declares non-read-only behavior: {tool_name}"
    if re.search(r'"(operation|action|method|kind)"\s*:\s*"(create|update|delete|patch|write|insert|upsert|remove|rename|move)"', lowered_payload):
        return True, f"MCP tool input requests mutation: {tool_name}"
    return False, "MCP tool appears read-only"


def is_mutating_tool(event: Dict[str, Any], state: Dict[str, Any] | None = None) -> Tuple[bool, str]:
    state = state or read_state(event)
    tool_name = str(event.get("tool_name") or "")
    lowered = tool_name.lower()
    if lowered in {"apply_patch", "edit", "write"} or lowered.endswith(".apply_patch"):
        return True, f"{tool_name} is a write/edit tool"
    if lowered.startswith("mcp__"):
        return mcp_mutation_reason(event)
    if lowered == "bash":
        return bash_mutation_reason(event, state)
    return False, "tool appears read-only"


def output_suggests_mutation(event: Dict[str, Any]) -> Tuple[bool, str]:
    text = tool_response_text(event)
    if not text:
        return False, "no tool output"
    for pattern, reason in MUTATION_OUTPUT_PATTERNS:
        if re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE):
            return True, reason
    return False, "tool output does not suggest mutation"


def context_with_state(state: Dict[str, Any]) -> str:
    return (
        f"{PARTY_CONTEXT}\n\n"
        f"Activation score: {state.get('score')}. Reason: {state.get('reason')}.\n"
        f"Artifact directory: {state.get('artifact_dir')}\n"
        f"Final zip path: {state.get('artifact_zip')}"
    )


def user_prompt_submit(event: Dict[str, Any]) -> None:
    prompt = str(event.get("prompt") or "")
    threshold = int(os.environ.get("PARTY_MODE_THRESHOLD", str(DEFAULT_THRESHOLD)))
    score, reason = score_uncertainty(prompt)
    active = score >= threshold
    state = base_state(event, active, score, reason)
    state["activated_at"] = utc_now() if active else None
    write_state(event, state)
    if active:
        emit({
            "continue": True,
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": context_with_state(state),
            },
        })
    else:
        emit({"continue": True})


def pre_tool_use(event: Dict[str, Any]) -> None:
    state = read_state(event)
    if not state.get("active"):
        emit({})
        return

    mutating, reason = is_mutating_tool(event, state)
    if mutating:
        append_state_list(event, "blocked_mutations", {
            "event": "PreToolUse",
            "tool_name": event.get("tool_name"),
            "reason": reason,
            "at": utc_now(),
        })
        emit({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": f"Party mode is read-only. Blocked mutation: {reason}",
            },
        })
        return

    emit({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "additionalContext": "Party mode remains active: read-only investigation only. Capture useful output in evidence_manifest.yaml; write only under the designated artifact directory or final zip.",
        },
    })


def permission_request(event: Dict[str, Any]) -> None:
    state = read_state(event)
    if not state.get("active"):
        emit({})
        return

    mutating, reason = is_mutating_tool(event, state)
    if mutating:
        append_state_list(event, "blocked_mutations", {
            "event": "PermissionRequest",
            "tool_name": event.get("tool_name"),
            "reason": reason,
            "at": utc_now(),
        })
        emit({
            "hookSpecificOutput": {
                "hookEventName": "PermissionRequest",
                "decision": {
                    "behavior": "deny",
                    "message": f"Party mode is read-only. Denied approval: {reason}",
                },
            },
        })
    else:
        emit({})


def post_tool_use(event: Dict[str, Any]) -> None:
    state = read_state(event)
    if not state.get("active"):
        emit({})
        return

    mutating, reason = is_mutating_tool(event, state)
    if mutating:
        append_state_list(event, "observations", {
            "event": "PostToolUse",
            "severity": "mutation_detected",
            "tool_name": event.get("tool_name"),
            "reason": reason,
            "at": utc_now(),
        })
        emit({
            "decision": "block",
            "reason": f"A mutating tool appears to have run during party mode: {reason}. Stop implementation behavior, record this in readonly_policy_result.md, and continue investigation only.",
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": "Party mode correction: do not proceed with code edits; record the event and return to read-only evidence collection.",
            },
        })
        return

    output_mutated, output_reason = output_suggests_mutation(event)
    if output_mutated:
        append_state_list(event, "observations", {
            "event": "PostToolUse",
            "severity": "possible_mutation",
            "tool_name": event.get("tool_name"),
            "reason": output_reason,
            "at": utc_now(),
        })
        emit({
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": f"Party mode warning: tool output suggests possible file changes ({output_reason}). Verify with read-only status commands and record the result in readonly_policy_result.md.",
            },
        })
        return

    emit({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": "If this output is useful, summarize it in evidence_manifest.yaml with command/tool, reason, read-only status, and artifact path.",
        },
    })


def subagent_start(event: Dict[str, Any]) -> None:
    state = read_state(event)
    if state.get("active"):
        emit({
            "hookSpecificOutput": {
                "hookEventName": "SubagentStart",
                "additionalContext": context_with_state(state),
            },
        })
    else:
        emit({})


def subagent_stop(event: Dict[str, Any]) -> None:
    state = read_state(event)
    if not state.get("active") or event.get("stop_hook_active"):
        emit({"continue": True})
        return

    msg = str(event.get("last_assistant_message") or "").lower()
    required_terms = ("finding", "evidence", "artifact", "risk", "confidence")
    found = sum(1 for term in required_terms if term in msg)
    if found < 2:
        emit({
            "decision": "block",
            "reason": "Continue the party-mode subagent pass. Provide an artifact-ready summary with findings, evidence references, risks, confidence, and read-only confirmation.",
        })
    else:
        emit({"continue": True})


def iter_message_zip_paths(message: str, event: Dict[str, Any]) -> Iterable[Path]:
    cwd = event_cwd(event)
    pattern = re.compile(r"(?P<path>(?:~|/|\.{1,2}/)?[A-Za-z0-9_./ -]*?[A-Za-z0-9_.-]+\.zip)")
    for match in pattern.finditer(message):
        path = resolve_candidate_path(match.group("path"), cwd)
        if path is not None:
            yield path


def candidate_zip_paths(event: Dict[str, Any], state: Dict[str, Any]) -> List[Path]:
    candidates: List[Path] = []
    message = str(event.get("last_assistant_message") or "")
    candidates.extend(iter_message_zip_paths(message, event))

    artifact_dir, artifact_zip = allowed_artifact_paths(event, state)
    candidates.append(artifact_zip)
    cwd = event_cwd(event)
    candidates.append(cwd / "party-mode-output.zip")
    candidates.append(cwd / "party_mode_output.zip")
    candidates.append(cwd / "party_mode_uncertainty_handoff.zip")

    for root in {artifact_dir, cwd}:
        try:
            candidates.extend(sorted(root.glob("*.zip"), key=lambda p: p.stat().st_mtime, reverse=True))
        except Exception:
            pass

    deduped: List[Path] = []
    seen = set()
    for path in candidates:
        key = str(path)
        if key not in seen:
            deduped.append(path)
            seen.add(key)
    return deduped


def zip_missing_artifacts(path: Path) -> Tuple[bool, List[str]]:
    if not path.exists():
        return False, [".zip file exists"]
    if not zipfile.is_zipfile(path):
        return False, [".zip file is valid"]

    try:
        with zipfile.ZipFile(path) as archive:
            names = [name.replace("\\", "/").lstrip("/") for name in archive.namelist()]
    except Exception:
        return False, [".zip file is readable"]

    missing = [
        required
        for required in REQUIRED_FINAL_ARTIFACTS
        if not any(name == required or name.endswith("/" + required) for name in names)
    ]
    if not any(name.startswith(SUPPORTING_ARTIFACT_PREFIX) and not name.endswith("/") for name in names):
        missing.append(f"{SUPPORTING_ARTIFACT_PREFIX} supporting artifacts")
    return not missing, missing


def final_handoff_status(event: Dict[str, Any], state: Dict[str, Any]) -> Tuple[bool, str, List[str]]:
    checked: List[str] = []
    best_missing: List[str] = [".zip"]
    for path in candidate_zip_paths(event, state):
        checked.append(str(path))
        complete, missing = zip_missing_artifacts(path)
        if complete:
            return True, str(path), []
        if len(missing) < len(best_missing) or best_missing == [".zip"]:
            best_missing = missing

    if checked:
        detail = "checked: " + ", ".join(checked[:5])
    else:
        detail = "no zip candidates found"
    return False, detail, best_missing


def stop(event: Dict[str, Any]) -> None:
    state = read_state(event)
    if not state.get("active") or event.get("stop_hook_active"):
        emit({"continue": True})
        return

    complete, detail, missing = final_handoff_status(event, state)
    if not complete:
        emit({
            "decision": "block",
            "reason": (
                "Continue party mode. Final handoff is incomplete. Produce a valid zip containing "
                "investigation_report.md, next_goal.md, evidence_manifest.yaml, readonly_policy_result.md, "
                "and supporting artifacts. Missing: " + ", ".join(missing) + ". " + detail
            ),
        })
    else:
        emit({"continue": True})


def main() -> int:
    try:
        event = json.load(sys.stdin)
    except Exception as exc:
        emit({"systemMessage": f"party_mode_router could not parse hook input: {exc}"})
        return 0

    handlers = {
        "UserPromptSubmit": user_prompt_submit,
        "PreToolUse": pre_tool_use,
        "PermissionRequest": permission_request,
        "PostToolUse": post_tool_use,
        "SubagentStart": subagent_start,
        "SubagentStop": subagent_stop,
        "Stop": stop,
    }
    handler = handlers.get(str(event.get("hook_event_name")))
    if handler:
        handler(event)
    else:
        emit({})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
