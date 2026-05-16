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

Then write a **Portfolio-Level Analysis** in clean markdown with the following sections:

### Concentration Risk
1-2 sentences on over-exposure or unhealthy concentration.

### Sector Exposure
1-2 sentences on gaps or imbalances.

### Narrative Health
A compact table or bullet list: each ticker with its trajectory (Improving / Stable / Deteriorating) and allocation %.

### Key Observation
1-2 sentences — the single most important cross-portfolio insight.

### Action Items
Numbered list, max 3, specific and actionable.

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
  "portfolioAnalysis": "## Portfolio Analysis\\n\\n### Concentration Risk\\n..."
}`;
}
