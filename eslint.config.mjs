import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // `_name` marks an unused parameter required by a signature (e.g. useActionState's prevState).
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // shadcn's generated files import `cn` from the package; ours must use the
    // configured one, which knows our theme (text-15, rounded-pill…).
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/utils.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "cn",
              message: 'Import { cn } from "@/lib/utils" (configured for our tokens).',
            },
          ],
        },
      ],
    },
  },
  // Last: turns off style rules that Prettier owns.
  prettier,
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);

export default eslintConfig;
