import { AlertTiers } from "./AlertTiers";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatusItemI } from "../../utils/interfaces";

  const baseItems: StatusItemI[] = [
    {
      id: "1",
      label: "Sem seca",
      value: 43.3,
      color: "#F0F0D7",
      textColor: "#292829"
    },
    {
      id: "2",
      label: "Observação (Watch)",
      value: 24.5,
      color: "#FECB89",
      textColor: "#292829"

    },
    {
      id: "3",
      label: "Atenção (Warning)",
      value: 6,
      color: "#FC8F23",
      textColor: "#292829"
    },
    {
      id: "4",
      label: "Alerta (Alert)",
      value: 13.2,
      color: "#B52C08",
      textColor: "#F8F7F8"

    },
    {
      id: "6",
      label: "Recuperação Total (Full Recovery)",
      value: 13,
      color: "#B4BA61",
      textColor: "#F8F7F8"

    },
        {
      id: "7",
      label: "Recuperação Parcial (Partial Recovery)",
      value: 13,
      color: "#5B612A",
      textColor: "#F8F7F8"

    },
  ];

const meta = {
  title: "Components/AlertTiers",
  component: AlertTiers,
  tags: ["autodocs"],
} satisfies Meta<typeof AlertTiers>;

export default meta;
type Story = StoryObj<typeof meta>;


// Story padrão
export const Default: Story = {
  args: {
    items: baseItems,
  },
};


// Todos valores iguais (teste visual do gráfico)
export const EqualValues: Story = {
  args: {
    items: baseItems.map((item) => ({
      ...item,
      value: 25,
    })),
  },
};


// Valores zero
export const ZeroValues: Story = {
  args: {
    items: baseItems.map((item) => ({
      ...item,
      value: 0,
    })),
  },
};


// Apenas um item
export const SingleItem: Story = {
  args: {
    items: [
      {
        id: "1",
        label: "Sem seca",
        value: 100,
        color: "#F0F0D7",
        checked: false,
        textColor: "#292829"
      },
    ],
  },
};


// Labels longas (teste de layout)
export const LongLabels: Story = {
  args: {
    items: baseItems.map((item) => ({
      ...item,
      label:
        item.label +
        " - Texto adicional muito longo para validar quebra de layout",
    })),
  },
};