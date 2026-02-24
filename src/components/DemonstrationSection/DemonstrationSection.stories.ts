import { Meta, StoryObj } from "@storybook/nextjs-vite";
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

const mockContent = {
  title: "Demonstração",
  description: "O vídeo abaixo apresenta uma demonstração do funcionamento da ferramenta do SAP, para mais detalhes entre em contato conosco através do e-mail no rodapé da nossa página!",
  videoUrl: "https://www.youtube.com/embed/placeholder-video-id", 
};

export const Default: Story = {
  args: {
    content: mockContent,
  },
};

export const Mobile: Story = {
  args: {
    content: mockContent,
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};