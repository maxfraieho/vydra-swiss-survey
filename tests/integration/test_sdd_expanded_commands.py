"""Integration tests for Feature 010 — Expanded SDD Commands (/sdd:clarify, /sdd:audit, /sdd:verify) and Templates 7, 8, 9."""

import os
import pytest

REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
COMMANDS_DIR = os.path.join(REPO_DIR, ".claude", "commands", "sdd")
METHODOLOGY_FILE = os.path.join(REPO_DIR, "docs", "for-agents", "sdd-development-methodology.md")

EXPANDED_COMMANDS = ["clarify.md", "audit.md", "verify.md"]


def test_expanded_command_files_exist_and_valid():
    """Verify clarify.md, audit.md, verify.md exist, have valid YAML frontmatter, and link to methodology."""
    for cmd in EXPANDED_COMMANDS:
        cmd_path = os.path.join(COMMANDS_DIR, cmd)
        assert os.path.exists(cmd_path), f"Missing command file: {cmd_path}"
        with open(cmd_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "description:" in content
        assert "allowed-tools:" in content
        assert "docs/for-agents/sdd-development-methodology.md" in content


def test_templates_7_8_9_in_methodology():
    """Verify Templates 7, 8, 9 exist in docs/for-agents/sdd-development-methodology.md."""
    assert os.path.exists(METHODOLOGY_FILE), f"Missing methodology file: {METHODOLOGY_FILE}"
    with open(METHODOLOGY_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    assert "ШАБЛОН 7: Зняття Неоднозначностей" in content
    assert "ШАБЛОН 8: Глибокий Аудит Відхилення Коду" in content
    assert "ШАБЛОН 9: Комплексна Верифікація" in content
