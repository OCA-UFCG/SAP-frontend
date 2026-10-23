import { getTranslations } from "next-intl/server";
import { routing } from "@/translations/routing-config";
import {
  getHomeTexts,
  HomeSectionId,
  HomeTestimonialContent,
  HomeTextsContent,
  HomeTranslatedLocale,
} from "@/repositories/content/homeTextsRepository";
import { HomeTestimonialI, HomeTextsI } from "@/utils/interfaces";
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

/** O depoimento no idioma pedido; o texto que faltar fica o de português. */
function localizeTestimonial(
  { translations, ...item }: HomeTestimonialContent,
  locale?: HomeTranslatedLocale,
): HomeTestimonialI {
  const translated = locale ? translations[locale] : undefined;
  return {
    ...item,
    quote: translated?.quote ?? item.quote,
    author: translated?.author ?? item.author,
    authorDetail: translated?.authorDetail ?? item.authorDetail,
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
      images: policy?.images,
    },
    features: {
      title: features?.title ?? base.features.title,
      items: base.features.items.map(
        (item) =>
          cms.features.find((feature) => feature.module === item.module) ??
          item,
      ),
    },
    testimonials: {
      title: testimonials?.title ?? base.testimonials.title,
      items: cms.testimonials.length
        ? cms.testimonials.map((item) => localizeTestimonial(item))
        : base.testimonials.items,
    },
  };
}

/** Só as fotos do Contentful, que valem para qualquer idioma. */
export function mergeHomeImages(
  base: HomeTextsI,
  cms: HomeTextsContent,
): HomeTextsI {
  return {
    ...base,
    tools: {
      ...base.tools,
      items: base.tools.items.map((item) => ({
        ...item,
        image: cms.tools.find((tool) => tool.id === item.id)?.image,
      })),
    },
    publicPolicy: {
      ...base.publicPolicy,
      images: cms.sections["politica-publica"]?.images,
    },
  };
}

/**
 * Inglês e espanhol: do Contentful vêm as fotos, os títulos das seções e os
 * depoimentos, cada um no campo do idioma ("Título (inglês)", "Citação
 * (espanhol)"...). Os demais textos continuam nos arquivos de tradução.
 */
export function mergeTranslatedHomeTexts(
  base: HomeTextsI,
  cms: HomeTextsContent,
  locale: HomeTranslatedLocale,
): HomeTextsI {
  const withImages = mergeHomeImages(base, cms);
  const title = (id: HomeSectionId, fallback: string) =>
    cms.sections[id]?.titleTranslations?.[locale] ?? fallback;

  return {
    ...withImages,
    tools: {
      ...withImages.tools,
      title: title("ferramentas", base.tools.title),
    },
    publicPolicy: {
      ...withImages.publicPolicy,
      title: title("politica-publica", base.publicPolicy.title),
    },
    features: {
      ...base.features,
      title: title("recursos-em-destaque", base.features.title),
    },
    testimonials: {
      title: title("depoimentos", base.testimonials.title),
      items: cms.testimonials.length
        ? cms.testimonials.map((item) => localizeTestimonial(item, locale))
        : base.testimonials.items,
    },
  };
}

function isTranslatedLocale(locale: string): locale is HomeTranslatedLocale {
  return locale === "en" || locale === "es";
}

/**
 * Textos da home para o idioma da página. O português vem dos campos
 * principais do Contentful; inglês e espanhol, dos campos de cada idioma.
 */
export async function getHomeTextsForLocale(
  locale: string,
): Promise<HomeTextsI> {
  const [translated, cms] = await Promise.all([
    getTranslatedHomeTexts(),
    getHomeTexts(),
  ]);
  if (!cms) return translated;

  if (locale === routing.defaultLocale) return mergeHomeTexts(translated, cms);
  return isTranslatedLocale(locale)
    ? mergeTranslatedHomeTexts(translated, cms, locale)
    : mergeHomeImages(translated, cms);
}
