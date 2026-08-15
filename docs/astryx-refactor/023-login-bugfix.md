# 023 — Real login bugfix: `find_element()` false-positive text matching

## Symptom

`try_login()` (survey_agent.py) loops `LOGIN_FIELD_LABELS["submit"] =
["Anmelden", "Login", "Einloggen", "Se connecter", "Connexion", "Log in",
"Sign in", "S'identifier"]` and clicks the first label that
`CDPClient.click_by_text()`/`find_element()` resolves — on a live login
attempt against `meinungsplatz.ch` (French locale), it reported success on
`"Login"`, then on `"Sign in"` (after the first fix), never reaching the
real, visible `"S'identifier"` button.

## Root cause

`cdp_client.py::_FIND_JS`'s `textOf()` read `data-value`, `title`, and used
two unbounded substring checks in `matches()`:

```js
if (tLow.indexOf(nLow) !== -1) return true;                 // raw, no clean(), no boundary
if (cn.indexOf(' ') !== -1 && ct.indexOf(cn) !== -1) return true;  // clean()'d, still no boundary
```

Both false-matched the SAME unrelated `<div>` (a promo section with the
French text "POURQUOI FAIRE DES SONDAGES RÉMUNÉRÉS ?...") for both `"Login"`
and `"Sign in"` — confirmed by re-querying `find_element()` for each label
independently and observing the identical `x/y` coordinates both times.
Direct `innerText`/`aria-label`/`alt`/`title` substring search for the
literal string found nothing, meaning the match came through one of
`textOf()`'s other attribute fallbacks or via the unbounded substring
matching against a longer normalized string containing the needle as a
run-on fragment, not a real word.

## Fix (`cdp_client.py::_FIND_JS`)

1. Removed `data-value` from `textOf()`'s attribute fallback chain — a
   generic, non-standard attribute with no accessibility semantics (unlike
   `aria-label`/`title`/`placeholder`), the most likely source of unrelated
   internal/tracking text.
2. Replaced BOTH unbounded substring checks in `matches()` with a single,
   properly word-boundary-padded check:
   ```js
   if ((' ' + ct + ' ').indexOf(' ' + cn + ' ') !== -1) return true;
   ```
   `clean()` already collapses all punctuation to single spaces, so padding
   both sides guarantees a match only starts/ends on a real word boundary —
   `"login"` can no longer match inside `"sloganin"`, `"sign in"` can no
   longer match inside an unrelated run-on phrase.

## Verification

Live, against the real bug's exact page (`meinungsplatz.ch`), via the real
production `CDPClient`/`find_element()` — not a mock:

**Before fix** — `find_element("Login")` and `find_element("Sign in")` both
resolved to the SAME wrong element:
```
{'x': 755.6, 'y': 3579.1, 'tag': 'DIV', 'text': 'POURQUOI FAIRE DES SONDAGES RÉMUNÉRÉS ?...'}
```

**After fix** — every non-matching label in `LOGIN_FIELD_LABELS["submit"]`
correctly returns `None`, only the real label matches:
```
Anmelden -> None
Login -> None
Einloggen -> None
Se connecter -> None
Connexion -> None
Log in -> None
Sign in -> None
S'identifier -> {'x': 1257.48, 'y': 46.5, 'tag': 'DIV', 'text': "S'identifier"}
```

**End-to-end**: `try_login()` clicked the real `"S'identifier"` button and
the account genuinely authenticated — page title changed from
`"Meinungsplatz - S'inscrire maintenant"` to `"Meinungsplatz - Bienvenue"`,
the password field disappeared, and the body now shows real account content
(balance, "Mes activités", "Mes sondages", etc). Confirmed live on the
physical laptop screen (192.168.3.30, real headed Comet window, not
headless) — see evidence screenshots below.

## Known follow-up (documented, NOT fixed this session)

`try_login()`'s "pre-filled credentials" fast path
(`click_by_text(submit_label)` before ever typing `creds["email"]`/
`creds["password"]`) trusts whatever the browser's own password manager has
already autofilled into the form. In this session it logged into **Olena's
(annet) saved account**, not Arno's, even though `arno`'s credentials were
explicitly loaded from `credentials.json` — because the shared
`SwissPerplexity` Chrome profile has a saved password for a different
persona and the fast path never explicitly typed/verified which persona's
credentials were actually submitted. Needs its own fix (verify the logged-in
identity matches the requested profile after the fast-path click, or type
credentials explicitly instead of trusting autofill) — out of scope here,
noted for a future defect ticket.

## Evidence (`docs/astryx-refactor/evidence/023/`)

| File | sha256 | State |
|---|---|---|
| `login-check.png` | `af285e3461e2b...` | First bug repro — bot-check screen |
| `login-attempt-2.png` | `bf1742a66fa4c8...` | Still-broken, before fix |
| `login-attempt-3-visible.png` | `d6d72669f14440...` | Same bug, now on the real visible Comet window |
| `login-attempt-4-fixed.png` | `d6d72669f14440...` | `data-value` removed, `"Login"` fixed, `"Sign in"` still false-matched |
| `login-attempt-5-final.png` | `82ac4bd2e2dbb8...` | **Real successful login** — "Bienvenue" dashboard |
