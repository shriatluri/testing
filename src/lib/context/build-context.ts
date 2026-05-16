import { PortfolioSummary } from "../types";

export function buildCopyContext(summary: PortfolioSummary): string {
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2 });
  const pnlSign = (n: number) => (n >= 0 ? "+" : "");

  const holdingsTable = summary.holdings
    .map((h) => {
      const signal =
        summary.narratives.find((n) => n.ticker === h.ticker)?.signal ?? "N/A";
      const pnlAmt =
        h.currentValue && h.costBasis ? h.currentValue - h.costBasis : null;
      return `| ${h.ticker} | ${h.name} | ${h.quantity} | $${h.costBasis ? fmt(h.costBasis) : "N/A"} | $${h.currentValue ? fmt(h.currentValue) : "N/A"} | ${pnlAmt !== null ? `${pnlSign(pnlAmt)}$${fmt(Math.abs(pnlAmt))}` : "N/A"} | ${h.pnlPercent !== null ? `${pnlSign(h.pnlPercent)}${h.pnlPercent.toFixed(1)}%` : "N/A"} | ${h.allocationPercent.toFixed(1)}% | ${signal} |`;
    })
    .join("\n");

  const narrativeSections = summary.narratives
    .map((n) => {
      const h = summary.holdings.find((h) => h.ticker === n.ticker);
      const pnlAmt =
        h?.currentValue && h?.costBasis ? h.currentValue - h.costBasis : null;

      let header = `### ${n.ticker}`;
      if (h) {
        header += ` — $${h.currentValue ? fmt(h.currentValue) : "N/A"} (${h.allocationPercent.toFixed(1)}%)`;
      }
      header += `    \`${n.signal}\``;

      let subheader = "";
      if (h) {
        subheader = `**${h.quantity} shares`;
        if (h.currentPrice) subheader += ` @ $${h.currentPrice.toFixed(2)}`;
        if (h.costBasis) subheader += ` | Cost: $${fmt(h.costBasis)}`;
        if (pnlAmt !== null && h.pnlPercent !== null) {
          subheader += ` | P&L: ${pnlSign(pnlAmt)}$${fmt(Math.abs(pnlAmt))} (${pnlSign(h.pnlPercent)}${h.pnlPercent.toFixed(1)}%)`;
        }
        subheader += "**";
      }

      const sources =
        n.researchSources.length > 0
          ? `\n**Sources:**\n${n.researchSources.map((s) => `- [${s.title}](${s.url}) — ${s.date}`).join("\n")}`
          : "";

      return `${header}
${subheader}

${n.narrative}

**Rationale:** ${n.signalRationale}${sources}`;
    })
    .join("\n\n---\n\n");

  return `# My Portfolio — ${summary.generatedAt}

## Portfolio Overview
- **Total Value:** $${fmt(summary.totalValue)}
- **Total Cost Basis:** $${fmt(summary.totalCostBasis)}
- **Overall P&L:** ${pnlSign(summary.overallPnlPercent)}${summary.overallPnlPercent.toFixed(1)}%
- **Report Date:** ${summary.generatedAt}
- **Number of Holdings:** ${summary.holdings.length}

## Holdings
| Ticker | Name | Shares | Cost Basis | Current Value | P&L ($) | P&L (%) | Allocation | Signal |
|--------|------|--------|-----------|---------------|---------|---------|------------|--------|
${holdingsTable}

## Stock Narratives

${narrativeSections}

## Portfolio-Level Analysis

${summary.portfolioAnalysis}
`;
}
