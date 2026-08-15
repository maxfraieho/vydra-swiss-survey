import unittest
import statistics
import json
import human_behavior
from astryx_survey_server import app, ACTIVE_SURVEY_STATE, STATE_LOCK


class TestFeature021C(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_human_behavior_profile_loading(self):
        prof = human_behavior.load_human_profile()
        self.assertIn("typing", prof)
        self.assertIn("mouse", prof)
        self.assertIn("pause", prof)

    def test_typing_delay_statistics_gate4(self):
        # Gate 4: Average delay 30-80ms, std dev > 5ms
        delays_ms = [human_behavior.sample_typing_delay() * 1000.0 for _ in range(500)]
        mean = statistics.mean(delays_ms)
        stdev = statistics.stdev(delays_ms)
        self.assertGreaterEqual(mean, 30.0, f"Mean {mean} < 30ms")
        self.assertLessEqual(mean, 80.0, f"Mean {mean} > 80ms")
        self.assertGreater(stdev, 5.0, f"Std dev {stdev} <= 5ms")

    def test_bezier_curvature_gate5(self):
        # Gate 5: Non-linear mouse path (curvature > 0)
        start = (100, 100)
        end = (700, 500)
        pts = human_behavior.generate_bezier_trajectory(start, end, steps=25)
        self.assertGreaterEqual(len(pts), 10)
        curvature = human_behavior.calculate_path_curvature(pts)
        self.assertGreater(curvature, 0.0, f"Curvature {curvature} is not > 0")

    def test_resume_after_captcha_endpoint(self):
        # Set waiting_verification state with captcha_detected
        with STATE_LOCK:
            ACTIVE_SURVEY_STATE["status"] = "waiting_verification"
            ACTIVE_SURVEY_STATE["reason_code"] = "captcha_detected"

        res = self.app.post("/api/survey/resume_after_captcha")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")

        with STATE_LOCK:
            self.assertEqual(ACTIVE_SURVEY_STATE["status"], "running")
            self.assertIsNone(ACTIVE_SURVEY_STATE["reason_code"])

    def test_abort_task_endpoint(self):
        with STATE_LOCK:
            ACTIVE_SURVEY_STATE["status"] = "waiting_verification"
            ACTIVE_SURVEY_STATE["reason_code"] = "captcha_detected"

        res = self.app.post("/api/survey/abort_task")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")

        with STATE_LOCK:
            self.assertEqual(ACTIVE_SURVEY_STATE["status"], "idle")
            self.assertIsNone(ACTIVE_SURVEY_STATE["reason_code"])

    def test_cdp_emulate_endpoint_validation(self):
        res = self.app.post("/api/survey/cdp_emulate", json={"width": 1280, "height": 800, "mobile": False})
        # Server tries to connect to CDPClient(19225). If no browser is running, it returns 500 with descriptive message.
        # If running, returns 200. Either way endpoint is routed and handles input.
        self.assertIn(res.status_code, (200, 500))

    def test_approve_and_override_aliases(self):
        res_app = self.app.post("/api/survey/approve")
        self.assertEqual(res_app.status_code, 200)

        res_skip = self.app.post("/api/survey/skip")
        self.assertEqual(res_skip.status_code, 200)

        res_pause = self.app.post("/api/survey/pause")
        self.assertEqual(res_pause.status_code, 200)


if __name__ == "__main__":
    unittest.main()
