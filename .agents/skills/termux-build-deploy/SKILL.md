---
name: termux-build-deploy
description: Local Termux build and deployment workflow using bin/build-deploy.sh and watchdog_astryx.sh.
---

# Termux Local Build & Deploy Skill

This skill defines the mandatory local deployment procedure for `vydra-swiss-survey` running on Termux (Android local device).

## Core Local Deployment Invariants
1. **100% Local Execution:** ALL builds and server executions run directly inside Termux on the local Android device (`/data/data/com.termux/files/home/vydra-swiss-survey/`).
2. **Zero Remote SSH:** Remote SSH deployment or rsyncing to dev-184 (`192.168.3.184`) is STRICTLY PROHIBITED.
3. **Automated Vite Build & Patch (`bin/build-deploy.sh`):** Whenever web frontend files under `web/src/` are modified, the agent MUST run `bash bin/build-deploy.sh`. This script:
   - Builds Vite production bundle into `web/dist/`.
   - Patches `web/dist/index.html` with `data-cfasync="false"` to prevent script module corruption.
   - Requires NO Flask server restart since Flask serves `web/dist/` directly via `send_from_directory`.
4. **Watchdog Daemon (`bin/watchdog_astryx.sh`):** Server process health is maintained by `bin/watchdog_astryx.sh` checking every 30 seconds.

## Standard Execution Command
```bash
bash bin/build-deploy.sh
```
