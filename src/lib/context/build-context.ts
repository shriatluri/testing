import { PortfolioSummary } from "../types";

export function buildCopyContext(summary: PortfolioSummary): string {
  const holdingsTable = summary.holdings
    .map(
      (h) =>
        `| ${h.ticker} | ${h.name} | ${h.quantity} | $${h.costBasis?.toFixed(2) ?? "N/A"} | $${h.currentValue?.toFixed(2) ?? "N/A"} | ${h.pnlPercent !== null ? `${h.pnlPercent > 0 ? "+" : ""}${h.pnlPercent.toFixed(1)}%` : "N/A"} | ${h.allocationPercent.toFixed(1)}% | ${summary.narratives.find((n) => n.ticker === h.ticker)?.signal ?? "N/A"} |`
    )
    .join("\n");

  const narrativeSections = summary.narratives
    .map(
      (n) => `### ${n.ticker} — ${n.name}
**Signal: ${n.signal}** | Trajectory: ${n.trajectory}

${n.narrative}

**Rationale:** ${n.signalRationale}

**Sources:**
${n.researchSources.map((s) => `- [${s.title}](${s.url}) — ${s.date}`).join("\n")}`
    )
    .join("\n\n---\n\n");

  return `# Portfolio Analysis Context

## System Instructions
You are a portfolio analyst assistant. The user has shared their full portfolio data and narrative analysis below. Use this to answer follow-up questions about their holdings, risk exposure, and investment decisions. Be specific and reference the data provided. When making recommendations, consider the user's current allocation, cost basis, and narrative trajectory for each position.

## Portfolio Overview
- **Total Value:** $${summary.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
- **Total Cost Basis:** $${summary.totalCostBasis.toLocaleString("en-US", { minimumFractionDigits: 2 })}
- **Overall P&L:** ${summary.overallPnlPercent > 0 ? "+" : ""}${summary.overallPnlPercent.toFixed(1)}%
- **Report Date:** ${summary.generatedAt}
- **Number of Holdings:** ${summary.holdings.length}

## Holdings
| Ticker | Name | Shares | Cost Basis | Current Value | P&L % | Allocation % | Signal |
|--------|------|--------|-----------|---------------|-------|-------------|--------|
${holdingsTable}

## Stock Narratives

${narrativeSections}

## Portfolio-Level Analysis

${summary.portfolioAnalysis}
`;
}
