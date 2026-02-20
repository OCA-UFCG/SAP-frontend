import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Icon } from './Icon';

const meta: Meta<typeof Icon> = {
  title: 'Components/Icon',
  component: Icon,
  tags: ['autodocs'],
  argTypes: {
    id: {
      description: 'O ID do ícone dentro do arquivo sprite.svg',
      control: 'text',
    },
    size: {
      description: 'Define largura e altura simultaneamente',
      control: { type: 'number' },
    },
    width: { control: { type: 'number' } },
    height: { control: { type: 'number' } },
    onClick: { action: 'clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof Icon>;

export const Default: Story = {
  args: {
    id: 'logo',
    width: 128,
    height: 72,
  },
};


