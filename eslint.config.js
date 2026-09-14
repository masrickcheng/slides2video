import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "ppt/**", "**/tmp/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.node,
        fetch: "readonly",
        window: "readonly",
      },
    },
  },
];
