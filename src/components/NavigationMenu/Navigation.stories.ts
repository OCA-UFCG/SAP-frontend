import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Header } from './NavigationMenu';

const meta: Meta<typeof Header> = {
  title: 'Layout/Header',
  component: Header,
  tags: ['autodocs'],
  
  parameters: {
    layout: 'fullscreen', // Remove o padding padrão do Storybook para ocupar a tela toda
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/',
      },
    },
  },
  
};


export default meta;
type Story = StoryObj<typeof Header>;

// 1. Estado na Home (Link 'Home' ativo)
export const HomePage: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/',
      },
    },
  },
};

// 2. Estado na página de Produtos (Link 'Produtos' ativo)
export const ProductsPage: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/products',
      },
    },
  },
};

// 3. Visualização Mobile
// Útil para testar se os links desktop somem e o ícone de hambúrguer aparece
export const MobileView: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    nextjs: {
      navigation: {
        pathname: '/',
      },
    },
  },
};  