import { getHomePageContent } from "@/repositories/content/siteContentRepository";
import { ForgotPasswordPageClient } from "./ForgotPasswordPageClient";

function normalizeImageUrl(url?: string) {
  if (!url) return undefined;
  return url.startsWith("//") ? `https:${url}` : url;
}

/**
 * Aberta com o bloqueio de acesso ligado ou desligado: trocar a senha não cria
 * conta, e quem tem conta feita à mão também esquece a senha.
 */
export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const data = await getHomePageContent(locale);
  const backgroundImageUrl = normalizeImageUrl(data?.mainBanner?.image?.url);

  return <ForgotPasswordPageClient backgroundImageUrl={backgroundImageUrl} />;
}
