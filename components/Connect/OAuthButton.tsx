"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { clsx } from "clsx";

interface OAuthButtonProps {
  broker: "etrade" | "schwab";
  label: string;
  color: string;
}

export function OAuthButton({ broker, label, color }: OAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/connect/${broker}?action=initiate`);
    const data = await res.json();

    if (!res.ok || data.error) {
      setError(data.error ?? "Failed to initiate OAuth");
      setLoading(false);
      return;
    }

    const url = data.authUrl ?? data.authorizeUrl;
    if (url) window.location.href = url;
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className={clsx(
          "w-full py-3 rounded-xl font-medium font-sans text-sm flex items-center justify-center gap-2 transition-opacity",
          loading && "opacity-60 cursor-not-allowed"
        )}
        style={{ backgroundColor: color, color: "#fff" }}
      >
        <ExternalLink className="w-4 h-4" />
        {loading ? "Redirecting…" : `Connect ${label}`}
      </button>
      {error && <p className="mt-2 text-xs text-[#f87171] font-sans">{error}</p>}
    </div>
  );
}
