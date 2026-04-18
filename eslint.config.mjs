import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: [
      "dist/",
      "node_modules/",
      "packages/contracts/artifacts/",
      "packages/contracts/cache/",
      "packages/contracts/typechain-types/",
      "*.js",
      "*.mjs",
    ],
  },
  {
    rules: {
      "max-lines": ["warn", { max: 150, skipBlankLines: true, skipComments: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
