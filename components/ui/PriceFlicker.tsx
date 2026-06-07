"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { formatCurrency } from "@/lib/utils/formatters";

interface PriceFlickerProps {
  value: number;
  className?: string;
  large?: boolean;
}

export function PriceFlicker({ value, className, large }: PriceFlickerProps) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current === value) return;
    setFlash(value > prevValueRef.current ? "up" : "down");
    prevValueRef.current = value;
    const t = setTimeout(() => setFlash(null), 600);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <span
      className={clsx(
        "font-mono transition-colors duration-300 rounded",
        flash === "up" && "animate-price-up",
        flash === "down" && "animate-price-down",
        large && "text-4xl font-medium tracking-tight",
        className
      )}
    >
      {formatCurrency(value)}
    </span>
  );
}
