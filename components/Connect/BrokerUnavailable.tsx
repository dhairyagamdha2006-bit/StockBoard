import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Graceful state shown when a broker integration isn't available on this
 * deployment (not configured, or experimental + disabled). Honest about why.
 */
export function BrokerUnavailable({
  displayName,
  reason,
  requirements,
}: {
  displayName: string;
  reason: string;
  requirements: string[];
}) {
  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-6">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <h2 className="text-sm font-semibold font-sans text-amber-800 dark:text-amber-300">
          {displayName} isn&apos;t available here
        </h2>
      </div>
      <p className="text-xs text-amber-800/90 dark:text-amber-300/90 font-sans leading-relaxed mb-3">
        {reason}
      </p>
      {requirements.length > 0 && (
        <ul className="text-xs text-amber-800/80 dark:text-amber-300/80 font-sans list-disc pl-4 space-y-1">
          {requirements.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <Link
        href="/dashboard"
        className="inline-block mt-4 text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
      >
        ← Back to dashboard
      </Link>
    </div>
  );
}
