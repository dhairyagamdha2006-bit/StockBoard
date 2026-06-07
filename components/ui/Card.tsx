import { clsx } from "clsx";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  style?: React.CSSProperties;
}

export function Card({ children, className, padding = true, style }: CardProps) {
  return (
    <div
      style={style}
      className={clsx(
        "bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08]",
        padding && "p-6",
        className
      )}
    >
      {children}
    </div>
  );
}
