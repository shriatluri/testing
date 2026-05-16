import { db, schema } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { HoldingsTable } from "@/components/holdings-table";
import { ReportCard } from "@/components/report-card";
import { RunReportButton } from "@/components/run-report-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await db.query.users.findFirst();

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-4xl mx-auto px-6 py-24">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-4 text-gray-400">
            No account linked yet.{" "}
            <Link href="/link" className="text-white underline">
              Link your brokerage
            </Link>{" "}
            to get started.
          </p>
        </div>
      </div>
    );
  }

  // Get latest holdings
  const latestHolding = await db.query.holdings.findFirst({
    where: eq(schema.holdings.userId, user.id),
    orderBy: [desc(schema.holdings.createdAt)],
  });

  const holdings = latestHolding
    ? await db.query.holdings.findMany({
        where: eq(schema.holdings.snapshotDate, latestHolding.snapshotDate),
      })
    : [];

  // Get recent reports
  const reports = await db.query.reports.findMany({
    where: eq(schema.reports.userId, user.id),
    orderBy: [desc(schema.reports.generatedAt)],
    limit: 10,
  });

  // Get signal counts for each report
  const reportsWithSignals = await Promise.all(
    reports.map(async (report) => {
      const narratives = await db.query.stockNarratives.findMany({
        where: eq(schema.stockNarratives.reportId, report.id),
      });
      return {
        id: report.id,
        generatedAt: report.generatedAt
          ? new Date(report.generatedAt).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "Unknown",
        holdingsCount: narratives.length,
        signals: {
          buy: narratives.filter((n) => n.signal === "BUY").length,
          sell: narratives.filter((n) => n.signal === "SELL").length,
          hold: narratives.filter((n) => n.signal === "HOLD").length,
        },
      };
    })
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-4">
            <RunReportButton />
            <Link
              href="/"
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              Home
            </Link>
          </div>
        </div>

        {/* Holdings */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Current Holdings</h2>
          {holdings.length > 0 ? (
            <div className="mt-4">
              <HoldingsTable holdings={holdings} />
            </div>
          ) : (
            <p className="mt-3 text-gray-400">
              No holdings synced yet.{" "}
              <Link href="/link" className="text-white underline">
                Link your brokerage
              </Link>
              .
            </p>
          )}
        </section>

        {/* Reports */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Recent Reports</h2>
          {reportsWithSignals.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {reportsWithSignals.map((report) => (
                <ReportCard key={report.id} {...report} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-gray-400">
              No reports yet. Run the daily report script to generate your
              first analysis.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
