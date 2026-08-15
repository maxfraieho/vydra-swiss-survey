import sys
sys.path.insert(0, "/home/vokov/projects/vydra-swiss-survey")
from cdp_client import CDPClient


def test_find_js_does_not_read_data_value_attribute():
    """SDD 023 login bugfix: textOf() in _FIND_JS must not read getAttribute('data-value') -
    a generic, non-standard attribute with no accessibility semantics that produced a real
    false-positive button match on meinungsplatz.ch (see docs/astryx-refactor/023-login-bugfix.md).
    Checks the actual JS call, not just the substring (a code comment legitimately mentions
    the phrase "data-value" to document why it was removed)."""
    assert hasattr(CDPClient, "find_element")
    assert "getAttribute('data-value')" not in CDPClient._FIND_JS


def test_find_js_matches_uses_word_boundary_padding():
    """SDD 023: matches() must use the word-boundary-padded substring check
    (padding ct/cn with spaces before indexOf) so a needle like "login" or
    "sign in" can only match a real word/phrase boundary in the target text,
    not an arbitrary run-on substring - that padded check is what actually
    fixed the live false-positive (see docs/astryx-refactor/023-login-bugfix.md
    for the before/after find_element() output against the real page)."""
    js = CDPClient._FIND_JS
    assert "(' ' + ct + ' ').indexOf(' ' + cn + ' ')" in js
