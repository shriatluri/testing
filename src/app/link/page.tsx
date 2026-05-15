"use client";

import { PlaidLinkButton } from "@/components/plaid-link-button";
import Link from "next/link";

export default function LinkPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-6 py-24">
        <Link
          href="/"
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          &larr; Back
        </Link>

        <h1 className="text-3xl font-bold mt-8">Link Your Brokerage</h1>
        <p className="mt-3 text-gray-400">
          Connect your brokerage account to automatically sync your holdings.
          We use Plaid for secure, read-only access to your investment data.
        </p>

        <div className="mt-8 p-6 border border-gray-800 rounded-lg">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Supported Brokerages
          </h3>
          <p className="mt-2 text-gray-300">
            Robinhood, Schwab, Fidelity, TD Ameritrade, E*TRADE, Vanguard,
            and 100+ more.
          </p>

          <div className="mt-6">
            <PlaidLinkButton />
          </div>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          <p>
            Plaid provides read-only access. We never execute trades or
            modify your accounts.
          </p>
        </div>
      </div>
    </div>
  );
}
