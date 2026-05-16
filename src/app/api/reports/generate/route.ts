import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc, and, gte, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { writeFileSync } from "fs";
import { fetchAndStoreHoldings } from "@/lib/plaid/holdings";
import { gatherResearchBatched } from "@/lib/research";
import { buildNarrativePrompt } from "@/lib/narrative/prompt";
import { callClaude, parseClaudeResponse, sendGmailDraft } from "@/lib/narrative/claude";
import { formatEmailReport } from "@/lib/narrative/format";
import { buildCopyContext } from "@/lib/context/build-context";
import type { HoldingData, StockNarrative, PortfolioSummary } from "@/lib/types";

export const dynamic = "force-dynamic";
// Allow up to 5 minutes for the claude -p call
export const maxDuration = 300;

export async function POST() {
  try {
    const user = await db.query.users.findFirst();
    if (!user) {
      return NextResponse.json({ error: "No user found" }, { status: 400 });
    }

    // Sync holdings from Plaid
    if (user.plaidAccessToken) {
      await fetchAndStoreHoldings(user.id);
    }

    // Get latest holdings
    const latestHolding = await db.query.holdings.findFirst({
      where: eq(schema.holdings.userId, user.id),
      orderBy: [desc(schema.holdings.createdAt)],
    });

    if (!latestHolding) {
      return NextResponse.json({ error: "No holdings found" }, { status: 400 });
    }

    const holdings = await db.query.holdings.findMany({
      where: eq(schema.holdings.snapshotDate, latestHolding.snapshotDate),
    });

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
    const tickers = [...new Set(holdings.map((h) => h.ticker))].filter(
      (t) => t !== "UNKNOWN"
    );
    const researchByTicker = await gatherResearchBatched(tickers);

    // Generate narratives via claude -p
    const prompt = buildNarrativePrompt(holdingsData, researchByTicker);
    const claudeOutput = callClaude(prompt);
    const parsed = parseClaudeResponse(claudeOutput);

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

    // Write output files
    const emailBody = formatEmailReport(portfolioSummary);
    writeFileSync("/tmp/portfolio-report.txt", emailBody);
    writeFileSync("/tmp/portfolio-context.md", contextMarkdown);

    // Email via Gmail MCP
    const userEmail = process.env.USER_EMAIL;
    if (userEmail) {
      try {
        sendGmailDraft(userEmail, `Portfolio Narrative Report - ${portfolioSummary.generatedAt}`, emailBody);
      } catch {
        // Non-fatal
      }
    }

    return NextResponse.json({ reportId });
  } catch (err) {
    console.error("Report generation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Report generation failed" },
      { status: 500 }
    );
  }
}
