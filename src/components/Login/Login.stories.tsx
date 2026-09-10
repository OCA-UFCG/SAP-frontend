import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Login from "./Login";

// A foto real vem do Contentful (`mainBanner.image`); no Storybook usamos um
// asset local para não depender de rede.
const SAMPLE_PHOTO = "/modules/analise.jpg";

const meta: Meta<typeof Login> = {
  title: "Dashboard/Login",
  component: Login,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    backgroundImageUrl: SAMPLE_PHOTO,
  },
};

export default meta;
type Story = StoryObj<typeof Login>;

export const Default: Story = {};

export const WithError: Story = {
  args: {
    error: "Email ou senha inválidos.",
  },
};

export const WithoutPhoto: Story = {
  args: {
    backgroundImageUrl: undefined,
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};
