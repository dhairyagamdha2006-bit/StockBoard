import next from "eslint-config-next";
import tseslint from "typescript-eslint";

/**
 * Flat ESLint config for Next 16. eslint-config-next ships native flat configs,
 * so we spread its default export directly (no FlatCompat needed).
 */
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "coverage/**",
      "playwright-report/**",
    ],
  },
  ...next,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Canonical "fetch data on mount" effects legitimately set a loading flag.
      // This React 19-oriented rule over-flags that pattern; keep it advisory.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
