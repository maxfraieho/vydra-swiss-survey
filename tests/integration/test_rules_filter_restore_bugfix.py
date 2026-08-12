"""Integration tests for Feature 015 — Rules DB Filter Restoration & All-Rules Query Normalization."""

import pytest
import persona_graph_memory


def test_list_rules_raw_handles_all_and_wildcard_filters():
    """Verify list_rules_raw ignores 'all', 'undefined', 'null', '*' filter values and returns all rules."""
    total_rules = len(persona_graph_memory.list_rules_raw())
    assert total_rules == 37, f"Expected 37 rules in test DB, got {total_rules}"

    rules_all = persona_graph_memory.list_rules_raw(status="all")
    assert len(rules_all) == total_rules, f"Expected {total_rules} rules for status=all, got {len(rules_all)}"

    rules_undefined = persona_graph_memory.list_rules_raw(host="undefined")
    assert len(rules_undefined) == total_rules, f"Expected {total_rules} rules for host=undefined, got {len(rules_undefined)}"

    rules_wildcard = persona_graph_memory.list_rules_raw(persona="*")
    assert len(rules_wildcard) == total_rules, f"Expected {total_rules} rules for persona=*, got {len(rules_wildcard)}"


def test_list_rules_raw_specific_filters():
    """Verify specific filters like host='espacedopinion.ch' still filter correctly."""
    espaced_rules = persona_graph_memory.list_rules_raw(host="espacedopinion.ch")
    assert len(espaced_rules) == 1, f"Expected 1 rule for espacedopinion.ch, got {len(espaced_rules)}"
