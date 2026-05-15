import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-24">
        <h1 className="text-4xl font-bold tracking-tight">
          Portfolio Narrative Analyst
        </h1>
        <p className="mt-4 text-lg text-gray-400 max-w-xl">
          Track the story behind your stocks. Daily narrative analysis with
          Buy/Sell/Hold signals, delivered to your inbox.
        </p>

        <div className="mt-12 flex gap-4">
          <Link
            href="/link"
            className="bg-white text-black font-semibold px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Link Brokerage
          </Link>
          <Link
            href="/dashboard"
            className="border border-gray-700 text-white font-semibold px-6 py-3 rounded-lg hover:border-gray-500 transition-colors"
          >
            Dashboard
          </Link>
        </div>

        <div className="mt-20 grid gap-8">
          <div>
            <h3 className="text-lg font-semibold">Narrative Tracking</h3>
            <p className="mt-1 text-gray-400">
              Goes beyond price — tracks how the market story around each stock
              is evolving. Detects narrative shifts before they hit the price.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Daily Reports</h3>
            <p className="mt-1 text-gray-400">
              Every morning at 9 AM ET, get a full analysis of your portfolio
              with Buy/Sell/Hold signals emailed to you.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Copy Context</h3>
            <p className="mt-1 text-gray-400">
              One click exports your full portfolio data + narratives as a
              context document. Paste into any LLM for instant follow-up
              questions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
