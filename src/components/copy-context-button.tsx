"use client";

import { useState } from "react";

export function CopyContextButton({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = markdown;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`px-6 py-3 rounded-lg font-semibold transition-all ${
        copied
          ? "bg-green-600 text-white"
          : "bg-white text-black hover:bg-gray-100"
      }`}
    >
      {copied ? "Copied!" : "Copy Full Context"}
    </button>
  );
}
