"""Integration tests for Feature 014 — Official Impeccable CLI Integration & Doctor Verification."""

import os
import subprocess
import pytest

REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DOCTOR_SCRIPT = os.path.join(REPO_DIR, ".claude", "skills", "impeccable", "scripts", "doctor.mjs")
PRODUCT_MD = os.path.join(REPO_DIR, "PRODUCT.md")
DESIGN_MD = os.path.join(REPO_DIR, "DESIGN.md")
SPEC_FILE = os.path.join(REPO_DIR, "specs", "014-impeccable-official-ui-critique", "spec.md")


def test_impeccable_doctor_no_drift():
    """Verify official Impeccable doctor runs cleanly with no drift."""
    assert os.path.exists(DOCTOR_SCRIPT), f"Missing doctor script: {DOCTOR_SCRIPT}"
    res = subprocess.run(["node", DOCTOR_SCRIPT], cwd=REPO_DIR, capture_output=True, text=True)
    assert res.returncode == 0
    assert "No drift found" in res.stdout, f"Doctor output drift error: {res.stdout}"


def test_product_and_design_records_conformance():
    """Verify PRODUCT.md and DESIGN.md match Impeccable schema standard sections."""
    assert os.path.exists(PRODUCT_MD)
    with open(PRODUCT_MD, "r", encoding="utf-8") as f:
        prod = f.read()
    assert "Positioning" in prod
    assert "Operating Context" in prod
    assert "Evidence on Hand" in prod
    assert "Product Principles" in prod

    assert os.path.exists(DESIGN_MD)
    with open(DESIGN_MD, "r", encoding="utf-8") as f:
        des = f.read()
    assert "Colors & Token Palette" in des
    assert "Typography & Layout System" in des
    assert "Components Section & System Norms" in des


def test_feature_014_spec_exists():
    """Verify specs/014-impeccable-official-ui-critique/spec.md exists."""
    assert os.path.exists(SPEC_FILE)
    with open(SPEC_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    assert "014-impeccable-official-ui-critique" in content
