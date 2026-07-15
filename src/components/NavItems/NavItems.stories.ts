import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NavItems } from "./NavItems";
import { ISections } from "@/utils/interfaces";

const meta: Meta<typeof NavItems> = {
  title: "Layout/NavItems",
  component: NavItems,
  tags: ["autodocs"],
  parameters: {
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
  "about-section": {
    id: "3",
    name: "Sobre o SEDES",
    path: "#",
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
type Story = StoryObj<typeof NavItems>;

export const DesktopNavItems: Story = {
  args: {
    className: "flex flex-row items-center gap-[24px]",
    content: Object.values(content),
  },
};
