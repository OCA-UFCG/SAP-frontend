// DataCards.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import DataCards from "./DataCards"; // ajuste o path se necessário

const meta: Meta<typeof DataCards> = {
  title: "Dashboard/DataCards",
  component: DataCards,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    noDroughtAreaValue: { control: "number" },
    watchAreaValue: { control: "number" },
    recoveryAreaValue: { control: "number" },
  },
};

export default meta;
type Story = StoryObj<typeof DataCards>;

export const Default: Story = {
  args: {
    noDroughtAreaValue: 43.3,
    watchAreaValue: 24.5,
    recoveryAreaValue: 17,
  },
};

export const ZeroValues: Story = {
  args: {
    noDroughtAreaValue: 0,
    watchAreaValue: 0,
    recoveryAreaValue: 0,
  },
};

export const LargeValues: Story = {
  args: {
    noDroughtAreaValue: 99.9,
    watchAreaValue: 88.8,
    recoveryAreaValue: 77.7,
  },
};