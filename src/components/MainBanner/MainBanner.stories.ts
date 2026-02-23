import type { Meta, StoryObj } from '@storybook/nextjs'; 
import { MainBanner } from './MainBanner';

const meta: Meta<typeof MainBanner> = {
  title: 'Components/MainBanner',
  component: MainBanner,
  args: {
    data: {
      title: "Sistema de Alerta Precoce",
      subtitle: "Monitoramento de seca e desertificação.",
      buttonLabel: "Explorar Mapa",
      buttonUrl: "#",
      image: {
        url: "/banner.png"
      }
    }
  }
};

export default meta;

type Story = StoryObj<typeof MainBanner>;

export const Default: Story = {};