import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { NavItems } from './NavItems';

const meta: Meta<typeof NavItems> = {
  title: 'Layout/NavItems',
  component: NavItems,
  tags: ['autodocs'],
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof NavItems>;

// 1. Layout para o Header (Horizontal)
export const DesktopHeader: Story = {
  args: {
    className: 'flex flex-row items-center gap-[24px]',
  },
};

// 2. Layout para Menu Lateral ou Mobile (Vertical)
export const MobileDrawer: Story = {
  args: {
    className: 'flex flex-col gap-2 w-full max-w-[250px] p-4 bg-slate-50 rounded-lg',
  },
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/products', // Simula o estado ativo em uma rota específica
      },
    },
  },
};

// 3. Visualização com o Link "Sobre Nós" ativo
export const ActiveRoute: Story = {
  args: {
    className: 'flex flex-row gap-4',
  },
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/about',
      },
    },
  },
};