# 🚀 Universal Deployment Suite (`deploy/`)

This directory contains the universal, automated deployment suite for `vydra-swiss-survey`, supporting Oracle Cloud Free Tier Ubuntu VPS instances (ARM64 Ampere / x86_64) as well as any Linux or Termux environment.

---

## 📂 Suite Structure

- [`install.sh`](file:///data/data/com.termux/files/home/vydra-swiss-survey/deploy/install.sh) — One-command automated installer.
- [`verify_installation.sh`](file:///data/data/com.termux/files/home/vydra-swiss-survey/deploy/verify_installation.sh) — Health check verification script.
- [`AGENT_DEPLOY_PROMPT.md`](file:///data/data/com.termux/files/home/vydra-swiss-survey/deploy/AGENT_DEPLOY_PROMPT.md) — Step-by-step deployment instructions for AI Agents (Antigravity `agy`, Claude Code).
- [`README.md`](file:///data/data/com.termux/files/home/vydra-swiss-survey/deploy/README.md) — Documentation manual.

---

## ⚡ Quick Start Commands

```bash
# 1. Execute full automated deployment:
bash deploy/install.sh

# 2. Run post-installation health check:
bash deploy/verify_installation.sh
```
