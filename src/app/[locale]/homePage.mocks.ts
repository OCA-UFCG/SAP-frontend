import { HomeNewsItemI, PlatformModulesSectionI } from "@/utils/interfaces";

// Fotos recortadas do design da home (Figma). Os textos ficam nas traduções.
export const MOCK_PLATFORM_MODULES_CONTENT: PlatformModulesSectionI = {
  modules: [
    {
      id: "monitoring",
      image: "/home/modulo-monitoramento.jpg",
      href: "/platform",
    },
    {
      id: "communication",
      image: "/home/modulo-comunicacao.jpg",
      href: "/platform?section=communication",
    },
    {
      id: "analysis",
      image: "/home/modulo-analise.jpg",
      href: "/platform/amfe",
    },
  ],
};

// Recursos em destaque quando o Contentful não tiver nenhum publicado (e em
// inglês e espanhol). Sem data: não são novidades, e sim o que já existe.
export const MOCK_NEWS_CONTENT: HomeNewsItemI[] = [
  {
    id: "indice-combinado-de-seca",
    module: "monitoring",
    href: "/platform",
  },
  {
    id: "relatorio-por-municipio",
    module: "communication",
    href: "/platform?section=communication",
  },
  {
    id: "priorizacao-por-recorte",
    module: "analysis",
    href: "/platform/amfe",
  },
];
