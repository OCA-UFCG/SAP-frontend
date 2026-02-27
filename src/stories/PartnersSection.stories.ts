import { PartnersSection } from "../components/PartnersSection/PartnersSection";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { SectionHeaderI, PartnerI } from "../utils/interfaces";

const meta = {
  title: "Components/PartnersSection",
  component: PartnersSection,
  tags: ["autodocs"],
  parameters: {},
} satisfies Meta<typeof PartnersSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ---------------- MOCK HEADER ---------------- */

const baseHeader: SectionHeaderI = {
  sys: { id: "header-1" },
  title: "Parceiros",
  description:
    "Conheça nossos parceiros aos quais em colaboração conosco nos apoiam no desenvolvimento do Sistema de Alerta Precoce.",
};

/* ---------------- MOCK PARTNERS ---------------- */

const basePartners: PartnerI[] = [
  {
    sys: { id: "1" },
    name: "OCA",
    image: {
      url: "/partners/oca.png",
      title: "Logo OCA",
      width: 300,
      height: 100,
    },
  },
  {
    sys: { id: "2" },
    name: "INSA",
    image: {
      url: "/partners/insa.png",
      title: "Logo INSA",
      width: 200,
      height: 100,
    },
  },
  {
    sys: { id: "3" },
    name: "MMA",
    image: {
      url: "/partners/mma.png",
      title: "Logo MMA",
      width: 200,
      height: 100,
    },
  },
  {
    sys: { id: "4" },
    name: "BNDES",
    image: {
      url: "/partners/bndes.png",
      title: "Logo BNDES",
      width: 200,
      height: 100,
    },
  },
  {
    sys: { id: "5" },
    name: "UFCG",
    image: {
      url: "/partners/ufcg.png",
      title: "Logo UFCG",
      width: 200,
      height: 100,
    },
  },
];

/* ---------------- STORIES ---------------- */

// Story padrão
export const Default: Story = {
  args: {
    header: baseHeader,
    partners: basePartners,
  },
};

// Título longo
export const LongTitle: Story = {
  args: {
    header: {
      ...baseHeader,
      sys: { id: "header-2" },
      title:
        "Empresas e Instituições que Confiam em Nosso Trabalho e Contribuem para Nosso Crescimento",
    },
    partners: basePartners,
  },
};

// Título curto
export const ShortTitle: Story = {
  args: {
    header: {
      ...baseHeader,
      sys: { id: "header-3" },
      title: "Parceiros",
    },
    partners: basePartners,
  },
};

// Sem parceiros
export const NoPartners: Story = {
  args: {
    header: {
      ...baseHeader,
      sys: { id: "header-4" },
    },
    partners: [],
  },
};

// Muitos parceiros
export const ManyPartners: Story = {
  args: {
    header: {
      ...baseHeader,
      sys: { id: "header-5" },
    },
    partners: Array(8)
      .fill(basePartners)
      .flat()
      .map((partner, index) => ({
        ...partner,
        sys: { id: `${index + 1}` },
      })),
  },
};

// Com classe customizada
export const CustomClassName: Story = {
  args: {
    header: {
      ...baseHeader,
      sys: { id: "header-6" },
    },
    partners: basePartners,
    className: "shadow-lg",
  },
};
