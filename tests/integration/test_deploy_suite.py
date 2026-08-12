"""Integration tests for 007-universal-deploy-suite.
Verifies deploy directory files, bash syntax, executable flags, and verify_installation.sh logic."""

import os
import subprocess
import pytest

REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEPLOY_DIR = os.path.join(REPO_DIR, "deploy")


def test_deploy_suite_files_exist():
    """Verify all 4 core deploy suite deliverables exist in deploy/."""
    expected_files = [
        "install.sh",
        "verify_installation.sh",
        "AGENT_DEPLOY_PROMPT.md",
        "README.md",
    ]
    for fname in expected_files:
        fpath = os.path.join(DEPLOY_DIR, fname)
        assert os.path.exists(fpath), f"Deploy deliverable missing: {fpath}"


def test_bash_scripts_executable():
    """Verify install.sh and verify_installation.sh are executable."""
    for script in ["install.sh", "verify_installation.sh"]:
        spath = os.path.join(DEPLOY_DIR, script)
        assert os.access(spath, os.X_OK), f"Script not executable: {spath}"


def test_bash_syntax():
    """Check syntax of bash scripts using bash -n."""
    for script in ["install.sh", "verify_installation.sh"]:
        spath = os.path.join(DEPLOY_DIR, script)
        res = subprocess.run(["bash", "-n", spath], capture_output=True, text=True)
        assert res.returncode == 0, f"Syntax error in {script}: {res.stderr}"


def test_verify_installation_script():
    """Run deploy/verify_installation.sh and confirm clean execution."""
    spath = os.path.join(DEPLOY_DIR, "verify_installation.sh")
    res = subprocess.run(["bash", spath], capture_output=True, text=True)
    assert "HEALTH VERIFICATION CHECK" in res.stdout
