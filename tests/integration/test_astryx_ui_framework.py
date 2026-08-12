"""Integration tests for Feature 012 — Astryx UI Framework Component Audit & Specification."""

import os
import pytest

REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BROWSER_SOURCES_PANEL = os.path.join(REPO_DIR, "web", "src", "screens", "settings", "BrowserSourcesPanel.tsx")
SPEC_FILE = os.path.join(REPO_DIR, "specs", "012-astryx-framework-ui-audit", "spec.md")


def test_browser_sources_panel_uses_astryx_components():
    """Verify BrowserSourcesPanel.tsx imports and renders native Astryx components and priority badges."""
    assert os.path.exists(BROWSER_SOURCES_PANEL), f"Missing file: {BROWSER_SOURCES_PANEL}"
    with open(BROWSER_SOURCES_PANEL, "r", encoding="utf-8") as f:
        content = f.read()

    assert "@astryxdesign/core/Card" in content
    assert "@astryxdesign/core/Badge" in content
    assert "@astryxdesign/core/MetadataList" in content
    assert "impeccable-glass" in content
    assert "priorityLabel" in content


def test_feature_012_spec_file_exists():
    """Verify specs/012-astryx-framework-ui-audit/spec.md exists and is valid."""
    assert os.path.exists(SPEC_FILE), f"Missing spec file: {SPEC_FILE}"
    with open(SPEC_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    assert "012-astryx-framework-ui-audit" in content
    assert "Native Astryx Components Adoption" in content
