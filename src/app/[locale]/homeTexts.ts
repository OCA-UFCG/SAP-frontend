import { getTranslations } from "next-intl/server";
import { routing } from "@/translations/routing-config";
import {
  getHomeTexts,
  HomeTextsContent,
} from "@/repositories/content/homeTextsRepository";
import { HomeTextsI } from "@/utils/interfaces";
import { MOCK_NEWS_CONTENT } from "./homePage.mocks";

const HIGHLIGHT_KEYS = [
  "municipalities",
  "institutions",
  "products",
  "territories",
  "law",
] as const;

// A ordem das ferramentas é sempre esta, também quando o texto vem do Contentful.
const TOOL_IDS = ["monitoring", "communication", "analysis"] as const;

const TESTIMONIAL_KEYS = ["1", "2", "3", "4", "5", "6"] as const;

/** Os textos da home vindos dos arquivos de tradução do idioma da página. */
async function getTranslatedHomeTexts(): Promise<HomeTextsI> {
  const [numbersT, toolsT, policyT, newsT, testimonialsT] = await Promise.all([
    getTranslations("BigNumbersSection"),
    getTranslations("PlatformModulesSection"),
    getTranslations("PublicPolicySection"),
    getTranslations("NewsSection"),
    getTranslations("UseCasesSection"),
  ]);

  return {
    highlights: HIGHLIGHT_KEYS.map((key) => ({
      value: numbersT(`items.${key}.value`),
      label: numbersT(`items.${key}.label`),
      description: numbersT(`items.${key}.description`),
    })),
    tools: {
      title: toolsT("title"),
      subtitle: toolsT("subtitle"),
      items: TOOL_IDS.map((id) => ({
        id,
        name: toolsT(`modules.${id}.title`),
        shortText: toolsT(`modules.${id}.description`),
        fullText: toolsT(`modules.${id}.fullText`),
        buttonText: toolsT(`modules.${id}.button`),
      })),
    },
    publicPolicy: {
      title: policyT("title"),
      text: policyT("text"),
      buttonText: policyT("button"),
    },
    features: {
      title: newsT("title"),
      items: MOCK_NEWS_CONTENT.map((item) => ({
        ...item,
        title: newsT(`items.${item.id}.title`),
        description: newsT(`items.${item.id}.description`),
      })),
    },
    testimonials: {
      title: testimonialsT("title"),
      items: TESTIMONIAL_KEYS.map((key) => ({
        quote: testimonialsT(`items.${key}.quote`),
        author: testimonialsT(`items.${key}.author`),
      })),
    },
  };
}

/**
 * Põe o que está publicado no Contentful por cima das traduções: cada texto ou
 * lista que o Contentful não tiver continua vindo da tradução.
 */
export function mergeHomeTexts(
  base: HomeTextsI,
  cms: HomeTextsContent,
): HomeTextsI {
  const { sections } = cms;
  const tools = sections["ferramentas"];
  const policy = sections["politica-publica"];
  const features = sections["recursos-em-destaque"];
  const testimonials = sections["depoimentos"];

  return {
    highlights: cms.highlights.length ? cms.highlights : base.highlights,
    tools: {
      title: tools?.title ?? base.tools.title,
      subtitle: tools ? tools.subtitle : base.tools.subtitle,
      items: base.tools.items.map(
        (item) => cms.tools.find((tool) => tool.id === item.id) ?? item,
      ),
    },
    publicPolicy: {
      title: policy?.title ?? base.publicPolicy.title,
      text: policy?.text ?? base.publicPolicy.text,
      buttonText: policy?.buttonText ?? base.publicPolicy.buttonText,
    },
    features: {
      title: features?.title ?? base.features.title,
      items: cms.features.length ? cms.features : base.features.items,
    },
    testimonials: {
      title: testimonials?.title ?? base.testimonials.title,
      items: cms.testimonials.length
        ? cms.testimonials
        : base.testimonials.items,
    },
  };
}

/**
 * Textos da home para o idioma da página. O Contentful guarda uma versão só,
 * em português; inglês e espanhol continuam nos arquivos de tradução.
 */
export async function getHomeTextsForLocale(
  locale: string,
): Promise<HomeTextsI> {
  const translated = await getTranslatedHomeTexts();
  if (locale !== routing.defaultLocale) return translated;

  const cms = await getHomeTexts();
  return cms ? mergeHomeTexts(translated, cms) : translated;
}
