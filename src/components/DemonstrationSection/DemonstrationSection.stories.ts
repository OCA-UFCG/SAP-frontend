import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import DemonstrationSection from "./DemonstrationSection";

const meta: Meta<typeof DemonstrationSection> = {
  title: "Components/Homepage/DemonstrationSection",
  component: DemonstrationSection,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof DemonstrationSection>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};