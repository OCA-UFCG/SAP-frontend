import { Meta, StoryObj } from "@storybook/nextjs-vite";
import SearchBar from "./SearchBar";
import { fn } from "storybook/test";

const meta: Meta<typeof SearchBar> = {
  title: "Components/SearchBar",
  component: SearchBar,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onSearch: fn(), // logs actions in Storybook panel
  },
};

export default meta;

type Story = StoryObj<typeof SearchBar>;

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