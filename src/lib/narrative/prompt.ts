import type { HoldingData, ResearchResult } from "../types";

export function buildNarrativePrompt(
  holdingsData: HoldingData[],
  researchByTicker: Record<string, Record<string, ResearchResult[]>>
): string {
  const holdingsSection = holdingsData
    .map(
      (h) =>
        `- ${h.ticker} (${h.name}): ${h.quantity} shares, cost basis $${h.costBasis?.toFixed(2) ?? "N/A"}, current value $${h.currentValue?.toFixed(2) ?? "N/A"}, P&L ${h.pnlPercent !== null ? `${h.pnlPercent.toFixed(1)}%` : "N/A"}, allocation ${h.allocationPercent.toFixed(1)}%`
    )
    .join("\n");

  const researchSection = Object.entries(researchByTicker)
    .map(([ticker, research]) => {
      const allResults = [...(research.filings || [])];
      if (allResults.length === 0)
        return `### ${ticker}\nNo research data available.`;
      return `### ${ticker}\n${allResults.map((r) => `- [${r.source}] ${r.title}: ${r.summary}`).join("\n")}`;
    })
    .join("\n\n");

  return `You are a senior equity analyst writing a daily portfolio morning brief. Under 5 minutes to read. Punchy, direct, zero filler.

## Portfolio Holdings
${holdingsSection}

## Research Data
${researchSection}

## STRICT FORMAT RULES — DO NOT DEVIATE

For each holding, generate:
1. **Narrative**: EXACTLY 3-5 sentences. No more. What's the current story? What shifted? Name specific drivers. Do NOT write multiple paragraphs — if you write more than 5 sentences for any stock, you have failed.
2. **Trajectory**: "improving", "stable", or "deteriorating"
3. **Signal**: "BUY", "SELL", or "HOLD" — only flag BUY/SELL on clear narrative shifts, not noise.
4. **Signal Rationale**: EXACTLY 1-2 sentences. The single most important thing to watch or act on.

Then write a **Portfolio-Level Analysis** as a SINGLE block of text (no headers, no markdown, just flowing paragraphs) covering:
- Concentration risk (1-2 sentences)
- Sector exposure gaps (1-2 sentences)
- Narrative health scorecard: list tickers as Improving/Stable/Deteriorating with allocation %
- Key observation (1-2 sentences)
- Action items: numbered, max 3, specific

TOTAL portfolio analysis should be ONE short block — around 10-15 sentences max.

Write like you're texting a smart friend who owns these stocks. Every word must earn its place.

IMPORTANT: Respond ONLY in valid JSON with this exact structure, nothing else:
{
  "narratives": [
    {
      "ticker": "AAPL",
      "narrative": "3-5 sentences only",
      "trajectory": "stable",
      "signal": "HOLD",
      "signalRationale": "1-2 sentences only"
    }
  ],
  "portfolioAnalysis": "single block of text, 10-15 sentences"
}`;
}
