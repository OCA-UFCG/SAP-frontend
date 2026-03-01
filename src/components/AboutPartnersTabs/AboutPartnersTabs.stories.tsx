import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AboutPartnersTabs } from "./AboutPartnersTabs";
import type { PartnerI, SectionHeaderI } from "@/utils/interfaces";

const meta: Meta<typeof AboutPartnersTabs> = {
  title: "Components/AboutPartnersTabs",
  component: AboutPartnersTabs,
  tags: ["autodocs"],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};

export default meta;
type Story = StoryObj<typeof AboutPartnersTabs>;

const partnersHeader: SectionHeaderI = {
  sys: { id: "header-1" },
  title: "Parceiros",
  description:
    "Conheça nossos parceiros aos quais em colaboração conosco nos apoiam no desenvolvimento do Sistema de Alerta Precoce.",
};

const partners: PartnerI[] = [
  {
    sys: { id: "1" },
    name: "OCA",
    image: {
      url: "/partners/oca.png",
      title: "Logo OCA",
      width: 78,
      height: 78,
    },
  },
  {
    sys: { id: "2" },
    name: "INSA",
    image: {
      url: "/partners/insa.png",
      title: "Logo INSA",
      width: 221,
      height: 79,
    },
  },
  {
    sys: { id: "3" },
    name: "MMA",
    image: {
      url: "/partners/mma.png",
      title: "Logo MMA",
      width: 319,
      height: 78,
    },
  },
  {
    sys: { id: "4" },
    name: "BNDES",
    image: {
      url: "/partners/bndes.png",
      title: "Logo BNDES",
      width: 270,
      height: 78,
    },
  },
  {
    sys: { id: "5" },
    name: "UFCG",
    image: {
      url: "/partners/ufcg.png",
      title: "Logo UFCG",
      width: 248,
      height: 78,
    },
  },
];

export const Default: Story = {
  args: {
    partnersHeader,
    partners,
    defaultTab: "about",
  },
};

export const PartnersTab: Story = {
  args: {
    ...Default.args,
    defaultTab: "partners",
  },
};
