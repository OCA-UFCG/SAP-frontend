import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { GoogleDocsRegexReader } from "./GoogleDocsRegexReader";

const meta: Meta<typeof GoogleDocsRegexReader> = {
  title: "Components/GoogleDocsRegexReader",
  component: GoogleDocsRegexReader,
};

export default meta;
type Story = StoryObj<typeof GoogleDocsRegexReader>;

export const Default: Story = {
  args: {
    themes: ["DROUGHT_MONITOR"],
    city: "Campina Grande",
    state: "PB",
    month: "Janeiro",
    year: 2024,
  },
};
