#!/usr/bin/env python3
"""
tests/integration/test_p5_self_healing.py
Integration and unit tests for Phase P5 self-healing & captcha resilience.
"""
import os
import sys
import argparse
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from cdp_client import CDPClient
from astryx_survey_server import notify_tutor_captcha_blocking


class TestP5CaptchaDetection(unittest.TestCase):
    """Tests for detect_captcha_signatures in cdp_client.py."""

    def test_detect_captcha_signatures_positive(self):
        client = CDPClient.__new__(CDPClient)
        client.ws = MagicMock()
        client._send = MagicMock(return_value={
            "result": {
                "value": '["cf-turnstile", "g-recaptcha"]'
            }
        })

        sigs = client.detect_captcha_signatures()
        self.assertEqual(sigs, ["cf-turnstile", "g-recaptcha"])
        client._send.assert_called_once()

    def test_detect_captcha_signatures_none_found(self):
        client = CDPClient.__new__(CDPClient)
        client.ws = MagicMock()
        client._send = MagicMock(return_value={
            "result": {
                "value": '[]'
            }
        })

        sigs = client.detect_captcha_signatures()
        self.assertEqual(sigs, [])

    def test_detect_captcha_signatures_exception(self):
        client = CDPClient.__new__(CDPClient)
        client.ws = MagicMock()
        client._send = MagicMock(side_effect=Exception("CDP WebSocket error"))

        sigs = client.detect_captcha_signatures()
        self.assertEqual(sigs, [])


class TestP5NotifyTutorCaptchaBlocking(unittest.TestCase):
    """Tests for notify_tutor_captcha_blocking in astryx_survey_server.py."""

    @patch("astryx_survey_server.get_telegram_bot_token", return_value="123456:ABC-DEF1234ghIkl-zyx54321")
    @patch.dict(os.environ, {"TELEGRAM_CHAT_ID": "987654321"})
    @patch("urllib.request.urlopen")
    def test_notify_tutor_success(self, mock_urlopen, mock_token):
        mock_response = MagicMock()
        mock_response.read.return_value = b'{"ok": true, "result": {}}'
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        res = notify_tutor_captcha_blocking("arno", "https://survey.example.com", ["cf-turnstile"])
        self.assertTrue(res)
        mock_urlopen.assert_called_once()

    @patch("astryx_survey_server.get_telegram_bot_token", return_value="")
    @patch.dict(os.environ, {"TELEGRAM_CHAT_ID": ""})
    def test_notify_tutor_missing_credentials(self, mock_token):
        with patch("persona_graph_memory.get_setting", return_value=""):
            res = notify_tutor_captcha_blocking("arno", "https://survey.example.com", ["g-recaptcha"])
            self.assertFalse(res)

    @patch("astryx_survey_server.get_telegram_bot_token", return_value="123456:ABC")
    @patch.dict(os.environ, {"TELEGRAM_CHAT_ID": "12345"})
    @patch("urllib.request.urlopen", side_effect=Exception("Network error"))
    def test_notify_tutor_network_failure(self, mock_urlopen, mock_token):
        res = notify_tutor_captcha_blocking("arno", "https://survey.example.com", ["hcaptcha"])
        self.assertFalse(res)


class TestP5SurveyAgentNoRecoveryFlag(unittest.TestCase):
    """Tests for --no-recovery flag handling and captcha pausing/logging in survey_agent.py."""

    def test_no_recovery_cli_argument(self):
        ap = argparse.ArgumentParser()
        ap.add_argument("--no-recovery", action="store_true")
        args = ap.parse_args(["--no-recovery"])
        self.assertTrue(args.no_recovery)

        args_default = ap.parse_args([])
        self.assertFalse(args_default.no_recovery)

    @patch("sys.argv", ["survey_agent.py", "--profile", "arno", "--url", "https://example.com/survey", "--no-recovery", "--force"])
    @patch("survey_agent.CDPClient")
    @patch("survey_agent.GemmaVision")
    @patch("survey_agent.heavy_state_busy", return_value=[])
    @patch("survey_agent.load_persona", return_value=("persona content", []))
    def test_no_recovery_exits_on_captcha(self, mock_load, mock_busy, mock_vision, mock_cdp_cls):
        import survey_agent
        mock_cdp = MagicMock()
        mock_cdp.detect_captcha_signatures.return_value = ["cf-turnstile"]
        mock_cdp.get_current_url.return_value = "https://example.com/survey"
        mock_cdp_cls.return_value = mock_cdp

        with patch("astryx_survey_server.notify_tutor_captcha_blocking") as mock_notify:
            try:
                survey_agent.main()
            except SystemExit:
                pass
            mock_cdp.detect_captcha_signatures.assert_called()
            mock_notify.assert_not_called()

    @patch("sys.argv", ["survey_agent.py", "--profile", "arno", "--url", "https://example.com/survey", "--force", "--max-steps", "1"])
    @patch("survey_agent.CDPClient")
    @patch("survey_agent.GemmaVision")
    @patch("survey_agent.heavy_state_busy", return_value=[])
    @patch("survey_agent.load_persona", return_value=("persona content", []))
    def test_undetected_captcha_warning_logged(self, mock_load, mock_busy, mock_vision_cls, mock_cdp_cls):
        import survey_agent
        mock_cdp = MagicMock()
        mock_cdp.detect_captcha_signatures.return_value = []
        mock_cdp.get_current_url.return_value = "https://example.com/survey"
        mock_cdp.click_by_text.return_value = False
        mock_cdp.find_submit_button.return_value = None
        mock_cdp_cls.return_value = mock_cdp

        mock_vision = MagicMock()
        mock_vision.decide_action.return_value = {"action": "click", "target_text": "NonExistentButton"}
        mock_vision_cls.return_value = mock_vision

        with patch("builtins.print") as mock_print:
            try:
                survey_agent.main()
            except Exception:
                pass
            printed_msgs = [call.args[0] for call in mock_print.call_args_list if call.args]
            self.assertTrue(any("⚠️ Undetected captcha or page blockage suspected at https://example.com/survey" in msg for msg in printed_msgs))


if __name__ == "__main__":
    unittest.main()
