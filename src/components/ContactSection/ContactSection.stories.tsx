import type { Meta, StoryObj } from '@storybook/nextjs-vite'; 
import ContactSection from "./ContactSection"; 

const meta: Meta<typeof ContactSection> = {
  title: "Dashboard/ContactSection",
  component: ContactSection,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof ContactSection>;

export const Default: Story = {

};
