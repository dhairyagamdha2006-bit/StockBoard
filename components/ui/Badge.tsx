import { clsx } from "clsx";

interface BadgeProps {
  variant?: "positive" | "negative" | "neutral" | "live";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium font-mono",
        variant === "positive" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        variant === "negative" && "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
        variant === "neutral" && "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
        variant === "live" && "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
        className
      )}
    >
      {variant === "live" && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
        </span>
      )}
      {children}
    </span>
  );
}
