import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Header } from "./Header";
import { ISections } from "@/utils/interfaces";
import { createElement } from "react";
import { AuthContext, type AuthContextType } from "@/contexts/AuthContext";

const signedOutSession: AuthContextType = {
  user: null,
  loading: false,
  signIn: async () => "failed",
  signOut: async () => {},
};

const meta: Meta<typeof Header> = {
  title: "Layout/Header",
  component: Header,
  tags: ["autodocs"],
  // O botão de entrar (UserAuth) lê a sessão do AuthProvider, que no
  // Storybook não tem Firebase: aqui ninguém está logado.
  decorators: [
    (Story) =>
      createElement(
        AuthContext.Provider,
        { value: signedOutSession },
        createElement(Story),
      ),
  ],

  parameters: {
    layout: "fullscreen", // Remove o padding padrão do Storybook para ocupar a tela toda
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/",
      },
    },
  },
};

const content: ISections = {
  "home-section": {
    id: "1",
    name: "Home",
    path: "/",
    appears: true,
    childrenCollection: {
      items: [
        { id: "3-1", name: "Plano de Ação Brasileiro", path: "/#plano-de-acao-brasileiro", appears: true },
        { id: "3-2", name: "Grupo de Trabalho", path: "/#grupo-de-trabalho", appears: true },
        { id: "3-3", name: "A Plataforma", path: "/#a-plataforma", appears: true },
        { id: "3-4", name: "Usuários", path: "/#usuarios", appears: true },
        { id: "3-5", name: "Financiamento", path: "/#financiamento", appears: true },
      ],
    },
  },
  "glossary-section": {
    id: "5",
    name: "Glossário",
    path: "/glossary",
    appears: true,
  },
  "map-section": {
    id: "2",
    name: "Plataforma",
    path: "/platform",
    appears: true,
  },
  "contact-section": {
    id: "4",
    name: "Contatos",
    path: "/contact",
    appears: true,
  },
};

export default meta;
type Story = StoryObj<typeof Header>;

export const HeaderView: Story = {
  args: {
    content: Object.values(content),
  },
};
