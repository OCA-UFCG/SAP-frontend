import type { Meta, StoryObj } from "@storybook/nextjs";


import { PartnersSection } from '../components/PartnersSection/PartnersSection';

const meta: Meta<typeof PartnersSection> = {
  title: 'Sections/PartnersSection',
  component: PartnersSection,
};

export default meta;

type Story = StoryObj<typeof PartnersSection>;

export const Default: Story = {};
