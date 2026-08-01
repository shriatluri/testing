import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PortfolioSummary, Signal } from "@/lib/types";

export const dynamic = "force-dynamic";

function SignalBadge({ signal }: { signal: Signal }) {
  const colors = {
    BUY: "bg-green-900/50 text-green-400 border-green-800",
    SELL: "bg-red-900/50 text-red-400 border-red-800",
    HOLD: "bg-yellow-900/50 text-yellow-400 border-yellow-800",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border ${colors[signal]}`}
    >
      {signal}
    </span>
  );
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const report = await db.query.reports.findFirst({
    where: eq(schema.reports.id, id),
  });

  if (!report) notFound();

  const narratives = await db.query.stockNarratives.findMany({
    where: eq(schema.stockNarratives.reportId, id),
  });

  const summary: PortfolioSummary = JSON.parse(report.portfolioSummary);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center">
          <Link
            href="/"
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            &larr; Dashboard
          </Link>
          <Link
            href={`/context/${id}`}
            className="bg-white text-black font-semibold px-4 py-2 rounded-lg text-sm hover:bg-gray-100 transition-colors"
          >
            Copy Full Context
          </Link>
        </div>

        <h1 className="text-3xl font-bold mt-8">
          Portfolio Report — {summary.generatedAt}
        </h1>

        {/* Portfolio Overview */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="border border-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400">Total Value</p>
            <p className="text-xl font-semibold mt-1">
              $
              {summary.totalValue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="border border-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400">Cost Basis</p>
            <p className="text-xl font-semibold mt-1">
              $
              {summary.totalCostBasis.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="border border-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400">Overall P&L</p>
            <p
              className={`text-xl font-semibold mt-1 ${summary.overallPnlPercent >= 0 ? "text-green-400" : "text-red-400"}`}
            >
              {summary.overallPnlPercent > 0 ? "+" : ""}
              {summary.overallPnlPercent.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Stock Narratives */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Stock Narratives</h2>
          <div className="mt-4 space-y-4">
            {narratives.map((n) => {
              const holding = summary.holdings.find(
                (h) => h.ticker === n.ticker
              );
              const pnlAmt =
                holding?.currentValue && holding?.costBasis
                  ? holding.currentValue - holding.costBasis
                  : null;
              const fmt = (v: number) =>
                v.toLocaleString("en-US", { minimumFractionDigits: 2 });

              return (
                <div
                  key={n.id}
                  className="border border-gray-800 rounded-lg p-5"
                >
                  {/* Header: TICKER — $Value (Alloc%)  SIGNAL */}
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold font-mono">
                      {n.ticker}
                      {holding && (
                        <span className="text-gray-400 font-normal">
                          {" "}
                          — ${holding.currentValue ? fmt(holding.currentValue) : "N/A"}{" "}
                          ({holding.allocationPercent.toFixed(1)}%)
                        </span>
                      )}
                    </h3>
                    <SignalBadge signal={n.signal as Signal} />
                  </div>

                  {/* Subheader: shares @ price | Cost | P&L */}
                  {holding && (
                    <p className="text-sm text-gray-500 mt-1 font-mono">
                      {holding.quantity} shares
                      {holding.currentPrice
                        ? ` @ $${holding.currentPrice.toFixed(2)}`
                        : ""}
                      {holding.costBasis
                        ? ` | Cost: $${fmt(holding.costBasis)}`
                        : ""}
                      {pnlAmt !== null && holding.pnlPercent !== null && (
                        <span
                          className={
                            holding.pnlPercent >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        >
                          {" "}
                          | P&L: {pnlAmt >= 0 ? "+" : "-"}${fmt(Math.abs(pnlAmt))} (
                          {holding.pnlPercent > 0 ? "+" : ""}
                          {holding.pnlPercent.toFixed(1)}%)
                        </span>
                      )}
                    </p>
                  )}

                  {/* Narrative */}
                  <p className="mt-3 text-gray-300 leading-relaxed whitespace-pre-line">
                    {n.narrative}
                  </p>

                  {/* Rationale */}
                  <p className="mt-3 text-sm text-gray-400">
                    <span className="font-medium text-gray-300">
                      Rationale:
                    </span>{" "}
                    {n.signalRationale}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Portfolio Analysis */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Portfolio Analysis</h2>
          <div className="mt-4 border border-gray-800 rounded-lg p-5 prose prose-invert prose-sm max-w-none
            prose-headings:text-white prose-headings:font-semibold
            prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2
            prose-p:text-gray-300 prose-p:leading-relaxed
            prose-li:text-gray-300
            prose-ol:pl-5 prose-ul:pl-5
            prose-strong:text-white
            prose-table:text-sm prose-th:text-gray-400 prose-td:text-gray-300">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary.portfolioAnalysis}</ReactMarkdown>
          </div>
        </section>
      </div>
    </div>
  );
}
