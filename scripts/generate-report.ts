import { db, schema } from "../src/lib/db";
import { eq, desc } from "drizzle-orm";
import { fetchSecFilings } from "../src/lib/research/sec-filings";
import { buildCopyContext } from "../src/lib/context/build-context";
import { nanoid } from "nanoid";
import { readFileSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";
import type {
  HoldingData,
  PortfolioSummary,
  StockNarrative,
  ResearchResult,
} from "../src/lib/types";

// Load .env.local
try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8" as BufferEncoding);
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {}

async function gatherResearch(
  ticker: string
): Promise<Record<string, ResearchResult[]>> {
  const filings = await fetchSecFilings(ticker);
  return { filings };
}

function buildMegaPrompt(
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
      const allResults = [...research.filings];
      if (allResults.length === 0) return `### ${ticker}\nNo research data available.`;
      return `### ${ticker}\n${allResults.map((r) => `- [${r.source}] ${r.title}: ${r.summary}`).join("\n")}`;
    })
    .join("\n\n");

  return `You are a senior equity analyst generating a daily portfolio narrative report.

## Portfolio Holdings
${holdingsSection}

## Research Data
${researchSection}

## Instructions
For each stock in the portfolio, generate:
1. **Narrative State** (2-3 paragraphs): What is the current market story? What are the key drivers?
2. **Trajectory**: Is the narrative "improving", "stable", or "deteriorating"?
3. **Signal**: "BUY", "SELL", or "HOLD" — use a balanced approach. Only flag BUY/SELL on clear narrative shifts.
4. **Signal Rationale**: 1-2 sentences explaining the signal.

Then generate a **Portfolio-Level Analysis** covering:
- Cross-holding risks and correlations
- Sector/theme concentration
- Overall narrative health
- Key actions to consider

IMPORTANT: Respond in valid JSON with this exact structure:
{
  "narratives": [
    {
      "ticker": "AAPL",
      "narrative": "...",
      "trajectory": "stable",
      "signal": "HOLD",
      "signalRationale": "..."
    }
  ],
  "portfolioAnalysis": "..."
}`;
}

async function main() {
  console.log("Starting report generation...");

  // Get the user
  const user = await db.query.users.findFirst();
  if (!user) {
    console.error("No user found. Link a brokerage account first.");
    process.exit(1);
  }

  // Get latest holdings
  const latestHolding = await db.query.holdings.findFirst({
    where: eq(schema.holdings.userId, user.id),
    orderBy: [desc(schema.holdings.createdAt)],
  });

  if (!latestHolding) {
    console.error("No holdings found. Sync holdings first.");
    process.exit(1);
  }

  const holdings = await db.query.holdings.findMany({
    where: eq(schema.holdings.snapshotDate, latestHolding.snapshotDate),
  });

  // Calculate portfolio totals
  const totalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
  const totalCostBasis = holdings.reduce((sum, h) => sum + (h.costBasis || 0), 0);

  const holdingsData: HoldingData[] = holdings.map((h) => ({
    ticker: h.ticker,
    name: h.name,
    quantity: h.quantity,
    costBasis: h.costBasis,
    currentPrice: h.currentPrice,
    currentValue: h.currentValue,
    allocationPercent: totalValue > 0 ? ((h.currentValue || 0) / totalValue) * 100 : 0,
    pnlPercent:
      h.costBasis && h.currentValue
        ? ((h.currentValue - h.costBasis) / h.costBasis) * 100
        : null,
  }));

  // Gather research for each ticker (batches of 3)
  console.log("Gathering research...");
  const tickers = [...new Set(holdings.map((h) => h.ticker))].filter(
    (t) => t !== "UNKNOWN"
  );
  const researchByTicker: Record<string, Record<string, ResearchResult[]>> = {};

  for (let i = 0; i < tickers.length; i += 3) {
    const batch = tickers.slice(i, i + 3);
    const results = await Promise.all(batch.map((t) => gatherResearch(t)));
    batch.forEach((ticker, idx) => {
      researchByTicker[ticker] = results[idx];
    });
    console.log(`  Researched: ${batch.join(", ")}`);
  }

  // Build the mega prompt and call claude -p
  console.log("Generating narratives via claude -p...");
  const prompt = buildMegaPrompt(holdingsData, researchByTicker);

  const tmpFile = "/tmp/portfolio-prompt.txt";
  const { writeFileSync: writeTmp } = await import("fs");
  writeTmp(tmpFile, prompt);

  let claudeOutput: string;
  try {
    claudeOutput = execSync(`cat "${tmpFile}" | claude -p`, {
      encoding: "utf-8",
      timeout: 300000,
      env: { ...process.env, CLAUDECODE: undefined, ANTHROPIC_API_KEY: undefined },
    });
  } catch (error) {
    console.error("claude -p failed:", error);
    process.exit(1);
  }

  // Parse Claude's response
  let parsed: {
    narratives: Array<{
      ticker: string;
      narrative: string;
      trajectory: "improving" | "stable" | "deteriorating";
      signal: "BUY" | "SELL" | "HOLD";
      signalRationale: string;
    }>;
    portfolioAnalysis: string;
  };

  try {
    const jsonMatch = claudeOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in claude output");
    parsed = JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Failed to parse claude output:", error);
    console.error("Raw output:", claudeOutput.slice(0, 500));
    process.exit(1);
  }

  // Build full narratives with research sources
  const narratives: StockNarrative[] = parsed.narratives.map((n) => {
    const holding = holdingsData.find((h) => h.ticker === n.ticker);
    const research = researchByTicker[n.ticker] || {};
    const allSources = [...(research.filings || [])];

    return {
      ticker: n.ticker,
      name: holding?.name || n.ticker,
      narrative: n.narrative,
      trajectory: n.trajectory,
      signal: n.signal,
      signalRationale: n.signalRationale,
      researchSources: allSources,
    };
  });

  // Build portfolio summary
  const portfolioSummary: PortfolioSummary = {
    totalValue,
    totalCostBasis,
    overallPnlPercent:
      totalCostBasis > 0
        ? ((totalValue - totalCostBasis) / totalCostBasis) * 100
        : 0,
    holdings: holdingsData,
    narratives,
    portfolioAnalysis: parsed.portfolioAnalysis,
    generatedAt: new Date().toISOString().split("T")[0],
  };

  // Build context markdown
  const contextMarkdown = buildCopyContext(portfolioSummary);

  // Store report in DB
  const reportId = nanoid();
  await db.insert(schema.reports).values({
    id: reportId,
    userId: user.id,
    generatedAt: new Date(),
    portfolioSummary: JSON.stringify(portfolioSummary),
    contextMarkdown,
  });

  // Store individual narratives
  for (const n of narratives) {
    await db.insert(schema.stockNarratives).values({
      id: nanoid(),
      reportId,
      userId: user.id,
      ticker: n.ticker,
      narrative: n.narrative,
      signal: n.signal,
      signalRationale: n.signalRationale,
      researchSources: JSON.stringify(n.researchSources),
      createdAt: new Date(),
    });
  }

  console.log(`Report stored with ID: ${reportId}`);

  // Output the report and context to temp files
  const { writeFileSync } = await import("fs");
  const emailBody = formatEmailReport(portfolioSummary);
  writeFileSync("/tmp/portfolio-report.txt", emailBody);
  console.log("Report written to /tmp/portfolio-report.txt");
  writeFileSync("/tmp/portfolio-context.md", contextMarkdown);
  console.log("Context markdown written to /tmp/portfolio-context.md");

  console.log("Done!");
}

function formatEmailReport(summary: PortfolioSummary): string {
  const date = summary.generatedAt;

  let report = `Portfolio Narrative Report — ${date}\n\n`;
  report += `Portfolio Value: $${summary.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n`;
  report += `Overall P&L: ${summary.overallPnlPercent > 0 ? "+" : ""}${summary.overallPnlPercent.toFixed(1)}%\n\n`;
  report += `---\n\n`;

  for (const n of summary.narratives) {
    const holding = summary.holdings.find((h) => h.ticker === n.ticker);
    report += `${n.ticker} — ${n.signal} (${n.trajectory})\n`;
    if (holding) {
      report += `Allocation: ${holding.allocationPercent.toFixed(1)}% | P&L: ${holding.pnlPercent !== null ? `${holding.pnlPercent > 0 ? "+" : ""}${holding.pnlPercent.toFixed(1)}%` : "N/A"}\n`;
    }
    report += `\n${n.narrative}\n`;
    report += `\nRationale: ${n.signalRationale}\n\n---\n\n`;
  }

  report += `PORTFOLIO ANALYSIS\n\n${summary.portfolioAnalysis}\n`;

  return report;
}

main().catch((err) => {
  console.error("Report generation failed:", err);
  process.exit(1);
});
