import unittest
import json
from astryx_survey_server import app, ACTIVE_SURVEY_STATE, STATE_LOCK, PROFILES


class TestFeature021D(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_resume_tab_endpoint_success(self):
        with STATE_LOCK:
            ACTIVE_SURVEY_STATE["status"] = "idle"
            ACTIVE_SURVEY_STATE["url"] = ""
            ACTIVE_SURVEY_STATE["profile"] = "arno"

        res = self.app.post(
            "/api/survey/resume_tab",
            json={"profile": "arno", "resume_tab_url": "https://meinungsplatz.ch/survey/123"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")

        with STATE_LOCK:
            self.assertIn(ACTIVE_SURVEY_STATE["status"], ["starting", "running"])
            self.assertEqual(ACTIVE_SURVEY_STATE["profile"], "arno")
            self.assertEqual(ACTIVE_SURVEY_STATE["url"], "https://meinungsplatz.ch/survey/123")

    def test_resume_tab_endpoint_validation_missing_url(self):
        res = self.app.post(
            "/api/survey/resume_tab",
            json={"profile": "arno", "resume_tab_url": ""},
        )
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data.get("status"), "error")

    def test_resume_tab_endpoint_validation_unknown_profile(self):
        res = self.app.post(
            "/api/survey/resume_tab",
            json={"profile": "non_existent_persona", "resume_tab_url": "https://meinungsplatz.ch/survey/123"},
        )
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data.get("status"), "error")


if __name__ == "__main__":
    unittest.main()
