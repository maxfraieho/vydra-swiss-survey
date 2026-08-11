# Phase P5: Self-Healing & Captcha Resilience Spec

## Acceptance Criteria

### Captcha Signature Detection
- **Given** an active web page session in `cdp_client.py`
- **When** inspecting DOM elements for captcha providers
- **Then** visible captcha markers (`cf-turnstile`, `g-recaptcha`, `hcaptcha`, `geetest`) are detected

### Telegram Tutor Notification
- **Given** a captcha signature detected by `cdp_client.py`
- **When** alerting external notifications in `astryx_survey_server.py`
- **Then** push notification is sent via Telegram Bot API (`sendMessage`)

### Session Pause vs `--no-recovery`
- **Given** a detected captcha during session execution
- **When** processing session recovery logic
- **Then** session state pauses in `waiting_captcha` state unless CLI flag `--no-recovery` is passed
- **And** if `--no-recovery` flag is set, session exits immediately

### Undetected Captcha Logging
- **Given** an action failure immediately following a page transition
- **When** no known captcha signatures are matched
- **Then** a warning is logged detailing possible undetected captcha or element failure

## Risk / Rollback Plan

| Risk | Mitigation | Rollback Plan |
| --- | --- | --- |
| False positive captcha signature matches | Validate visibility and interactive status of detected DOM elements | Revert signature pattern matching in `cdp_client.py` |
| Telegram Bot API failure or missing token | Catch API errors gracefully and log fallback warnings | Fall back to console notifications in `astryx_survey_server.py` |
| Session lockup during `waiting_captcha` state | Set configurable recovery timeout for session resume | Disable pause loop and exit session on captcha detection |
| `--no-recovery` flag parsing error | Unit test CLI flag parsing across execution commands | Default to immediate exit when captcha error state is hit |
