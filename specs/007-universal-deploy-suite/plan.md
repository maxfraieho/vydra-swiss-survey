# Technical Plan: 007-universal-deploy-suite

> **Feature:** `007-universal-deploy-suite`  
> **Status:** Active  
> **Directory:** `deploy/`  

---

## 🏗️ 1. Architecture & Module Design

The deployment suite consists of 4 core deliverables in the root directory `deploy/`:

```
deploy/
├── install.sh                # Main automated installer (Ubuntu / Oracle Cloud / Debian / RHEL / Arch)
├── verify_installation.sh   # Health check verification script (HTTP, SQLite, Python, Node, CDP)
├── AGENT_DEPLOY_PROMPT.md    # Instructions for AI agents (agy, claude) on remote deployment
└── README.md                 # Deployment suite overview & manual commands
```

---

## 🛠️ 2. Key Components

1. **`deploy/install.sh`**:
   - Detects Linux OS (`/etc/os-release`) and CPU arch (`x86_64` vs `aarch64`).
   - Installs system packages: `python3`, `python3-venv`, `python3-pip`, `curl`, `git`, `sqlite3`, `chromium-browser` / `chromium`.
   - Node.js 20 LTS auto-installation via NodeSource / nvm / official binaries if `node` is missing or < v18.
   - Creates Python virtualenv `.venv` and installs `requirements.txt`.
   - Builds production React UI bundle (`npm run build` in `web/`).
   - Initializes `~/.vydra-survey-profiles/survey_graph.db` with WAL mode (`PRAGMA journal_mode=WAL`).
   - Generates and enables `astryx-survey.service` systemd unit file running `astryx_survey_server.py`.

2. **`deploy/verify_installation.sh`**:
   - Tests Python venv dependencies (`requests`, `websocket-client`, `flask`, `pytest`).
   - Queries `http://127.0.0.1:5005/api/survey/status` for HTTP 200.
   - Verifies SQLite WAL mode on `survey_graph.db`.
   - Exits 0 if clean, 1 on failure.

3. **`deploy/AGENT_DEPLOY_PROMPT.md`**:
   - Formatted prompt for AI Agents (`agy`, `claude`) to deploy on any SSH target.
   - Covers pre-requisites, SSH connection, git clone, script execution, env var injection, and verification.

---

## 📋 3. Task Breakdown

- [x] **T-101 (Spec):** Create `specs/007-universal-deploy-suite/spec.md`.
- [x] **T-102 (Plan):** Create `specs/007-universal-deploy-suite/plan.md` & `tasks.md`.
- [ ] **T-103 (Installer Script):** Write `deploy/install.sh` with Oracle Cloud Ubuntu ARM64/x86_64 support.
- [ ] **T-104 (Health Check Script):** Write `deploy/verify_installation.sh`.
- [ ] **T-105 (Agent Prompt & Manual):** Write `deploy/AGENT_DEPLOY_PROMPT.md` & `deploy/README.md`.
- [ ] **T-106 (Integration Test):** Write `tests/integration/test_deploy_suite.py`.
- [ ] **T-107 (Verification):** Update `bin/sdd_verify.sh` and run pytest suite.
