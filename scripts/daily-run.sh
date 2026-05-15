#!/bin/bash
# Daily Portfolio Narrative Report
# Syncs holdings, generates report, and emails via Gmail

set -e

cd /Users/shriatluri/testing

echo "=== Portfolio Narrative Report — $(date '+%B %d, %Y') ==="

# Step 1: Sync holdings from Plaid
echo "[1/3] Syncing holdings..."
npx tsx scripts/sync-holdings.ts

# Step 2: Generate the narrative report
echo "[2/3] Generating report..."
npx tsx scripts/generate-report.ts

# Step 3: Email the report via Claude's Gmail MCP
echo "[3/3] Drafting email..."
REPORT=$(cat /tmp/portfolio-report.txt)
DATE=$(date '+%B %d, %Y')

claude -p "Create a Gmail draft to me with the subject 'Portfolio Narrative Report - ${DATE}' and the following as the body. Also include a note at the bottom that says 'To ask follow-up questions, copy the full context from your dashboard and paste it into any LLM.'

${REPORT}" \
  --allowedTools "mcp__claude_ai_Gmail__create_draft"

echo "=== Done! ==="
