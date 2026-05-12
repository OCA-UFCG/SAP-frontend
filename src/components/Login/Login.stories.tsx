import type { Meta, StoryObj } from '@storybook/nextjs-vite'; 
import Login from "./Login"; 

const meta: Meta<typeof Login> = {
  title: "Dashboard/Login",
  component: Login,
};

export default meta;
type Story = StoryObj<typeof Login>;

export const Default: Story = {

};
