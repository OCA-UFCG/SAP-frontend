import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { NavLink } from './NavLink';

const meta: Meta<typeof NavLink> = {
  title: 'Layout/NavLink',
  component: NavLink,
  tags: ['autodocs'],
  argTypes: {
    href: {
      description: 'O caminho de destino do link',
      control: 'text',
    },
    exact: {
      description: 'Se verdadeiro, o link só será "active" se o pathname for idêntico ao href',
      control: 'boolean',
    },
    className: {
      description: 'Classes CSS adicionais',
      control: 'text',
    },
  },


  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/dashboard', 
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof NavLink>;

export const Default: Story = {
  args: {
    href: '/profile',
    label: 'Meu Perfil',
    className: 'text-gray-500 hover:text-blue-600',
  },
};

export const Active: Story = {
  args: {
    href: '/dashboard',
    label: 'Dashboard',
    className: 'text-gray-500 font-bold',
  },
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/dashboard',
      },
    },
  },
};

export const PartialMatch: Story = {
  args: {
    href: '/settings',
    exact: false,
    label: 'Configurações (Ativo em sub-rotas)',
    className: 'p-2 rounded transition-all',
  },
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/settings/security',
      },
    },
  },
};

// 4. Link com correspondência exata falhando (exact = true)
export const ExactMatchRequired: Story = {
  args: {
    href: '/settings',
    exact: true,
    label: 'Configurações (Inativo pois não é exato)',
    className: 'p-2 border',
  },
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/settings/security',
      },
    },
  },
};