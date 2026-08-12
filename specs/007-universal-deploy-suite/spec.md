# Feature Specification: 007-universal-deploy-suite

> **Feature:** `007-universal-deploy-suite`  
> **Status:** Draft / Active Implementation  
> **Target Audience:** AI Agents (Antigravity `agy`, Claude Code, Subagents) & Systems Administrators  
> **Primary Target OS:** Ubuntu 22.04 / 24.04 LTS (Oracle Cloud Free Tier ARM64 Ampere & x86_64), Debian, Arch, RHEL/Fedora  

---

## 🎯 1. Overview & Business Value

The `universal-deploy-suite` provides an automated, idempotent, and self-contained deployment suite in a dedicated root directory [`deploy/`](file:///data/data/com.termux/files/home/vydra-swiss-survey/deploy/). It enables AI coding agents (Antigravity `agy`, Claude Code, subagents) or human operators to provision and launch `vydra-swiss-survey` onto any new cloud or physical server (specifically optimized for Oracle Cloud Free Tier Ubuntu VPS instances) in under 3 minutes with zero manual intervention.

---

## 📋 2. User Stories & Acceptance Criteria

### User Story 1: One-Command Automated VPS Installation
As an AI Agent or Administrator deploying to an Oracle Cloud Ubuntu server, I want to execute a single bash script `deploy/install.sh` so that all system dependencies (Python 3.11+, Node.js 20+, Chromium, SQLite3), python virtual environments, React web UI builds, and systemd services are created automatically.

#### Acceptance Criteria (Given / When / Then):
- **Given** a fresh Ubuntu 22.04/24.04 LTS or Debian/Arch server (ARM64 or x86_64 architecture),
- **When** `bash deploy/install.sh` is executed,
- **Then** the script automatically detects CPU architecture (`x86_64` vs `aarch64`), installs required APT/system packages, provisions python virtual environment `.venv`, builds the production web bundle (`web/dist`), initializes `~/.vydra-survey-profiles/survey_graph.db` with SQLite WAL mode, and generates an active `systemd` service `astryx-survey.service`.

### User Story 2: AI Agent Deployment Prompt & Protocol
As an AI Agent (`agy` or `claude`), I need a dedicated prompt file `deploy/AGENT_DEPLOY_PROMPT.md` that provides explicit step-by-step instructions on how to SSH into a target server, execute `deploy/install.sh`, verify health status via `deploy/verify_installation.sh`, and report the final operational URLs.

#### Acceptance Criteria (Given / When / Then):
- **Given** an AI Agent assigned a task to deploy the repository to a remote server,
- **When** the agent reads `deploy/AGENT_DEPLOY_PROMPT.md`,
- **Then** it obtains clear, self-contained shell commands, verification steps, and environment variable requirements (`TELEGRAM_BOT_TOKEN`, `ASTRYX_API_TOKEN`) without guessing directory paths.

### User Story 3: Post-Install Verification & Health Check
As a deployment runner, I want to run `deploy/verify_installation.sh` after installation to confirm that all services, database tables, ports (5005), and Telegram bot polling are operating cleanly.

#### Acceptance Criteria (Given / When / Then):
- **Given** an executed installation,
- **When** `bash deploy/verify_installation.sh` is run,
- **Then** it verifies Python dependencies, SQLite WAL mode, HTTP 200 response on `http://127.0.0.1:5005/api/survey/status`, and returns Exit Code 0 upon 100% health.

---

## 🛡️ 3. Invariants & Security Constraints

1. **Idempotency:** Running `deploy/install.sh` multiple times on the same server MUST NOT corrupt existing user profiles, SQLite database data in `~/.vydra-survey-profiles/`, or custom settings.
2. **Zero-Trust Security:** Secret tokens (`ASTRYX_API_TOKEN`, `TELEGRAM_BOT_TOKEN`, SSH passwords) MUST NOT be committed to git. They are read from environment variables or stored securely in `~/.vydra-survey-profiles/`.
3. **Architecture Agnostic:** The installer MUST support both `aarch64` (Oracle Cloud Ampere ARM64) and `x86_64` (AMD/Intel) transparently.
