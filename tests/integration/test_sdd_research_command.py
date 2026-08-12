"""Integration tests for Feature 009 — /sdd:research command and Template 6."""

import os
import pytest

REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
COMMAND_FILE = os.path.join(REPO_DIR, ".claude", "commands", "sdd", "research.md")
METHODOLOGY_FILE = os.path.join(REPO_DIR, "docs", "for-agents", "sdd-development-methodology.md")


def test_research_command_file_exists_and_valid():
    """Verify .claude/commands/sdd/research.md exists, has valid YAML frontmatter, and links to methodology."""
    assert os.path.exists(COMMAND_FILE), f"Missing command file: {COMMAND_FILE}"
    with open(COMMAND_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    assert "description:" in content
    assert "argument-hint:" in content
    assert "allowed-tools:" in content
    assert "docs/for-agents/sdd-development-methodology.md" in content


def test_template_6_in_methodology():
    """Verify Template 6 section exists in docs/for-agents/sdd-development-methodology.md."""
    assert os.path.exists(METHODOLOGY_FILE), f"Missing methodology file: {METHODOLOGY_FILE}"
    with open(METHODOLOGY_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    assert "ШАБЛОН 6: Глибоке Дослідження" in content
    assert "gemini-research-<slug>.md" in content
