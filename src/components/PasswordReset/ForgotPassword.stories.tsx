import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import ForgotPassword from "./ForgotPassword";

// A foto real vem do Contentful (`mainBanner.image`); no Storybook usamos um
// asset local para não depender de rede.
const SAMPLE_PHOTO = "/modules/analise.jpg";

const meta: Meta<typeof ForgotPassword> = {
  title: "Dashboard/ForgotPassword",
  component: ForgotPassword,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    backgroundImageUrl: SAMPLE_PHOTO,
  },
};

export default meta;
type Story = StoryObj<typeof ForgotPassword>;

export const Default: Story = {};

export const WithError: Story = {
  args: {
    error: "Muitas tentativas. Tente novamente em instantes.",
  },
};

export const Submitted: Story = {
  args: {
    submittedEmail: "fulano@ufcg.edu.br",
  },
};
