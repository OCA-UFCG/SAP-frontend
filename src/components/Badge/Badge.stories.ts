import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
  component: Badge,
  args: {
    label: "Plano de Ação Brasileiro",
  },
};

export default meta;

type Story = StoryObj<typeof Badge>;

export const Neutral: Story = {};

export const Primary: Story = {
  args: { label: "O SEDES atua nesse eixo", variant: "primary" },
};

export const Accent: Story = {
  args: { label: "CEMADEN", variant: "accent", size: "sm" },
};

export const Subtle: Story = {
  args: { label: "INCRA", variant: "subtle", size: "sm" },
};
