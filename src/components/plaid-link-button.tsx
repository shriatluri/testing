"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

export function PlaidLinkButton({
  variant = "primary",
}: {
  variant?: "primary" | "subtle";
}) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [wantsOpen, setWantsOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

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
        window.location.href = "/";
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

  // Token is fetched on first click, not on mount — open Plaid once it arrives
  useEffect(() => {
    if (wantsOpen && ready) {
      setWantsOpen(false);
      open();
    }
  }, [wantsOpen, ready, open]);

  const handleClick = async () => {
    setWantsOpen(true);
    if (!linkToken) {
      const res = await fetch("/api/plaid/create-link-token", {
        method: "POST",
      });
      const data = await res.json();
      setLinkToken(data.link_token);
    }
  };

  const label =
    status === "loading"
      ? "Linking..."
      : status === "success"
        ? "Linked!"
        : wantsOpen
          ? "Opening..."
          : variant === "subtle"
            ? "Link brokerage"
            : "Link Brokerage Account";

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={status === "loading" || wantsOpen}
        className={
          variant === "subtle"
            ? "text-gray-400 hover:text-white text-sm transition-colors disabled:opacity-50"
            : "bg-white text-black font-semibold px-6 py-3 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        }
      >
        {label}
      </button>
      {status === "error" && (
        <p className="text-red-400 mt-2 text-sm">
          Failed to link account. Please try again.
        </p>
      )}
    </div>
  );
}
