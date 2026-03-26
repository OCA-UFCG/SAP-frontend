import { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlatformMapCaption }from "./PlatformMapCaption";
import { fn } from "storybook/test";

const meta: Meta<typeof PlatformMapCaption> = {
  title: "Components/PlatformMapCaption",
  component: PlatformMapCaption,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onSearch: fn(), // logs actions in Storybook panel
  },
};

export default meta;

type Story = StoryObj<typeof PlatformMapCaption>;

export const Default: Story = {};

export const WithValidState: Story = {
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector("input");
    const button = canvasElement.querySelector("button");

    if (input && button) {
      input.value = "sp";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      button.click();
    }
  },
};

export const WithInvalidState: Story = {
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector("input");
    const button = canvasElement.querySelector("button");

    if (input && button) {
      input.value = "invalid-state";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      button.click();
    }
  },
};