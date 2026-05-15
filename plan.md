# Portfolio Narrative Analyst

## Context
Building a portfolio analysis app that tracks the "narrative state" of each stock a user holds — the evolving market story — and generates daily reports with Buy/Sell/Hold recommendations. Users link their brokerage via Plaid (free Development tier) so holdings auto-sync. Reports are emailed daily at 9 AM ET via Gmail. A "Copy Context" feature exports a full markdown document pre-loaded with portfolio data + narratives, designed to be pasted into any LLM for follow-up questions. No chatbot — just a report + exportable context.

**Key constraint: Zero API cost.** Uses `claude -p` (covered by Pro subscription) instead of the paid Anthropic API. Uses Claude's Gmail MCP tool for email. All research APIs are free tier.

## Tech Stack
- **Next.js 15** (App Router, TypeScript) — web frontend for Plaid linking, viewing reports, copy context
- **SQLite** via `better-sqlite3` + **Drizzle ORM** — stores holdings snapshots, reports, narratives
- **Plaid** Investments API (free Development tier, 100 connections) — brokerage auto-sync
- **`claude -p`** (Claude Code CLI, covered by Pro plan) — narrative generation + Gmail drafting
- **Tailwind CSS** — styling

## External Services & API Keys Needed
| Service | Env Var | Cost | Purpose |
|---------|---------|------|---------|
| Plaid | `PLAID_CLIENT_ID`, `PLAID_SECRET` | Free (Dev tier) | Brokerage auto-sync |
| SEC EDGAR | None (public, needs User-Agent) | Free | SEC filings |
| Brave Search | `BRAVE_API_KEY` | Free tier (2k/mo) | Stock news search |
| Financial Modeling Prep | `FMP_API_KEY` | Free tier (250/day) | Analyst ratings, earnings |
| Claude CLI (`claude -p`) | None (uses Pro login) | $0 (Pro plan) | Narrative analysis + Gmail email |

**No Anthropic API key needed. No Resend/SendGrid needed.**

## Architecture: Two-Part System

### Part 1: Next.js Web App
Handles Plaid brokerage linking, stores data, displays reports, hosts copy-context pages.

### Part 2: CLI Report Script (`scripts/generate-report.ts`)
A Node script that:
1. Reads holdings from the DB (synced via Plaid)
2. Gathers research using free APIs (news, SEC filings, earnings, ratings)
3. Builds a mega-prompt with all research data
4. Calls `claude -p` with the prompt → Claude generates narratives + Buy/Sell/Hold signals + portfolio summary
5. Stores the report in the DB
6. Calls `claude -p` again with `--allowedTools "mcp__claude_ai_Gmail__create_draft"` to draft the email
7. Outputs the context markdown file

This script runs daily via launchd (9 AM ET) — same approach we set up earlier.

## Database Schema (SQLite + Drizzle)
- **users** — id, email, name, plaidAccessToken (encrypted), plaidItemId
- **accounts** — id, userId, plaidAccountId, name, type, balanceCurrent
- **holdings** — id, userId, accountId, ticker, name, quantity, costBasis, currentPrice, currentValue, snapshotDate
- **reports** — id, userId, generatedAt, portfolioSummary (JSON), contextMarkdown
- **stock_narratives** — id, reportId, userId, ticker, narrative, signal (BUY/SELL/HOLD), signalRationale, researchSources (JSON)

## Directory Structure
```
src/
├── app/
│   ├── page.tsx                          # Landing page
│   ├── layout.tsx
│   ├── globals.css
│   ├── link/page.tsx                     # Plaid Link flow
│   ├── dashboard/page.tsx                # Holdings + past reports
│   ├── report/[id]/page.tsx              # View single report
│   ├── context/[id]/page.tsx             # Copy Context page
│   └── api/
│       ├── plaid/
│       │   ├── create-link-token/route.ts
│       │   ├── exchange-token/route.ts
│       │   └── holdings/route.ts
│       └── reports/
│           └── [id]/route.ts
├── lib/
│   ├── db/
│   │   ├── index.ts                      # Drizzle client
│   │   └── schema.ts                     # All tables
│   ├── plaid/
│   │   ├── client.ts
│   │   └── holdings.ts
│   ├── research/
│   │   ├── news.ts                       # Brave Search API
│   │   ├── sec-filings.ts               # EDGAR API (free)
│   │   ├── earnings.ts                  # FMP API (free tier)
│   │   └── analyst-ratings.ts           # FMP API (free tier)
│   ├── context/
│   │   └── build-context.ts             # Builds the copy-context markdown
│   └── types.ts                         # Shared types
├── components/
│   ├── plaid-link-button.tsx
│   ├── holdings-table.tsx
│   ├── report-card.tsx
│   └── copy-context-button.tsx
scripts/
├── generate-report.ts                    # Main daily report script
├── sync-holdings.ts                      # Pull latest from Plaid, store in DB
└── daily-run.sh                          # Shell wrapper: sync → generate → email via claude -p
```

## Implementation Phases

### Phase 1: Scaffold & Database
1. `npx create-next-app@latest . --typescript --tailwind --app --src-dir`
2. Install deps: `drizzle-orm`, `better-sqlite3`, `drizzle-kit`, `nanoid`, `zod`, `plaid`, `react-plaid-link`
3. Write `src/lib/db/schema.ts` (all 5 tables)
4. Write `src/lib/db/index.ts` (Drizzle client, SQLite at `./data/portfolio.db`)
5. Write `.env.example`, update `.gitignore` (add `data/*.db`, `.env.local`)
6. Run Drizzle migrations

### Phase 2: Plaid Integration
7. Write `src/lib/plaid/client.ts` — Plaid client singleton
8. Write API routes: `create-link-token`, `exchange-token`, `holdings`
9. Write `src/lib/plaid/holdings.ts` — fetch + store holdings snapshots
10. Write `src/components/plaid-link-button.tsx` + `src/app/link/page.tsx`
11. Write `scripts/sync-holdings.ts` — CLI script to pull holdings from Plaid into DB

### Phase 3: Research Layer
12. Write `src/lib/research/news.ts` — Brave Search API for stock news
13. Write `src/lib/research/sec-filings.ts` — SEC EDGAR full-text search (free, no key)
14. Write `src/lib/research/earnings.ts` — FMP earnings data (free tier)
15. Write `src/lib/research/analyst-ratings.ts` — FMP consensus ratings (free tier)
- All modules return a common `ResearchResult[]` interface

### Phase 4: Report Generation Script (Core)
16. Write `src/lib/types.ts` — StockNarrative, PortfolioSummary, Signal types
17. Write `src/lib/context/build-context.ts` — builds full markdown context doc:
    - System instructions for receiving LLM ("You are a portfolio analyst...")
    - Portfolio overview (total value, cost basis, P&L)
    - Holdings table with allocations and signals
    - Full per-stock narratives with Buy/Sell/Hold
    - Portfolio-level analysis (cross-holding risks, concentration)
    - Research sources
18. Write `scripts/generate-report.ts` — the core script:
    - Reads holdings from DB
    - Runs all research functions per ticker (parallel batches of 3)
    - Builds a mega-prompt: "Here is research data for my portfolio. For each stock, generate a narrative state, trajectory, and Buy/Sell/Hold signal (balanced style). Then generate a portfolio-level summary."
    - Calls `claude -p` with the mega-prompt (uses Pro plan, $0)
    - Parses Claude's response, stores report + narratives in DB
    - Builds context markdown, stores in DB
19. Write `scripts/daily-run.sh` — shell wrapper:
    ```bash
    #!/bin/bash
    cd /Users/shriatluri/testing
    npx tsx scripts/sync-holdings.ts
    npx tsx scripts/generate-report.ts
    # claude -p emails the report via Gmail MCP
    ```

### Phase 5: Email via Claude CLI
20. The `generate-report.ts` script outputs the report as text
21. `daily-run.sh` pipes the report into `claude -p` with Gmail MCP:
    ```bash
    claude -p "Create a Gmail draft to [email] with subject 'Portfolio Narrative Report - DATE'. Body: [report content]" \
      --allowedTools "mcp__claude_ai_Gmail__create_draft"
    ```
- No Resend/SendGrid needed — Gmail via Claude Pro

### Phase 6: Copy Context Feature
22. Write `src/app/context/[id]/page.tsx` — displays context preview + copy button
23. Write `src/components/copy-context-button.tsx` — `navigator.clipboard.writeText()` with full context markdown
- Context includes system prompt, all portfolio data, all narratives — ready to paste into any LLM

### Phase 7: Dashboard & Frontend
24. Write `src/app/page.tsx` — landing page
25. Write `src/app/dashboard/page.tsx` — current holdings + past reports list
26. Write `src/app/report/[id]/page.tsx` — view a single report in browser
27. Write remaining components: `holdings-table.tsx`, `report-card.tsx`

### Phase 8: Scheduling (launchd)
28. Create `~/Library/LaunchAgents/com.shriatluri.portfolio-analyst.plist`
    - Runs `scripts/daily-run.sh` daily at 9 AM ET
    - Logs to `~/portfolio-analyst.log`

## Key Design Decisions
- **`claude -p` over Anthropic API** — $0 cost, covered by Pro subscription
- **Gmail via Claude MCP** — no need for Resend/SendGrid, uses existing Gmail
- **SQLite over Postgres** — write-once-per-day pattern, no infra cost
- **Balanced signal style** — Buy/Sell/Hold flagged on clear narrative shifts, not speculation
- **No chatbot** — report-only with copy-context export. Keeps scope tight.
- **Context doc includes LLM system prompt** — so any model immediately understands the role and data
- **Plaid access tokens encrypted** with `aes-256-gcm` before DB storage
- **Report IDs are nanoids** — unguessable, used as auth for context pages
- **Research caching** — results cached by (ticker, date) so re-runs reuse data
- **launchd over cron** — native macOS scheduler, no permission issues

## Verification
1. **Plaid flow**: Link a sandbox brokerage (`user_good`/`pass_good`), verify holdings appear in dashboard
2. **Research**: Run research functions for a single ticker, verify results from all 4 sources
3. **Report generation**: Run `scripts/generate-report.ts` manually, verify:
   - Holdings snapshot stored in DB
   - Each ticker has a narrative + Buy/Sell/Hold signal
   - Portfolio summary generated
   - Context markdown generated and stored
4. **Email**: Run `scripts/daily-run.sh`, verify Gmail draft created with full report
5. **Copy context**: Open report in browser, click "Copy Full Context", paste into Claude/ChatGPT, ask follow-up — verify LLM has full context
6. **Scheduling**: Check `launchctl list | grep portfolio-analyst` to verify launchd agent loaded
