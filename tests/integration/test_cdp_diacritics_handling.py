#!/usr/bin/env python3
"""
tests/integration/test_cdp_diacritics_handling.py
Integration test simulating DOM page text parsing with diacritics mismatch (e.g. "intensité" vs "intensité").
Verifies that reflection matching safely detects patterns or returns None without clicking random DOM nodes.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import cdp_client
import reflection


class MockCDPDOMElement:
    """Mock CDP DOM element representing a rendered survey option."""
    def __init__(self, node_id: int, text: str, selector: str):
        self.node_id = node_id
        self.text = text
        self.selector = selector


class TestCDPDiacriticsHandling(unittest.TestCase):

    def setUp(self):
        # Simulated DOM elements from a French survey page
        self.mock_dom_tree = [
            MockCDPDOMElement(101, "Faible", "input#opt_1"),
            MockCDPDOMElement(102, "Moyenne intensité", "input#opt_2"),
            MockCDPDOMElement(103, "Forte", "input#opt_3"),
        ]

    def test_phrase_matching_on_dom_text(self):
        """Verify phrase matching across DOM text elements using reflection._find_phrase."""
        phrases = {"fr": ["intensité", "faible"]}
        
        matched_elements = [
            elem for elem in self.mock_dom_tree 
            if reflection._find_phrase(elem.text.lower(), phrases) is not None
        ]

        self.assertEqual(len(matched_elements), 2)
        node_ids = [e.node_id for e in matched_elements]
        self.assertIn(101, node_ids)
        self.assertIn(102, node_ids)

    def test_absent_element_returns_none_safely(self):
        """Verify that searching for an absent target phrase returns 0 matches to prevent random clicks."""
        phrases = {"fr": ["nonexistent_option", "invalid_keyword"]}

        matched_elements = [
            elem for elem in self.mock_dom_tree 
            if reflection._find_phrase(elem.text.lower(), phrases) is not None
        ]

        self.assertEqual(len(matched_elements), 0, "Absent target MUST return 0 matches to prevent random clicks")

    def test_french_diacritics_nfd_normalization(self):
        self.assertEqual(cdp_client.normalize_survey_text("intensité"), "intensite")
        self.assertTrue(cdp_client.match_survey_text("intensité", "intensite"))

    def test_german_umlaut_expansion(self):
        self.assertEqual(cdp_client.normalize_survey_text("ä"), "ae")
        self.assertEqual(cdp_client.normalize_survey_text("ö"), "oe")
        self.assertEqual(cdp_client.normalize_survey_text("ü"), "ue")
        self.assertEqual(cdp_client.normalize_survey_text("ß"), "ss")
        self.assertEqual(cdp_client.normalize_survey_text("Präferenz"), "praeferenz")
        self.assertEqual(cdp_client.normalize_survey_text("Groß"), "gross")
        self.assertTrue(cdp_client.match_survey_text("Präferenz", "Praeferenz"))
        self.assertTrue(cdp_client.match_survey_text("Groß", "Gross"))

    def test_short_token_strict_guard(self):
        false_positives = [
            ("oui", "ou"),
            ("non", "on"),
            ("ja", "jan"),
            ("nein", "neinheit"),
        ]
        for token, fp in false_positives:
            self.assertFalse(cdp_client.match_survey_text(token, fp))


if __name__ == "__main__":
    unittest.main()
