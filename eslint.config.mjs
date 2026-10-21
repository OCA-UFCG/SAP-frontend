// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";
import jsxA11y from "eslint-plugin-jsx-a11y";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worktrees locais criados dentro do repositório: outra árvore de código,
    // que lintada aqui apenas duplica trabalho e estoura a memória do eslint.
    ".claude/**",
  ]),
  ...storybook.configs["flat/recommended"],

  // Acessibilidade (LBI, art. 63): o eslint-config-next liga só meia dúzia de
  // regras do jsx-a11y, como aviso. Aqui o conjunto recomendado vira erro, para
  // que um clique sem teclado ou uma imagem sem alt não cheguem à main.
  {
    files: ["src/**/*.tsx"],
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // Quebra com o `minimatch@10` forçado em `overrides` no package.json: o
      // plugin importa o default, que a v10 não exporta mais. Rótulos de campo
      // ficam cobertos pelo axe nos testes do Storybook.
      "jsx-a11y/label-has-associated-control": "off",
    },
  },

  // Keep lint strict for the app, but relax a few rules for server/API glue code
  // and integration layers where `any` is sometimes unavoidable.
  {
    files: [
      "src/app/api/**/*.ts",
      "src/services/**/*.ts",
      "src/utils/functions.ts",
      "src/utils/interfaces.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
