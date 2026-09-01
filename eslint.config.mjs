import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  { ignores: [".next/**", "coverage/**", "playwright-report/**", "src/generated/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextVitals,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error"
    }
  }
];

