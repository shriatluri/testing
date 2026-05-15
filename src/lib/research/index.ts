import { fetchSecFilings } from "./sec-filings";
import type { ResearchResult } from "../types";

export async function gatherResearch(
  ticker: string
): Promise<Record<string, ResearchResult[]>> {
  const filings = await fetchSecFilings(ticker);
  return { filings };
}

export async function gatherResearchBatched(
  tickers: string[],
  batchSize = 3
): Promise<Record<string, Record<string, ResearchResult[]>>> {
  const results: Record<string, Record<string, ResearchResult[]>> = {};

  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((t) => gatherResearch(t))
    );
    batch.forEach((ticker, idx) => {
      results[ticker] = batchResults[idx];
    });
    console.log(`  Researched: ${batch.join(", ")}`);
  }

  return results;
}
