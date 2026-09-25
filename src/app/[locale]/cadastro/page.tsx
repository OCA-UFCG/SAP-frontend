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
  const { locale } = await params;
  const data = await getHomePageContent(locale);
  const backgroundImageUrl = normalizeImageUrl(data?.mainBanner?.image?.url);

  return <SignupPageClient backgroundImageUrl={backgroundImageUrl} />;
}
