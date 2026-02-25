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
        url: "https://images.ctfassets.net/ltku4sobsen2/5F33iWSe0kcsJi4loCAGNq/aa417ec6735744009d57de04017a740f/297efe92c527cd9c7d5dec693cc5a887347e39ec.jpg"
      }
    }
  }
};

export default meta;

type Story = StoryObj<typeof MainBanner>;

export const Default: Story = {};