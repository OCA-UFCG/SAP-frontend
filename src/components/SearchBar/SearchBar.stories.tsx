import type { Meta, StoryObj } from '@storybook/nextjs-vite'; 
import SearchBar from "./SearchBar"; 

const meta: Meta<typeof SearchBar> = {
  title: "Dashboard/SearchBar",
  component: SearchBar,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof SearchBar>;

export const Default: Story = {

};
