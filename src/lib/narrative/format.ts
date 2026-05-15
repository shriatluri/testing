import type { PortfolioSummary } from "../types";

export function formatEmailReport(summary: PortfolioSummary): string {
  const date = new Date(summary.generatedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2 });
  const pnlSign = (n: number) => (n >= 0 ? "+" : "");

  let report = `---\n`;
  report += `Portfolio Narrative Report — ${date}\n\n`;
  report += `Portfolio Value: $${fmt(summary.totalValue)} | Cost Basis: $${fmt(summary.totalCostBasis)} | Overall P&L: ${pnlSign(summary.overallPnlPercent)}${summary.overallPnlPercent.toFixed(2)}%\n`;
  report += `---\n`;

  for (const n of summary.narratives) {
    const h = summary.holdings.find((h) => h.ticker === n.ticker);
    const value = h?.currentValue ? `$${fmt(h.currentValue)}` : "N/A";
    const alloc = h ? `(${h.allocationPercent.toFixed(1)}%)` : "";
    const signal = n.signal.padStart(4);

    report += `\n${n.ticker} — ${value} ${alloc}`.padEnd(60) + `${signal}\n`;

    if (h) {
      const pnlAmt =
        h.currentValue && h.costBasis ? h.currentValue - h.costBasis : null;
      const pnlPct = h.pnlPercent;
      report += `${h.quantity} shares @ ${h.currentPrice ? `$${h.currentPrice.toFixed(2)}` : "N/A"} | Cost: $${h.costBasis ? fmt(h.costBasis) : "N/A"}`;
      if (pnlAmt !== null && pnlPct !== null) {
        report += ` | P&L: ${pnlSign(pnlAmt)}$${fmt(Math.abs(pnlAmt))} (${pnlSign(pnlPct)}${pnlPct.toFixed(1)}%)`;
      }
      report += `\n`;
    }

    report += `\n${n.narrative}\n`;
    report += `\nRationale: ${n.signalRationale}\n`;
    report += `\n---\n`;
  }

  report += `\nPORTFOLIO ANALYSIS\n\n${summary.portfolioAnalysis}\n`;
  report += `\n---\nTo ask follow-up questions, copy the full context from your dashboard and paste it into any LLM.\n`;

  return report;
}
