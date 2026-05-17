#!/bin/sh
# SessionStart hook: verify the restored Codex task list exists and is accessible.
#
# Input: JSON on stdin with session_id, hook_event_name, etc.
# Output: JSON with systemMessage (shown to user) or additionalContext.

cat >/dev/null || true

TASK_LIST_ID="${CODEX_TASK_LIST_ID:-}"

if [ -z "$TASK_LIST_ID" ]; then
  exit 0
fi

case "$TASK_LIST_ID" in
  "." | ".." | *".."* | */* | *\\* | *[!A-Za-z0-9._-]*)
    printf '{"systemMessage":"Warning: Ignoring unsafe CODEX_TASK_LIST_ID."}\n'
    exit 0
    ;;
esac

TASK_ROOT="${CODEX_TASKS_DIR:-$HOME/.codex/tasks}"
TASK_DIR="$TASK_ROOT/$TASK_LIST_ID"

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

emit_message() {
  message=$(json_escape "$1")
  printf '{"systemMessage":"%s"}\n' "$message"
}

ROOT_REAL=$(cd -P "$TASK_ROOT" 2>/dev/null && pwd -P)

if [ -z "$ROOT_REAL" ]; then
  emit_message "Warning: Codex task root is not accessible. Task list $TASK_LIST_ID was not checked."
  exit 0
fi

if [ -d "$TASK_DIR" ]; then
  TASK_REAL=$(cd -P "$TASK_DIR" 2>/dev/null && pwd -P)
  case "$TASK_REAL/" in
    "$ROOT_REAL"/*) ;;
    *)
      emit_message "Warning: Task list $TASK_LIST_ID resolves outside the Codex task root. Ignoring it."
      exit 0
      ;;
  esac

  TASK_COUNT=$(find "$TASK_REAL" -maxdepth 1 -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
  emit_message "Task list $TASK_LIST_ID restored ($TASK_COUNT tasks). Use TaskList to review."
else
  emit_message "Warning: Task list $TASK_LIST_ID not found at $TASK_DIR. It may have been cleaned up."
fi

exit 0
