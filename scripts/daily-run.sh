#!/bin/bash
# Run by launchd (com.shriatluri.portfolio-analyst) weekly, Mondays at noon.
# launchd provides a minimal PATH, so source nvm to get node/npx/claude.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /Users/shriatluri/testing || exit 1
exec npx tsx scripts/generate-report.ts
