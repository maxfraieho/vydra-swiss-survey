"""Reflection: analyze survey page text to detect question topic and run outcome.

Phase 3a only. No calls into survey_agent.py / persona_graph_memory.py / cdp_client.py.
The vision model (Gemma) frequently claims "done" on a disqualification page — this
module classifies the real outcome from the actual page text, DQ taking priority
over any claimed "done" signal.
"""

from __future__ import annotations

# Pattern -> substrings (lowercase) that indicate a survey question is about this topic.
# de/fr/it/en covered; order of iteration = priority when multiple patterns could match.
TOPIC_KEYWORDS: dict[str, list[str]] = {
    "tobacco": ["raucher", "tabac", "fumo", "tobacco", "cigarette", "smoking", "smoker"],
    "health_status": ["gesundheit", "santé", "salute", "health", "krankheit", "maladie"],
    "alcohol": ["alkohol", "alcool", "alcohol"],
    "auto": ["auto", "voiture", "macchina", "car", "fahrzeug"],
    "finance": ["finanz", "finance", "finanza"],
    "income": ["einkommen", "revenu", "reddito", "income", "salaire"],
    "employment": ["beruf", "profession", "professione", "employment", "job", "arbeit"],
    "industry_exclusion": [
        "marktforschung", "étude de marché", "ricerca di mercato", "market research",
        "werbung", "publicité", "advertising", "journalismus", "journalism",
    ],
    "household": ["haushalt", "ménage", "famiglia", "household"],
    "shopping": ["einkauf", "achat", "acquisto", "shopping", "purchase"],
}

# Which answer polarity qualifies the respondent for each detected topic.
# industry_exclusion is ALWAYS "deny" -- standard survey screening rule, never admit
# working in market research / advertising / media.
QUALIFYING_POLARITY: dict[str, str] = {
    "tobacco": "affirm",
    "health_status": "not_fully_healthy",
    "alcohol": "affirm",
    "auto": "affirm",
    "finance": "affirm",
    "income": "affirm",
    "employment": "affirm",
    "industry_exclusion": "deny",
    "household": "affirm",
    "shopping": "affirm",
}

# Specific disqualification phrases per language. Kept narrow (not generic "thank you"
# text) since German thank-you pages can also be disqualifications.
DQ_PHRASES: dict[str, list[str]] = {
    "de": ["nicht qualifiziert", "quote ist voll", "leider passen sie nicht",
           "umfrage ist bereits voll"],
    "fr": ["vous ne correspondez pas", "quota atteint", "malheureusement vous ne"],
    "it": ["non sei idoneo", "quota raggiunta", "purtroppo non corrispondi"],
    "en": ["you do not qualify", "quota is full", "unfortunately you do not"],
}

# Completion confirmation phrases per language.
DONE_PHRASES: dict[str, list[str]] = {
    "de": ["vielen dank für ihre teilnahme", "umfrage abgeschlossen"],
    "fr": ["merci pour votre participation", "enquête terminée"],
    "it": ["grazie per la partecipazione", "sondaggio completato"],
    "en": ["thank you for your participation", "survey completed", "survey complete"],
}


def detect_pattern(page_text: str) -> str | None:
    """First TOPIC_KEYWORDS pattern whose substring appears in the first ~600 chars
    of `page_text` (lowercased). None if nothing matches -- never invents a pattern."""
    haystack = page_text.lower()[:600]
    for pattern, keywords in TOPIC_KEYWORDS.items():
        for kw in keywords:
            if kw in haystack:
                return pattern
    return None


def _find_phrase(text: str, phrases_by_lang: dict[str, list[str]]) -> str | None:
    """First matching phrase across all languages, or None."""
    for phrases in phrases_by_lang.values():
        for phrase in phrases:
            if phrase in text:
                return phrase
    return None


def classify_outcome(
    final_text: str,
    final_url: str,
    *,
    gemma_said_done: bool,
    dry_run: bool,
    exception: str = "",
    hit_max_steps: bool = False,
) -> tuple[str, str]:
    """Classify a run's outcome from the final page text/URL.

    Priority: dry_run > exception > DQ phrase > done phrase > gemma claimed done
    (unconfirmed) > hit max steps > no signal. DQ is checked before done so a
    false "done" from the vision model never overrides a real disqualification.
    """
    if dry_run:
        return ("dry_run", "dry run mode")

    if exception:
        return ("error", exception[:300])

    text = final_text.lower()

    dq_phrase = _find_phrase(text, DQ_PHRASES)
    if dq_phrase is not None:
        return ("disqualified", f"matched DQ phrase: {dq_phrase}")

    done_phrase = _find_phrase(text, DONE_PHRASES)
    if done_phrase is not None:
        return ("completed", f"matched done phrase: {done_phrase}")

    if gemma_said_done:
        return ("incomplete", "model claimed done but no confirming phrase found on final page")

    if hit_max_steps:
        return ("incomplete", "hit max steps")

    return ("incomplete", "no outcome signal found")
