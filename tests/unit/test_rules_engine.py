#!/usr/bin/env python3
"""
tests/unit/test_rules_engine.py
Unit tests for persona_graph_memory host normalization and priority cascade matching.
"""
import os
import sys
import tempfile
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import persona_graph_memory


def test_norm_host_extraction():
    """Verify norm_host correctly extracts clean hostname and base domain."""
    assert persona_graph_memory.norm_host("https://survey.tolunastart.com/path?query=1") == "survey.tolunastart.com"
    assert persona_graph_memory.norm_host("HTTP://meinungsplatz.ch/SURVEY") == "meinungsplatz.ch"
    assert persona_graph_memory.base_domain("survey.tolunastart.com") == "tolunastart.com"
    assert persona_graph_memory.base_domain("*") == "*"


def test_get_host_rules_priority_cascade():
    """
    Verify priority cascade in get_host_rules():
    Score precedence: exact host (4) > base domain (3) > provider_id (2) > wildcard * (1)
    and exact persona (2) > wildcard persona (1).
    Highest priority score MUST win and deduplicate per pattern.
    """
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        test_db = os.path.join(tmpdir, "test_rules.db")
        persona_graph_memory.DB_PATH = test_db
        
        # Init schema
        conn = persona_graph_memory._connect()
        conn.close()

        # Insert 3 competing rules for same pattern 'tobacco'
        # Rule 1: Wildcard host '*', wildcard persona '*' (Score: 1 + 1 = 2)
        persona_graph_memory.record_host_rule(
            host="*", pattern="tobacco", behavior="Global tobacco rule",
            persona="*", source="seed", status="active"
        )

        # Rule 2: Base domain 'tolunastart.com', exact persona 'arno' (Score: 3 + 2 = 5)
        persona_graph_memory.record_host_rule(
            host="tolunastart.com", pattern="tobacco", behavior="Base domain tobacco rule",
            persona="arno", source="human_override", status="active"
        )

        # Rule 3: Exact host 'survey.tolunastart.com', exact persona 'arno' (Score: 4 + 2 = 6)
        persona_graph_memory.record_host_rule(
            host="survey.tolunastart.com", pattern="tobacco", behavior="Exact host tobacco rule",
            persona="arno", source="human_override", status="active"
        )

        # Query rules for exact host 'survey.tolunastart.com' and persona 'arno'
        rules = persona_graph_memory.get_host_rules(host="survey.tolunastart.com", persona="arno")

        # Must return EXACTLY 1 rule for pattern 'tobacco'
        tobacco_rules = [r for r in rules if r['pattern'] == 'tobacco']
        assert len(tobacco_rules) == 1, f"Expected 1 deduplicated rule, got {len(tobacco_rules)}"

        # The winning rule MUST be Rule 3 (Exact host score 6)
        winning_rule = tobacco_rules[0]
        assert winning_rule['host'] == "survey.tolunastart.com", f"Expected exact host winner, got {winning_rule['host']}"
        assert winning_rule['behavior'] == "Exact host tobacco rule"


def test_classify_outcome_study_already_participated():
    """Verify classify_outcome accurately classifies 'MALHEUREUSEMENT VOUS AVEZ DÉJÀ PARTICIPÉ À CETTE ÉTUDE.' as disqualified."""
    import reflection
    page_text = "MALHEUREUSEMENT VOUS AVEZ DÉJÀ PARTICIPÉ À CETTE ÉTUDE. Pourquoi ne pas mettre à jour votre profil maintenant ?"
    outcome, reason = reflection.classify_outcome(
        final_text=page_text,
        final_url="https://survey.maximiles.com/survey",
        gemma_said_done=False,
        dry_run=False
    )
    assert outcome == "disqualified"
    assert "déjà participé" in reason


def test_structure_hash_ignores_text_changes():
    """Verify compute_structure_hash produces identical hash when question/answer text changes but DOM skeleton is identical."""
    dom_v1 = [
        {"tag": "div", "type": "", "role": "container", "text": "What is your primary age group?"},
        {"tag": "input", "type": "radio", "role": "option", "label": "18-24 years old"},
        {"tag": "input", "type": "radio", "role": "option", "label": "25-34 years old"},
        {"tag": "button", "type": "submit", "role": "button", "innerText": "Next Page"},
    ]
    dom_v2 = [
        {"tag": "div", "type": "", "role": "container", "text": "Quel est votre niveau d'études?"},
        {"tag": "input", "type": "radio", "role": "option", "label": "Secondaire / Bac"},
        {"tag": "input", "type": "radio", "role": "option", "label": "Université / Master"},
        {"tag": "button", "type": "submit", "role": "button", "innerText": "Page Suivante"},
    ]
    hash_v1 = persona_graph_memory.compute_structure_hash(dom_v1)
    hash_v2 = persona_graph_memory.compute_structure_hash(dom_v2)
    assert hash_v1 == hash_v2, f"Expected identical structure hash, got {hash_v1} vs {hash_v2}"

    dom_v3 = [
        {"tag": "div", "type": "", "role": "container", "text": "What is your primary age group?"},
        {"tag": "input", "type": "checkbox", "role": "option", "label": "18-24 years old"},
        {"tag": "button", "type": "submit", "role": "button", "innerText": "Next Page"},
    ]
    hash_v3 = persona_graph_memory.compute_structure_hash(dom_v3)
    assert hash_v1 != hash_v3, "Expected different structure hash when skeleton changes"


def test_4_level_scope_priority():
    """Verify EXACT_LAYOUT overrides HOST_PATTERN in 4-level scope hierarchy."""
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        test_db = os.path.join(tmpdir, "test_scope.db")
        persona_graph_memory.DB_PATH = test_db

        conn = persona_graph_memory._connect()
        conn.close()
        target_hash = "layout_hash_12345"

        # Host pattern rule
        persona_graph_memory.record_host_rule(
            host="survey.qualtrics.com",
            pattern="tobacco",
            behavior="Host pattern tobacco rule",
            persona="arno",
            source="human_override",
            status="active",
            scope="HOST_PATTERN"
        )

        # Exact layout rule
        persona_graph_memory.record_host_rule(
            host="survey.qualtrics.com",
            pattern="tobacco",
            behavior="Exact layout tobacco rule",
            persona="arno",
            source="human_override",
            status="active",
            structure_hash=target_hash,
            scope="EXACT_LAYOUT"
        )

        # Query with structure_hash matching EXACT_LAYOUT
        rules = persona_graph_memory.get_host_rules(
            host="survey.qualtrics.com",
            persona="arno",
            structure_hash=target_hash
        )

        assert len(rules) == 1, f"Expected 1 deduplicated rule, got {len(rules)}"
        winning_rule = rules[0]
        assert winning_rule["scope"] == "EXACT_LAYOUT"
        assert winning_rule["behavior"] == "Exact layout tobacco rule", f"EXACT_LAYOUT did not override HOST_PATTERN: {winning_rule['behavior']}"

