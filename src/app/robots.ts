import type { MetadataRoute } from "next";
import { officialSiteUrl } from "@/lib/official-site-url";

// O endereço oficial vem do ambiente do container, que não existe no build.
export const dynamic = "force-dynamic";

/**
 * Sem este arquivo, /robots.txt caía na rota de idioma e respondia uma página
 * HTML. As rotas de /api/ (tiles, análises, Earth Engine) ficam de fora: não
 * têm o que indexar e cada pedido custa ao servidor.
 */
export default function robots(): MetadataRoute.Robots {
  const official = officialSiteUrl();

  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    ...(official ? { sitemap: `${official}/sitemap.xml` } : {}),
  };
}
