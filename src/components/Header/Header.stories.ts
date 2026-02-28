import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Header } from "./Header";
import { ISections } from "@/utils/interfaces";

const meta: Meta<typeof Header> = {
  title: "Layout/Header",
  component: Header,
  tags: ["autodocs"],

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
  },
  "map-section": {
    id: "2",
    name: "Mapa",
    path: "/mapa",
    appears: true,
  },
  "about-section": {
    id: "3",
    name: "Sobre o Sap",
    path: "/sobre-o-sap",
    appears: true,
  },
  "contact-section": {
    id: "4",
    name: "Contatos",
    path: "/contatos",
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
