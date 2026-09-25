import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Signup from "./Signup";

// A foto real vem do Contentful (`mainBanner.image`); no Storybook usamos um
// asset local para não depender de rede.
const SAMPLE_PHOTO = "/modules/analise.jpg";

const meta: Meta<typeof Signup> = {
  title: "Dashboard/Signup",
  component: Signup,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    backgroundImageUrl: SAMPLE_PHOTO,
  },
};

export default meta;
type Story = StoryObj<typeof Signup>;

export const Default: Story = {};

export const WithError: Story = {
  args: {
    error: "Não foi possível concluir o cadastro. Tente novamente.",
  },
};

export const Submitted: Story = {
  args: {
    submitted: true,
  },
};
