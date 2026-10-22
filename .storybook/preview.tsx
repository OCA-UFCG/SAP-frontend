import type { Preview } from '@storybook/nextjs-vite'
import { NextIntlClientProvider } from "next-intl";
import "../src/app/globals.css";

// As mensagens ficam num JSON por componente (src/translations/pt/*.json), e
// cada arquivo traz o próprio namespace no topo — o mesmo merge que o
// `request.ts` faz no servidor. Sem o provider, quase todo story quebrava em
// `useTranslations` antes de o axe chegar a olhar a tela.
const messageFiles = import.meta.glob<Record<string, unknown>>(
  "../src/translations/pt/*.json",
  { eager: true, import: "default" },
);
const messages = Object.assign({}, ...Object.values(messageFiles));

const preview: Preview = {
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="pt" messages={messages}>
        <Story />
      </NextIntlClientProvider>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      // Erro: uma violação do axe (contraste, botão sem nome, campo sem
      // rótulo) reprova o story, como pede o art. 63 da LBI.
      test: 'error'
    }
  },
};

export default preview;
