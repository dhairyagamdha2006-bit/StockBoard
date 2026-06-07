import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StockBoard — Unified Portfolio Tracker",
  description: "Aggregate your Fidelity, E*TRADE, and Charles Schwab holdings into one auto-updating dashboard.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%231a1a2e'/><text y='22' x='4' font-size='20'>📈</text></svg>",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className="antialiased">{children}</body>
    </html>
  );
}
