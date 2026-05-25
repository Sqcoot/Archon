import json
import os
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ROUTER = ROOT / "hooks" / "party_mode_router.py"


class PartyModeRouterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.state_dir = self.root / "state"
        self.artifact_dir = self.root / "party-mode-output"
        self.zip_path = self.root / "party-mode-output.zip"
        self.env = os.environ.copy()
        self.env["PARTY_MODE_STATE_DIR"] = str(self.state_dir)
        self.env["PARTY_MODE_ARTIFACT_DIR"] = str(self.artifact_dir)
        self.env["PARTY_MODE_ZIP_PATH"] = str(self.zip_path)
        self.env.pop("PARTY_MODE", None)

    def tearDown(self):
        self.temp.cleanup()

    def run_event(self, event):
        base = {
            "session_id": "session-1",
            "turn_id": "turn-1",
            "cwd": str(self.root),
            "model": "gpt-test",
        }
        base.update(event)
        result = subprocess.run(
            [sys.executable, str(ROUTER)],
            input=json.dumps(base),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=self.env,
            check=True,
        )
        self.assertEqual("", result.stderr)
        return json.loads(result.stdout)

    def activate(self):
        return self.run_event({
            "hook_event_name": "UserPromptSubmit",
            "prompt": "Use party mode to investigate why auth is failing. Do not edit code.",
        })

    def test_explicit_party_mode_activates_and_injects_context(self):
        output = self.activate()
        self.assertTrue(output["continue"])
        context = output["hookSpecificOutput"]["additionalContext"]
        self.assertIn("Party mode is active", context)
        self.assertIn(str(self.artifact_dir), context)

    def test_normal_low_risk_prompt_does_not_activate(self):
        output = self.run_event({
            "hook_event_name": "UserPromptSubmit",
            "prompt": "Add a label to the profile button in src/Profile.tsx.",
        })
        self.assertEqual({"continue": True}, output)

    def test_pre_tool_use_denies_mutating_shell_command(self):
        self.activate()
        output = self.run_event({
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "tool_input": {"command": "sed -i '' 's/a/b/' src/app.py"},
        })
        hook_output = output["hookSpecificOutput"]
        self.assertEqual("PreToolUse", hook_output["hookEventName"])
        self.assertEqual("deny", hook_output["permissionDecision"])
        self.assertIn("Party mode is read-only", hook_output["permissionDecisionReason"])

    def test_permission_request_denies_apply_patch(self):
        self.activate()
        output = self.run_event({
            "hook_event_name": "PermissionRequest",
            "tool_name": "apply_patch",
            "tool_input": {"command": "*** Begin Patch\n*** End Patch"},
        })
        decision = output["hookSpecificOutput"]["decision"]
        self.assertEqual("deny", decision["behavior"])
        self.assertIn("read-only", decision["message"])

    def test_artifact_writes_are_allowed(self):
        self.activate()
        command = f"mkdir -p {shlex_quote(str(self.artifact_dir))} && tee {shlex_quote(str(self.artifact_dir / 'notes.md'))}"
        output = self.run_event({
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "tool_input": {"command": command},
        })
        hook_output = output["hookSpecificOutput"]
        self.assertEqual("PreToolUse", hook_output["hookEventName"])
        self.assertNotIn("permissionDecision", hook_output)
        self.assertIn("read-only investigation", hook_output["additionalContext"])

    def test_mutating_mcp_tool_is_denied(self):
        self.activate()
        output = self.run_event({
            "hook_event_name": "PreToolUse",
            "tool_name": "mcp__github__create_issue",
            "tool_input": {"title": "write from hook"},
        })
        self.assertEqual("deny", output["hookSpecificOutput"]["permissionDecision"])

    def test_subagent_start_receives_readonly_contract(self):
        self.activate()
        output = self.run_event({
            "hook_event_name": "SubagentStart",
            "agent_id": "agent-1",
            "agent_type": "general",
        })
        context = output["hookSpecificOutput"]["additionalContext"]
        self.assertIn("read-only investigation", context)

    def test_stop_blocks_when_handoff_zip_missing(self):
        self.activate()
        output = self.run_event({
            "hook_event_name": "Stop",
            "last_assistant_message": "Done.",
            "stop_hook_active": False,
        })
        self.assertEqual("block", output["decision"])
        self.assertIn("Final handoff is incomplete", output["reason"])

    def test_stop_allows_complete_handoff_zip(self):
        self.activate()
        self.artifact_dir.mkdir(parents=True)
        with zipfile.ZipFile(self.zip_path, "w") as archive:
            for name in [
                "investigation_report.md",
                "next_goal.md",
                "evidence_manifest.yaml",
                "readonly_policy_result.md",
                "artifacts/notes.md",
            ]:
                archive.writestr(name, f"{name}\n")
        output = self.run_event({
            "hook_event_name": "Stop",
            "last_assistant_message": f"Created {self.zip_path}",
            "stop_hook_active": False,
        })
        self.assertEqual({"continue": True}, output)


def shlex_quote(value):
    return "'" + value.replace("'", "'\"'\"'") + "'"


if __name__ == "__main__":
    unittest.main()
