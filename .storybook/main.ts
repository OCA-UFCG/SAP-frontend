import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  "stories": [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-styling-webpack"
  ],
  "framework": "@storybook/nextjs-vite",
  // As histórias do cadastro mostram o widget do captcha. Sem chave configurada
  // ele cai na chave de teste da Cloudflare, que sempre passa.
  env: (config) => ({
    ...config,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY:
      config.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA",
  }),
  "staticDirs": [
    "../public"
  ]
};
export default config;