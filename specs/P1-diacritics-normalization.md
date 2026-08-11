# Phase P1: Diacritics & Semantic Text Normalization Spec

## Architectural Boundary

- `cdp_client.py`: Handles DOM element text normalization and targeting.
- `reflection.py`: Handles high-level outcome classification (`_find_phrase`).

## Acceptance Criteria

### French Diacritics Normalization
- **Given** French text containing diacritical marks (e.g., `intensité`)
- **When** normalizing text for comparison or element matching
- **Then** diacritics are stripped to standard ASCII equivalents (e.g., `intensite`)

### German Diacritics & Special Character Normalization
- **Given** German text containing umlauts or sharp s (e.g., `Präferenz`)
- **When** normalizing text for comparison or element matching
- **Then** German characters are expanded according to standard rules:
  - `ä` -> `ae`
  - `ö` -> `oe`
  - `ü` -> `ue`
  - `ß` -> `ss`
   resulting in `Praeferenz`

### Guard Rule: Short Token Matching
- **Given** short tokens with length <= 3 characters (e.g., `oui`, `non`, `ja`, `nein`)
- **When** evaluating text match or candidate selection
- **Then** strict equality match MUST be enforced (Jaro-Winkler disabled or similarity threshold >= 0.95)
