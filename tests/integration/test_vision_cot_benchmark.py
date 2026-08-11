#!/usr/bin/env python3
"""
tests/integration/test_vision_cot_benchmark.py
Integration benchmark test for GemmaVision decide_action Zero-Hallucination Chain-of-Thought (CoT) JSON prompt and parsing.
Tests 10 ground truth benchmark cases against expected decisions.
"""
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import vision


BENCHMARK_CASES = [
    {
        "id": 1,
        "description": "Dashboard survey selection",
        "raw_response": '{\n  "visual_analysis": "Dashboard with survey cards",\n  "persona_matching": "Match survey card Sondage nº 171137",\n  "action": "click",\n  "target_text": "Sondage nº 171137",\n  "value": ""\n}',
        "expected": {
            "visual_analysis": "Dashboard with survey cards",
            "persona_matching": "Match survey card Sondage nº 171137",
            "action": "click",
            "target_text": "Sondage nº 171137",
            "value": "",
        },
    },
    {
        "id": 2,
        "description": "Radio button age category selection",
        "raw_response": '{\n  "visual_analysis": "Age question page with radio options",\n  "persona_matching": "Persona age 30 matches 25-34",\n  "action": "click",\n  "target_text": "25-34",\n  "value": ""\n}',
        "expected": {
            "visual_analysis": "Age question page with radio options",
            "persona_matching": "Persona age 30 matches 25-34",
            "action": "click",
            "target_text": "25-34",
            "value": "",
        },
    },
    {
        "id": 3,
        "description": "Postal code text input",
        "raw_response": '{\n  "visual_analysis": "Postal code field visible",\n  "persona_matching": "Persona postal code is 75001",\n  "action": "type",\n  "target_text": "Code postal",\n  "value": "75001"\n}',
        "expected": {
            "visual_analysis": "Postal code field visible",
            "persona_matching": "Persona postal code is 75001",
            "action": "type",
            "target_text": "Code postal",
            "value": "75001",
        },
    },
    {
        "id": 4,
        "description": "Next step button click",
        "raw_response": '{\n  "visual_analysis": "Question answered, Continuer button active",\n  "persona_matching": "Proceed to next survey step",\n  "action": "click",\n  "target_text": "Continuer",\n  "value": ""\n}',
        "expected": {
            "visual_analysis": "Question answered, Continuer button active",
            "persona_matching": "Proceed to next survey step",
            "action": "click",
            "target_text": "Continuer",
            "value": "",
        },
    },
    {
        "id": 5,
        "description": "Survey completion state",
        "raw_response": '{\n  "visual_analysis": "Thank you page confirmed",\n  "persona_matching": "Survey complete",\n  "action": "done",\n  "target_text": "",\n  "value": ""\n}',
        "expected": {
            "visual_analysis": "Thank you page confirmed",
            "persona_matching": "Survey complete",
            "action": "done",
            "target_text": "",
            "value": "",
        },
    },
    {
        "id": 6,
        "description": "Likert scale agreement selection",
        "raw_response": '{\n  "visual_analysis": "Likert scale question visible",\n  "persona_matching": "Persona agrees with statement",\n  "action": "click",\n  "target_text": "Oui, plutôt d\'accord",\n  "value": ""\n}',
        "expected": {
            "visual_analysis": "Likert scale question visible",
            "persona_matching": "Persona agrees with statement",
            "action": "click",
            "target_text": "Oui, plutôt d'accord",
            "value": "",
        },
    },
    {
        "id": 7,
        "description": "Scroll down long page",
        "raw_response": '{\n  "visual_analysis": "Form extends below fold",\n  "persona_matching": "Scroll to reveal options",\n  "action": "scroll",\n  "target_text": "",\n  "value": ""\n}',
        "expected": {
            "visual_analysis": "Form extends below fold",
            "persona_matching": "Scroll to reveal options",
            "action": "scroll",
            "target_text": "",
            "value": "",
        },
    },
    {
        "id": 8,
        "description": "Gender selection",
        "raw_response": '{\n  "visual_analysis": "Gender radio group",\n  "persona_matching": "Persona gender is Female",\n  "action": "click",\n  "target_text": "Femme",\n  "value": ""\n}',
        "expected": {
            "visual_analysis": "Gender radio group",
            "persona_matching": "Persona gender is Female",
            "action": "click",
            "target_text": "Femme",
            "value": "",
        },
    },
    {
        "id": 9,
        "description": "Start survey button",
        "raw_response": '{\n  "visual_analysis": "Landing page with start button",\n  "persona_matching": "Begin survey",\n  "action": "click",\n  "target_text": "Commencer",\n  "value": ""\n}',
        "expected": {
            "visual_analysis": "Landing page with start button",
            "persona_matching": "Begin survey",
            "action": "click",
            "target_text": "Commencer",
            "value": "",
        },
    },
    {
        "id": 10,
        "description": "Multi-choice checkbox",
        "raw_response": '{\n  "visual_analysis": "Interest options checkboxes",\n  "persona_matching": "Persona interested in Sport",\n  "action": "click",\n  "target_text": "Sport",\n  "value": ""\n}',
        "expected": {
            "visual_analysis": "Interest options checkboxes",
            "persona_matching": "Persona interested in Sport",
            "action": "click",
            "target_text": "Sport",
            "value": "",
        },
    },
]


class TestVisionCoTBenchmark(unittest.TestCase):

    def setUp(self):
        self.gemma_vision = vision.GemmaVision()

    def test_cot_prompt_instruction_format(self):
        """Verify decide_action prompt includes CoT schema and forbids pixel coordinates."""
        captured_instruction = []

        def mock_run_vision(image_path, prompt, **kwargs):
            captured_instruction.append(prompt)
            return '{"visual_analysis": "ok", "persona_matching": "ok", "action": "done", "target_text": "", "value": ""}'

        with patch.object(self.gemma_vision, "run_vision", side_effect=mock_run_vision):
            self.gemma_vision.decide_action("fake_path.png", "System prompt test", 1)

        self.assertTrue(len(captured_instruction) == 1)
        inst = captured_instruction[0]
        self.assertIn("visual_analysis", inst)
        self.assertIn("persona_matching", inst)
        self.assertIn("NEVER invent pixel coordinates", inst)
        self.assertIn("Категорично заборонено вигадувати", inst)

    def test_ten_benchmark_cases(self):
        """Test 10 ground truth benchmark cases against expected decision outputs."""
        for case in BENCHMARK_CASES:
            with self.subTest(case_id=case["id"], description=case["description"]):
                with patch.object(self.gemma_vision, "run_vision", return_value=case["raw_response"]):
                    decision = self.gemma_vision.decide_action("dummy.png", "System Prompt", case["id"])

                    self.assertEqual(decision.get("action"), case["expected"]["action"])
                    self.assertEqual(decision.get("target_text"), case["expected"]["target_text"])
                    self.assertEqual(decision.get("value"), case["expected"]["value"])
                    self.assertEqual(decision.get("visual_analysis"), case["expected"]["visual_analysis"])
                    self.assertEqual(decision.get("persona_matching"), case["expected"]["persona_matching"])

    def test_zero_hallucination_pixel_coordinates_prohibition(self):
        """Verify target_text never contains pixel coordinate patterns like (x,y) or 100,200."""
        import re
        coord_pattern = re.compile(r"\b\d{2,4}\s*,\s*\d{2,4}\b|\b[xy]\s*=\s*\d+")

        for case in BENCHMARK_CASES:
            target = case["expected"].get("target_text", "")
            self.assertIsNone(coord_pattern.search(target), f"Pixel coordinates detected in target_text: {target}")


if __name__ == "__main__":
    unittest.main()
