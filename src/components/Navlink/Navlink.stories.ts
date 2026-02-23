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
  },
};

export const Active: Story = {
  args: {
    href: '/',
    label: 'Active',
  },
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/',
      },
    },
  },
};
