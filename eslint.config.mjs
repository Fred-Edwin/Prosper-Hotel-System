import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import importPlugin from "eslint-plugin-import";

const MODULES = ["catalogue", "stock", "sales", "cash", "people", "reporting"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
      "import/no-restricted-paths": [
        "error",
        {
          zones: MODULES.map((mod) => ({
            target: `./src/modules/!(${mod})/**/*`,
            from: `./src/modules/${mod}/**/*`,
            except: [`**/${mod}/index.ts`],
            message:
              "Cross-module imports must go through the module's index.ts.",
          })),
        },
      ],
    },
  },
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "storybook-static/**",
  ]),
]);

export default eslintConfig;
