import Link from "next/link";

interface ReportCardProps {
  id: string;
  generatedAt: string;
  holdingsCount: number;
  signals: { buy: number; sell: number; hold: number };
}

export function ReportCard({
  id,
  generatedAt,
  holdingsCount,
  signals,
}: ReportCardProps) {
  return (
    <Link href={`/report/${id}`}>
      <div className="border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-gray-400">{generatedAt}</p>
            <p className="text-white mt-1">{holdingsCount} holdings analyzed</p>
          </div>
          <div className="flex gap-2 text-xs font-mono">
            {signals.buy > 0 && (
              <span className="bg-green-900/50 text-green-400 px-2 py-1 rounded">
                {signals.buy} BUY
              </span>
            )}
            {signals.sell > 0 && (
              <span className="bg-red-900/50 text-red-400 px-2 py-1 rounded">
                {signals.sell} SELL
              </span>
            )}
            {signals.hold > 0 && (
              <span className="bg-yellow-900/50 text-yellow-400 px-2 py-1 rounded">
                {signals.hold} HOLD
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
