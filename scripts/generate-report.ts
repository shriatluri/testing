import { loadEnv } from "../src/lib/env";
loadEnv();

import { db, schema } from "../src/lib/db";
import { eq, desc, and, gte, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { writeFileSync } from "fs";
import { fetchAndStoreHoldings } from "../src/lib/plaid/holdings";
import { gatherResearchBatched } from "../src/lib/research";
import { buildNarrativePrompt } from "../src/lib/narrative/prompt";
import { callClaude, parseClaudeResponse, sendGmailDraft } from "../src/lib/narrative/claude";
import { formatEmailReport } from "../src/lib/narrative/format";
import { buildCopyContext } from "../src/lib/context/build-context";
import type { HoldingData, StockNarrative, PortfolioSummary } from "../src/lib/types";

async function main() {
  console.log("Starting report generation...");

  // Get user
  const user = await db.query.users.findFirst();
  if (!user) {
    console.error("No user found. Link a brokerage account first.");
    process.exit(1);
  }

  // Sync holdings from Plaid
  if (user.plaidAccessToken) {
    console.log("Syncing holdings from Plaid...");
    const count = await fetchAndStoreHoldings(user.id);
    console.log(`  Synced ${count} holdings`);
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

  // Gather research
  console.log("Gathering research...");
  const tickers = [...new Set(holdings.map((h) => h.ticker))].filter(
    (t) => t !== "UNKNOWN"
  );
  const researchByTicker = await gatherResearchBatched(tickers);

  // Generate narratives via claude -p
  console.log("Generating narratives via claude -p...");
  const prompt = buildNarrativePrompt(holdingsData, researchByTicker);

  let claudeOutput: string;
  try {
    claudeOutput = callClaude(prompt);
  } catch (error) {
    console.error("claude -p failed:", error);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = parseClaudeResponse(claudeOutput);
  } catch (error) {
    console.error("Failed to parse claude output:", error);
    console.error("Raw output:", claudeOutput.slice(0, 500));
    process.exit(1);
  }

  // Build narratives with research sources
  const narratives: StockNarrative[] = parsed.narratives.map((n) => {
    const holding = holdingsData.find((h) => h.ticker === n.ticker);
    const research = researchByTicker[n.ticker] || {};
    return {
      ticker: n.ticker,
      name: holding?.name || n.ticker,
      narrative: n.narrative,
      trajectory: n.trajectory,
      signal: n.signal,
      signalRationale: n.signalRationale,
      researchSources: [...(research.filings || [])],
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

  // Replace today's report if one already exists
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const existingReport = await db.query.reports.findFirst({
    where: and(
      eq(schema.reports.userId, user.id),
      gte(schema.reports.generatedAt, todayStart),
      lt(schema.reports.generatedAt, tomorrowStart)
    ),
  });

  let reportId: string;
  if (existingReport) {
    reportId = existingReport.id;
    console.log(`Replacing existing report for today (${reportId})...`);
    await db.delete(schema.stockNarratives).where(eq(schema.stockNarratives.reportId, reportId));
    await db
      .update(schema.reports)
      .set({ generatedAt: new Date(), portfolioSummary: JSON.stringify(portfolioSummary), contextMarkdown })
      .where(eq(schema.reports.id, reportId));
  } else {
    reportId = nanoid();
    await db.insert(schema.reports).values({
      id: reportId,
      userId: user.id,
      generatedAt: new Date(),
      portfolioSummary: JSON.stringify(portfolioSummary),
      contextMarkdown,
    });
  }

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

  // Write output files
  const emailBody = formatEmailReport(portfolioSummary);
  writeFileSync("/tmp/portfolio-report.txt", emailBody);
  writeFileSync("/tmp/portfolio-context.md", contextMarkdown);

  // Email via Gmail MCP
  const userEmail = process.env.USER_EMAIL;
  if (userEmail) {
    console.log("Drafting Gmail...");
    const date = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    try {
      sendGmailDraft(userEmail, `Portfolio Narrative Report - ${date}`, emailBody);
      console.log("Gmail draft created!");
    } catch (err) {
      console.error("Gmail draft failed:", err);
    }
  }

  console.log("Done!");
}

main().catch((err) => {
  console.error("Report generation failed:", err);
  process.exit(1);
});
