import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import TabsSection from "./TabSection";

const meta: Meta<typeof TabsSection> = {
  title: "Components/TabsSection",
  component: TabsSection,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof TabsSection>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};