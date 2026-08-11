# Termux Local Deployment Mandatory Rule

**Priority:** Mandatory / High Enforcement  
**Applies To:** All Agent sessions in `vydra-swiss-survey`

## Mandatory Local Deployment Rules

1. **Local Build Command:** After editing any frontend file in `web/src/` or backend template, the agent MUST run `bash bin/build-deploy.sh`.
2. **No Remote Deployment:** Do NOT run SSH commands, rsync, or remote deployments to dev-184 or external IP addresses.
3. **Local Server & Watchdog:** The primary web server runs locally on Termux on port 5005 (`http://127.0.0.1:5005/ops`) monitored by `bin/watchdog_astryx.sh`.
