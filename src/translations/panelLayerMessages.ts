import "server-only";

import {
  CONTENTFUL_COLLECTION_LIMIT,
  getContent,
} from "@/infrastructure/contentful/client";
import { PANEL_LAYERS_CACHE_TAG } from "@/repositories/platform/panelLayerCacheTag";
import { slugifyTranslationKey } from "@/utils/translations";

/**
 * Nome, descrição e rótulos das classes de cada índice em inglês e espanhol,
 * gravados no próprio `panelLayer` pelo catálogo ("Nome (inglês)", "Rótulos
 * das classes (espanhol)"...).
 *
 * Em vez de cada tela do Monitoramento e do relatório ler esses campos, eles
 * entram nas mensagens de tradução nas mesmas chaves que as telas já consultam
 * (`ModulesContext.Layers.<nome>` e `PlatformMapCaption.labels.<rótulo>`), por
 * cima do que estiver nos arquivos de tradução.
 */
const GET_PANEL_LAYER_TRANSLATIONS = `
  query GetPanelLayerTranslations {
    panelLayerCollection(limit: ${CONTENTFUL_COLLECTION_LIMIT}) {
      items {
        name
        description
        nameEn
        nameEs
        descriptionEn
        descriptionEs
        classLabelsEn
        classLabelsEs
      }
    }
  }
`;

const SUFFIXES: Record<string, "En" | "Es"> = { en: "En", es: "Es" };

type LayerTranslationItem = {
  name?: string | null;
  description?: string | null;
} & Partial<
  Record<`name${"En" | "Es"}` | `description${"En" | "Es"}`, string | null> &
    Record<`classLabels${"En" | "Es"}`, Record<string, unknown> | null>
>;

interface PanelLayerTranslationsResponse {
  panelLayerCollection: { items: Array<LayerTranslationItem | null> };
}

export interface PanelLayerMessages {
  ModulesContext: {
    Layers: Record<string, { title?: string; description?: string }>;
  };
  PlatformMapCaption: { labels: Record<string, string> };
}

/** A mesma chave que a legenda, o relatório e o painel usam para um rótulo. */
export function classLabelKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/</g, "menor-que")
    .replace(/>/g, "maior-que")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/**
 * O texto vira mensagem do next-intl, que lê `{...}` como variável: chaves
 * digitadas no catálogo precisam chegar à tela como texto.
 */
function asLiteralMessage(text: string): string {
  if (!/[{}]/.test(text)) return text;
  return text.replace(/'/g, "''").replace(/[{}]/g, "'$&'");
}

function filled(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** As mensagens de um idioma a partir dos campos de tradução dos índices. */
export function buildPanelLayerMessages(
  items: Array<LayerTranslationItem | null>,
  locale: string,
): PanelLayerMessages | null {
  const suffix = SUFFIXES[locale];
  if (!suffix) return null;

  const layers: PanelLayerMessages["ModulesContext"]["Layers"] = {};
  const labels: PanelLayerMessages["PlatformMapCaption"]["labels"] = {};

  for (const item of items) {
    if (!item?.name) continue;
    const title = filled(item[`name${suffix}`]);
    const description = filled(item[`description${suffix}`]);
    if (title || description) {
      layers[slugifyTranslationKey(item.name)] = {
        ...(title ? { title: asLiteralMessage(title) } : {}),
        ...(description ? { description: asLiteralMessage(description) } : {}),
      };
    }

    for (const [label, translated] of Object.entries(
      item[`classLabels${suffix}`] ?? {},
    )) {
      const text = filled(translated);
      if (text) labels[classLabelKey(label)] = asLiteralMessage(text);
    }
  }

  return {
    ModulesContext: { Layers: layers },
    PlatformMapCaption: { labels },
  };
}

/**
 * As traduções publicadas dos índices para `locale`, ou `null` em português
 * ou quando o Contentful não responde — aí ficam só os arquivos de tradução.
 * Usa a mesma tag de cache da lista de índices, que o catálogo limpa ao
 * publicar.
 */
export async function getPanelLayerMessages(
  locale: string,
): Promise<PanelLayerMessages | null> {
  if (!SUFFIXES[locale]) return null;

  try {
    const data = await getContent<PanelLayerTranslationsResponse>(
      GET_PANEL_LAYER_TRANSLATIONS,
      undefined,
      { next: { revalidate: 3600, tags: [PANEL_LAYERS_CACHE_TAG] } },
    );
    return buildPanelLayerMessages(
      data.panelLayerCollection?.items ?? [],
      locale,
    );
  } catch (error) {
    console.error(
      "Erro ao buscar as traduções dos índices no Contentful:",
      error,
    );
    return null;
  }
}

type MessageTree = Record<string, unknown>;

/** `extra` por cima de `base`, entrando em cada nível de objeto. */
export function mergeMessages(
  base: MessageTree,
  extra: MessageTree,
): MessageTree {
  const merged: MessageTree = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const current = merged[key];
    merged[key] =
      value &&
      typeof value === "object" &&
      current &&
      typeof current === "object"
        ? mergeMessages(current as MessageTree, value as MessageTree)
        : value;
  }
  return merged;
}
