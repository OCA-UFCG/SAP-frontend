import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Footer from './Footer';
import type { FooterI } from '@/utils/interfaces';

const mockContent: FooterI[] = [
  // main pages (appears = true)
  { id: 'home', name: 'Home', path: '/', appears: true },
  { id: 'map', name: 'Mapas', path: '/map', appears: true },
  { id: 'about', name: 'Sobre o SAP', path: '/about', appears: true },
  { id: 'contact', name: 'Contatos', path: '/contact', appears: true },

  // macro themes
  { id: 'analysis-1', name: 'Análise 1', path: '/a1', appears: false },
  { id: 'analysis-2', name: 'Análise 2', path: '/a2', appears: false },
  { id: 'analysis-3', name: 'Análise 3', path: '/a3', appears: false },
  { id: 'analysis-4', name: 'Análise 4', path: '/a4', appears: false },
  { id: 'analysis-5', name: 'Análise 5', path: '/a5', appears: false },
  { id: 'analysis-6', name: 'Análise 6', path: '/a6', appears: false },
  { id: 'analysis-7', name: 'Análise 7', path: '/a7', appears: false },
];

const meta: Meta<typeof Footer> = {
  title: 'Layout/Footer',
  component: Footer,
  tags: ['autodocs'],

  argTypes: {
    content: {
      description:
        'Lista de links exibidos no footer. Itens com appears=true são páginas principais.',
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