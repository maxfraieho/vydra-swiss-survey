"""Behavioral tests for scripts/sdd_llm_judge.py — mocked HTTP, no live proxy calls.

Each test exercises a real decision branch and can genuinely fail if the
fail-open logic regresses (non-tautological, per constitution invariant
on honest testing: no `assert x == x`).
"""
import importlib.util
import json
import sys
import types
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch, MagicMock

MODULE_PATH = Path(__file__).resolve().parents[2] / "scripts" / "sdd_llm_judge.py"
spec = importlib.util.spec_from_file_location("sdd_llm_judge", MODULE_PATH)
judge = importlib.util.module_from_spec(spec)
sys.modules["sdd_llm_judge"] = judge
spec.loader.exec_module(judge)


def _fake_response(payload: dict):
    body = json.dumps(payload).encode("utf-8")
    cm = MagicMock()
    cm.__enter__.return_value.read.return_value = body
    cm.__exit__.return_value = False
    return cm


class TestCallJudge(unittest.TestCase):
    def test_unreachable_endpoint_returns_none_not_exception(self):
        """Fail-open: a network error must yield None (skip), never raise
        and never propagate as a blocking failure."""
        with patch("urllib.request.urlopen", side_effect=OSError("connection refused")):
            result = judge.call_judge("prompt", "http://dead:1", "key", "model")
        self.assertIsNone(result)

    def test_401_returns_none_not_exception(self):
        with patch(
            "urllib.request.urlopen",
            side_effect=urllib.error.HTTPError("url", 401, "unauthorized", {}, None),
        ):
            result = judge.call_judge("prompt", "http://x", "bad-key", "model")
        self.assertIsNone(result)

    def test_valid_pass_verdict_parsed(self):
        payload = {
            "choices": [
                {"message": {"content": json.dumps({"verdict": "PASS", "summary": "ok"})}}
            ]
        }
        with patch("urllib.request.urlopen", return_value=_fake_response(payload)):
            result = judge.call_judge("prompt", "http://x", "key", "model")
        self.assertEqual(result["verdict"], "PASS")

    def test_valid_fail_verdict_parsed_with_violations(self):
        payload = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "verdict": "FAIL",
                                "summary": "spec violated",
                                "violations": [
                                    {"rule": "hot-path", "reason": "sync IO added", "file": "survey_agent.py"}
                                ],
                            }
                        )
                    }
                }
            ]
        }
        with patch("urllib.request.urlopen", return_value=_fake_response(payload)):
            result = judge.call_judge("prompt", "http://x", "key", "model")
        self.assertEqual(result["verdict"], "FAIL")
        self.assertEqual(len(result["violations"]), 1)

    def test_json_wrapped_in_prose_is_extracted(self):
        """Model didn't honor a strict-JSON instruction — content has
        prose around the JSON. Must still parse, not silently skip."""
        wrapped = 'Sure, here is the analysis:\n```json\n{"verdict": "PASS", "summary": "fine"}\n```'
        payload = {"choices": [{"message": {"content": wrapped}}]}
        with patch("urllib.request.urlopen", return_value=_fake_response(payload)):
            result = judge.call_judge("prompt", "http://x", "key", "model")
        self.assertEqual(result["verdict"], "PASS")

    def test_garbage_content_returns_none(self):
        payload = {"choices": [{"message": {"content": "not json at all, sorry"}}]}
        with patch("urllib.request.urlopen", return_value=_fake_response(payload)):
            result = judge.call_judge("prompt", "http://x", "key", "model")
        self.assertIsNone(result)


class TestEvaluateDiff(unittest.TestCase):
    def test_disable_flag_skips_without_calling_network(self):
        with patch.dict("os.environ", {"SDD_JUDGE_DISABLE": "1"}):
            with patch("urllib.request.urlopen") as mock_urlopen:
                exit_code = judge.evaluate_diff()
        mock_urlopen.assert_not_called()
        self.assertEqual(exit_code, 0)

    def test_empty_diff_skips_without_calling_network(self):
        with patch.object(judge, "get_staged_diff", return_value=""):
            with patch("urllib.request.urlopen") as mock_urlopen:
                exit_code = judge.evaluate_diff()
        mock_urlopen.assert_not_called()
        self.assertEqual(exit_code, 0)

    def test_no_active_spec_skips_without_calling_network(self):
        with patch.object(judge, "get_staged_diff", return_value="diff --git a/x b/x"):
            with patch.object(judge, "get_active_feature", return_value={}):
                with patch("urllib.request.urlopen") as mock_urlopen:
                    exit_code = judge.evaluate_diff()
        mock_urlopen.assert_not_called()
        self.assertEqual(exit_code, 0)

    def test_fail_verdict_blocks_commit_when_not_dry_run(self):
        with patch.object(judge, "get_staged_diff", return_value="diff --git a/x b/x"):
            with patch.object(
                judge, "get_active_feature", return_value={"spec_dir": "specs/x", "phase": "implement"}
            ):
                with patch.object(judge, "get_spec_and_plan", return_value=("spec text", "plan text")):
                    with patch.dict("os.environ", {"SDD_JUDGE_KEY": "k"}):
                        with patch.object(
                            judge,
                            "call_judge",
                            return_value={"verdict": "FAIL", "summary": "bad", "violations": []},
                        ):
                            with patch.object(judge, "_log_verdict"):
                                exit_code = judge.evaluate_diff(dry_run=False)
        self.assertEqual(exit_code, 1)

    def test_fail_verdict_does_not_block_in_shadow_dry_run_mode(self):
        """This is the whole point of shadow mode — same FAIL verdict,
        different exit code, because dry_run=True."""
        with patch.object(judge, "get_staged_diff", return_value="diff --git a/x b/x"):
            with patch.object(
                judge, "get_active_feature", return_value={"spec_dir": "specs/x", "phase": "implement"}
            ):
                with patch.object(judge, "get_spec_and_plan", return_value=("spec text", "plan text")):
                    with patch.dict("os.environ", {"SDD_JUDGE_KEY": "k"}):
                        with patch.object(
                            judge,
                            "call_judge",
                            return_value={"verdict": "FAIL", "summary": "bad", "violations": []},
                        ):
                            with patch.object(judge, "_log_verdict"):
                                exit_code = judge.evaluate_diff(dry_run=True)
        self.assertEqual(exit_code, 0)


if __name__ == "__main__":
    unittest.main()
