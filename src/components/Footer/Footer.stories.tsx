import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Footer from './Footer';
import type { ISection } from '@/utils/interfaces';

const mockContent: ISection[] = [
  { id: '1', name: 'Início', path: '/', appears: true },
  { id: '3', name: 'Sobre', path: '/sobre-o-sedes', appears: true },
  { id: '5', name: 'Glossário', path: '/glossary', appears: true },
  { id: '2', name: 'Plataforma', path: '/platform', appears: true },
];

const meta: Meta<typeof Footer> = {
  title: 'Layout/Footer',
  component: Footer,
  tags: ['autodocs'],

  argTypes: {
    content: {
      description:
        'Os links do menu do topo, repetidos no rodapé.',
      control: 'object',
    },
  },

  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
    },
  },

  decorators: [
    (Story) => (
      <div className="min-h-screen flex flex-col justify-end">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Footer>;

export const Default: Story = {
  args: {
    content: mockContent,
  },
};

export const OnlyMainPages: Story = {
  args: {
    content: mockContent.map((item) => ({
      ...item,
      appears: true,
    })),
  },
};

export const ManyThemes: Story = {
  args: {
    content: [
      ...mockContent,
      ...Array.from({ length: 12 }).map((_, i) => ({
        id: `extra-${i}`,
        name: `Tema ${i + 1}`,
        path: `/tema/${i + 1}`,
        appears: false,
      })),
    ],
  },
};

export const Empty: Story = {
  args: {
    content: [],
  },
};