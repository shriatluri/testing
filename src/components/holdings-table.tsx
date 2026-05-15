"use client";

interface Holding {
  ticker: string;
  name: string;
  quantity: number;
  costBasis: number | null;
  currentPrice: number | null;
  currentValue: number | null;
}

export function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  const totalValue = holdings.reduce(
    (sum, h) => sum + (h.currentValue || 0),
    0
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-800">
            <th className="py-3 pr-4">Ticker</th>
            <th className="py-3 pr-4">Name</th>
            <th className="py-3 pr-4 text-right">Shares</th>
            <th className="py-3 pr-4 text-right">Cost Basis</th>
            <th className="py-3 pr-4 text-right">Current Value</th>
            <th className="py-3 pr-4 text-right">P&L</th>
            <th className="py-3 text-right">Allocation</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const pnl =
              h.costBasis && h.currentValue
                ? ((h.currentValue - h.costBasis) / h.costBasis) * 100
                : null;
            const allocation =
              totalValue > 0
                ? ((h.currentValue || 0) / totalValue) * 100
                : 0;

            return (
              <tr key={h.ticker} className="border-b border-gray-800/50">
                <td className="py-3 pr-4 font-mono font-semibold">
                  {h.ticker}
                </td>
                <td className="py-3 pr-4 text-gray-300">{h.name}</td>
                <td className="py-3 pr-4 text-right">{h.quantity}</td>
                <td className="py-3 pr-4 text-right">
                  {h.costBasis ? `$${h.costBasis.toFixed(2)}` : "—"}
                </td>
                <td className="py-3 pr-4 text-right">
                  {h.currentValue ? `$${h.currentValue.toFixed(2)}` : "—"}
                </td>
                <td
                  className={`py-3 pr-4 text-right font-medium ${pnl !== null ? (pnl >= 0 ? "text-green-400" : "text-red-400") : ""}`}
                >
                  {pnl !== null
                    ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}%`
                    : "—"}
                </td>
                <td className="py-3 text-right">{allocation.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-700 font-semibold">
            <td className="py-3" colSpan={4}>
              Total
            </td>
            <td className="py-3 pr-4 text-right">
              ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </td>
            <td></td>
            <td className="py-3 text-right">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
