import { notFound } from "next/navigation";
import { isSignupOffered } from "@/lib/access-flag";
import { getHomePageContent } from "@/repositories/content/siteContentRepository";
import { SignupPageClient } from "./SignupPageClient";

function normalizeImageUrl(url?: string) {
  if (!url) return undefined;
  return url.startsWith("//") ? `https:${url}` : url;
}

export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Mesma regra das rotas de cadastro: com o bloqueio desligado, o formulário
  // não existe — esconder só o link deixava a página aberta para quem a digitasse.
  if (!isSignupOffered()) {
    notFound();
  }

  const { locale } = await params;
  const data = await getHomePageContent(locale);
  const backgroundImageUrl = normalizeImageUrl(data?.mainBanner?.image?.url);

  return <SignupPageClient backgroundImageUrl={backgroundImageUrl} />;
}
