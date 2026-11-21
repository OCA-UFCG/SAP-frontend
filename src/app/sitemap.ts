import type { MetadataRoute } from "next";
import { isPlatformOpen } from "@/lib/access-flag";
import { officialSiteUrl } from "@/lib/official-site-url";
import { routing } from "@/translations/routing-config";

// O endereço oficial e a abertura da plataforma vêm do ambiente do container,
// que não existe no build.
export const dynamic = "force-dynamic";

const PUBLIC_PAGES = ["", "/sobre-o-sedes", "/glossary", "/acessibilidade"];
const PLATFORM_PAGE = "/platform";

/**
 * As páginas públicas no endereço oficial, cada uma com as versões em
 * português, inglês e espanhol. A plataforma só entra quando está aberta: com
 * login, o buscador receberia um redirecionamento para a tela de entrar.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const official = officialSiteUrl();
  if (!official) return [];

  const pages = isPlatformOpen()
    ? [...PUBLIC_PAGES, PLATFORM_PAGE]
    : PUBLIC_PAGES;

  return pages.map((page) => ({
    url: `${official}/${routing.defaultLocale}${page}`,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((locale) => [locale, `${official}/${locale}${page}`]),
      ),
    },
  }));
}
