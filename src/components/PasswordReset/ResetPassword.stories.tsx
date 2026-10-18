import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import ResetPassword from "./ResetPassword";

// A foto real vem do Contentful (`mainBanner.image`); no Storybook usamos um
// asset local para não depender de rede.
const SAMPLE_PHOTO = "/modules/analise.jpg";

const meta: Meta<typeof ResetPassword> = {
  title: "Dashboard/ResetPassword",
  component: ResetPassword,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    backgroundImageUrl: SAMPLE_PHOTO,
    status: "ready",
    email: "fulano@ufcg.edu.br",
  },
};

export default meta;
type Story = StoryObj<typeof ResetPassword>;

export const Ready: Story = {};

export const WeakPassword: Story = {
  args: {
    error:
      "Essa senha não atende às regras de segurança. Tente uma mais longa, misturando letras, números e símbolos.",
  },
};

export const Invalid: Story = {
  args: {
    status: "invalid",
  },
};

export const Done: Story = {
  args: {
    status: "done",
  },
};
