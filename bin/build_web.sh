#!/data/data/com.termux/files/usr/bin/bash
set -e
cd "$(dirname "$0")/../web"
npm ci
node node_modules/.bin/astryx theme build src/theme/neutralTheme.ts -o src/theme/theme.css
npm run build
