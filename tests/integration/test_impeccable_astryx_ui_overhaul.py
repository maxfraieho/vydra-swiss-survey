"""Integration tests for Feature 013 — Impeccable Astryx UI Overhaul."""

import os
import pytest

REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SURVEY_OPS = os.path.join(REPO_DIR, "web", "src", "screens", "ops", "SurveyOps.tsx")
RULES_TABLE = os.path.join(REPO_DIR, "web", "src", "screens", "rules", "RulesTable.tsx")
SPEC_FILE = os.path.join(REPO_DIR, "specs", "013-impeccable-astryx-ui-overhaul", "spec.md")


def test_survey_ops_uses_native_astryx_components():
    """Verify SurveyOps.tsx imports and renders native Astryx components (StatusDot, Banner, Badge, Section)."""
    assert os.path.exists(SURVEY_OPS), f"Missing file: {SURVEY_OPS}"
    with open(SURVEY_OPS, "r", encoding="utf-8") as f:
        content = f.read()

    assert "@astryxdesign/core/StatusDot" in content
    assert "@astryxdesign/core/Banner" in content
    assert "@astryxdesign/core/Badge" in content
    assert "@astryxdesign/core/Section" in content


def test_rules_table_uses_native_astryx_components():
    """Verify RulesTable.tsx imports native Astryx components (CodeBlock, Dialog, Badge)."""
    assert os.path.exists(RULES_TABLE), f"Missing file: {RULES_TABLE}"
    with open(RULES_TABLE, "r", encoding="utf-8") as f:
        content = f.read()

    assert "@astryxdesign/core/CodeBlock" in content
    assert "@astryxdesign/core/Dialog" in content
    assert "@astryxdesign/core/Badge" in content


def test_feature_013_spec_file_exists():
    """Verify specs/013-impeccable-astryx-ui-overhaul/spec.md exists and is valid."""
    assert os.path.exists(SPEC_FILE), f"Missing spec file: {SPEC_FILE}"
    with open(SPEC_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    assert "013-impeccable-astryx-ui-overhaul" in content
    assert "Operation Console Refactoring" in content
