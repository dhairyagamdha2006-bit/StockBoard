import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Syne", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      colors: {
        accent: "#4ade80",
        negative: "#f87171",
        navy: "#1a1a2e",
        border: "rgba(0,0,0,0.08)",
        broker: {
          robinhood: {
            bg: "#fee2e2",
            text: "#dc2626",
          },
          fidelity: {
            bg: "#dbeafe",
            text: "#1d4ed8",
          },
          etrade: {
            bg: "#ffedd5",
            text: "#c2410c",
          },
          schwab: {
            bg: "#ede9fe",
            text: "#7c3aed",
          },
        },
      },
      animation: {
        "price-up": "priceUp 0.6s ease-out",
        "price-down": "priceDown 0.6s ease-out",
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
      },
      keyframes: {
        priceUp: {
          "0%": { backgroundColor: "#4ade8033" },
          "100%": { backgroundColor: "transparent" },
        },
        priceDown: {
          "0%": { backgroundColor: "#f8717133" },
          "100%": { backgroundColor: "transparent" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
