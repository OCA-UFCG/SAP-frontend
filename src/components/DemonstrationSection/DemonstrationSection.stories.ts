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

export const Default: Story = {
  args: {
    header: {
      title: "Demonstração",
      description: "O vídeo abaixo apresenta uma demonstração do funcionamento da ferramenta do SAP, para mais detalhes entre em contato conosco através do e-mail no rodapé da nossa página!",
    },
    video: {
      videoUrl: "https://www.youtube.com/embed/placeholder-video-id", // ainda sem o link real do vídeo
    }
  },
};

export const Mobile: Story = {
  args: {
    header: {
      title: "Demonstração",
      description: "O vídeo abaixo apresenta uma demonstração do funcionamento da ferramenta do SAP, para mais detalhes entre em contato conosco através do e-mail no rodapé da nossa página!",
    },
    video: {
      videoUrl: "https://www.youtube.com/embed/placeholder-video-id", // ainda sem link real do vídeo
    }
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};