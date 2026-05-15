export type Signal = "BUY" | "SELL" | "HOLD";

export interface ResearchResult {
  source: string;
  title: string;
  summary: string;
  url: string;
  date: string;
}

export interface StockNarrative {
  ticker: string;
  name: string;
  narrative: string;
  trajectory: "improving" | "stable" | "deteriorating";
  signal: Signal;
  signalRationale: string;
  researchSources: ResearchResult[];
}

export interface HoldingData {
  ticker: string;
  name: string;
  quantity: number;
  costBasis: number | null;
  currentPrice: number | null;
  currentValue: number | null;
  allocationPercent: number;
  pnlPercent: number | null;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCostBasis: number;
  overallPnlPercent: number;
  holdings: HoldingData[];
  narratives: StockNarrative[];
  portfolioAnalysis: string;
  generatedAt: string;
}
