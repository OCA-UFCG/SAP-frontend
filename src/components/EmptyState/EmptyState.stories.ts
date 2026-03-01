import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { EmptyState } from "./EmptyState"

const meta: Meta<typeof EmptyState> = {
  title: "Components/EmptyState",
  component: EmptyState,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta

type Story = StoryObj<typeof EmptyState>

export const Default: Story = {}