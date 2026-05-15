"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

export function PlaidLinkButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  useEffect(() => {
    async function createLinkToken() {
      const res = await fetch("/api/plaid/create-link-token", {
        method: "POST",
      });
      const data = await res.json();
      setLinkToken(data.link_token);
    }
    createLinkToken();
  }, []);

  const onSuccess = useCallback(async (publicToken: string) => {
    setStatus("loading");
    try {
      const res = await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken }),
      });

      if (res.ok) {
        // Sync holdings immediately
        await fetch("/api/plaid/holdings", { method: "POST" });
        setStatus("success");
        window.location.href = "/dashboard";
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  return (
    <div>
      <button
        onClick={() => open()}
        disabled={!ready || status === "loading"}
        className="bg-white text-black font-semibold px-6 py-3 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {status === "loading"
          ? "Linking..."
          : status === "success"
            ? "Linked!"
            : "Link Brokerage Account"}
      </button>
      {status === "error" && (
        <p className="text-red-400 mt-2 text-sm">
          Failed to link account. Please try again.
        </p>
      )}
    </div>
  );
}
