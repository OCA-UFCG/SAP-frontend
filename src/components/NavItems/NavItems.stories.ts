import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { NavItems } from './NavItems';
import { ISections } from '@/utils/interfaces';

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

const content: ISections = {
  'home-section': {
    id: '1',
    name: 'Home',
    path: '/',
    appears: true,
  },
  'map-section': {
    id: '2',
    name: 'Mapa',
    path: '/mock',
    appears: true,
  },
  'about-section': {
    id: '3',
    name: 'Sobre o Sap',
    path: '/mock',
    appears: true,
  },
  'contact-section': {
    id: '4',
    name: 'Contatos',
    path: '/mock',
    appears: true,
  },
};

export default meta;
type Story = StoryObj<typeof NavItems>;

export const DesktopNavItems: Story = {
  args: {
    className: 'flex flex-row items-center gap-[24px]',
    content: Object.values(content),
  },
};
